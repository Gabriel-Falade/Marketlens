import os
import psycopg2
import numpy as np
from datetime import datetime
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from services.worldbank import get_baseline_multiplier

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def _get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


# ── Demo data ─────────────────────────────────────────────────────────────────
# Used when the DB has fewer than MIN_REPORTS_FOR_LIVE fair reports for a city.
# Tells the story: Lagos chronic, Delhi healthy, Metz frost shock.

DEMO_INTEL = {
    "Lagos, Nigeria": {
        "iii": 46.2, "volatility": 0.72, "pta": 8.4, "rid": 17.9,
        "shock_score": 0.18, "shock_label": "watch",
        "confidence": 0.71, "report_count": 312,
        "official_inflation_pct": 28.3,
        "history": [
            {"week": "2025-W47", "iii": 36.8, "volatility": 0.58},
            {"week": "2025-W48", "iii": 38.1, "volatility": 0.61},
            {"week": "2025-W49", "iii": 39.7, "volatility": 0.65},
            {"week": "2025-W50", "iii": 41.2, "volatility": 0.68},
            {"week": "2025-W51", "iii": 42.8, "volatility": 0.70},
            {"week": "2026-W01", "iii": 43.5, "volatility": 0.71},
            {"week": "2026-W02", "iii": 44.1, "volatility": 0.72},
            {"week": "2026-W03", "iii": 46.2, "volatility": 0.72},
        ],
    },
    "Delhi, India": {
        "iii": 5.1, "volatility": 0.18, "pta": -2.3, "rid": -2.7,
        "shock_score": 0.02, "shock_label": "stable",
        "confidence": 0.85, "report_count": 487,
        "official_inflation_pct": 7.8,
        "history": [
            {"week": "2025-W47", "iii": 7.8, "volatility": 0.23},
            {"week": "2025-W48", "iii": 7.2, "volatility": 0.21},
            {"week": "2025-W49", "iii": 6.8, "volatility": 0.20},
            {"week": "2025-W50", "iii": 6.5, "volatility": 0.20},
            {"week": "2025-W51", "iii": 6.1, "volatility": 0.19},
            {"week": "2026-W01", "iii": 5.9, "volatility": 0.19},
            {"week": "2026-W02", "iii": 5.6, "volatility": 0.18},
            {"week": "2026-W03", "iii": 5.1, "volatility": 0.18},
        ],
    },
    "Metz, France": {
        "iii": 41.3, "volatility": 0.81, "pta": 19.2, "rid": 38.2,
        "shock_score": 0.52, "shock_label": "shock",
        "confidence": 0.62, "report_count": 148,
        "official_inflation_pct": 3.1,
        "history": [
            {"week": "2025-W47", "iii": 3.1, "volatility": 0.10},
            {"week": "2025-W48", "iii": 3.5, "volatility": 0.11},
            {"week": "2025-W49", "iii": 3.8, "volatility": 0.11},
            {"week": "2025-W50", "iii": 4.2, "volatility": 0.12},
            {"week": "2025-W51", "iii": 12.1, "volatility": 0.33},  # frost hits
            {"week": "2025-W52", "iii": 26.4, "volatility": 0.58},
            {"week": "2026-W01", "iii": 36.8, "volatility": 0.72},
            {"week": "2026-W03", "iii": 41.3, "volatility": 0.81},
        ],
    },
}

MIN_REPORTS_FOR_LIVE = 5


# ── Live computations ─────────────────────────────────────────────────────────

def _compute_iii(city, window_days=30):
    """
    Informal Inflation Index: mean(percent_above) over all reports in window.
    Requires percent_above column (added by migrate_intel_db).
    Returns (float | None, int count).
    """
    sql = """
        SELECT AVG(percent_above) AS iii, COUNT(*) AS n
        FROM market_reports
        WHERE city = %s
          AND reported_at >= NOW() - INTERVAL '{d} days'
          AND percent_above IS NOT NULL
    """.format(d=window_days)
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (city,))
                row = cur.fetchone()
        if row and row["n"] and int(row["n"]) >= MIN_REPORTS_FOR_LIVE and row["iii"] is not None:
            return round(float(row["iii"]), 2), int(row["n"])
    except Exception as e:
        print(f"  ⚠️  compute_iii: {e}")
    return None, 0


def _compute_volatility(city, window_days=14):
    """
    Volatility = weighted-average Coefficient of Variation across items, normalized 0-1.
    CoV = stddev(price) / mean(price).  0.5 CoV = fully volatile (score = 1.0).
    """
    sql = """
        SELECT item_name,
               STDDEV(price) AS sd,
               AVG(price)    AS mu,
               COUNT(*)      AS n
        FROM market_reports
        WHERE city = %s
          AND reported_at >= NOW() - INTERVAL '{d} days'
        GROUP BY item_name
        HAVING COUNT(*) >= 3
    """.format(d=window_days)
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (city,))
                rows = cur.fetchall()
        if not rows:
            return None
        total_n, weighted_cov = 0, 0.0
        for r in rows:
            sd  = float(r["sd"] or 0)
            mu  = float(r["mu"] or 1)
            n   = int(r["n"])
            cov = sd / mu if mu > 0 else 0.0
            weighted_cov += cov * n
            total_n += n
        if total_n < MIN_REPORTS_FOR_LIVE:
            return None
        return round(min(1.0, (weighted_cov / total_n) / 0.5), 4)
    except Exception as e:
        print(f"  ⚠️  compute_volatility: {e}")
    return None


def _compute_pta(city):
    """
    Price Trend Acceleration: % change in mean price, last 7d vs prior 7d.
    Positive = prices accelerating upward.
    """
    sql = """
        SELECT
            AVG(CASE WHEN reported_at >= NOW() - INTERVAL '7 days'
                     THEN price END)                           AS avg_curr,
            AVG(CASE WHEN reported_at <  NOW() - INTERVAL '7 days'
                      AND reported_at >= NOW() - INTERVAL '14 days'
                     THEN price END)                           AS avg_prev,
            COUNT(*)                                           AS total
        FROM market_reports
        WHERE city = %s
          AND reported_at >= NOW() - INTERVAL '14 days'
    """
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (city,))
                row = cur.fetchone()
        if (row and row["avg_curr"] and row["avg_prev"]
                and int(row["total"]) >= MIN_REPORTS_FOR_LIVE):
            curr = float(row["avg_curr"])
            prev = float(row["avg_prev"])
            if prev > 0:
                return round((curr / prev - 1) * 100, 2)
    except Exception as e:
        print(f"  ⚠️  compute_pta: {e}")
    return None


def _compute_shock_score(city):
    """
    Supply Shock Detection: spike in 3-day gouging rate vs 30-day baseline.
    Returns dict { score: float 0-1, label: 'stable'|'watch'|'shock' } or None.
    """
    sql = """
        SELECT
            COUNT(*) FILTER (WHERE is_gouging
                               AND reported_at >= NOW() - INTERVAL '3 days')  AS g3d,
            COUNT(*) FILTER (WHERE reported_at >= NOW() - INTERVAL '3 days')  AS t3d,
            COUNT(*) FILTER (WHERE is_gouging
                               AND reported_at >= NOW() - INTERVAL '30 days') AS g30d,
            COUNT(*) FILTER (WHERE reported_at >= NOW() - INTERVAL '30 days') AS t30d
        FROM market_reports
        WHERE city = %s
    """
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (city,))
                row = cur.fetchone()
        if not row or int(row["t30d"] or 0) < MIN_REPORTS_FOR_LIVE:
            return None
        rate_3d  = float(row["g3d"]  or 0) / max(1, int(row["t3d"]  or 1))
        rate_30d = float(row["g30d"] or 0) / max(1, int(row["t30d"] or 1))
        recency_w = min(1.0, int(row["t3d"] or 0) / 5.0)
        delta = max(0.0, rate_3d - rate_30d)
        score = round(delta * recency_w, 4)
        label = "shock" if score > 0.35 else "watch" if score > 0.15 else "stable"
        return {"score": score, "label": label}
    except Exception as e:
        print(f"  ⚠️  compute_shock: {e}")
    return None


def _compute_confidence(city, window_days=30):
    """
    Confidence 0–1: composite of submission volume, reporter-type diversity, recency.
      base       = min(1, count/30)
      diversity  = 0.6 + local_ratio × 0.4
      recency    = 0.7 + 0.3 × (reports_last_7d / total)
    """
    sql = """
        SELECT
            COUNT(*)                                                          AS total,
            COUNT(*) FILTER (WHERE reporter_type = 'local')                   AS locals,
            COUNT(*) FILTER (WHERE reported_at >= NOW() - INTERVAL '7 days') AS recent
        FROM market_reports
        WHERE city = %s
          AND reported_at >= NOW() - INTERVAL '{d} days'
    """.format(d=window_days)
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (city,))
                row = cur.fetchone()
        if not row or not row["total"] or int(row["total"]) < MIN_REPORTS_FOR_LIVE:
            return None
        total      = int(row["total"])
        local_ratio = int(row["locals"] or 0) / total
        recent_ratio = int(row["recent"] or 0) / total
        base      = min(1.0, total / 30.0)
        diversity = 0.6 + local_ratio * 0.4
        recency   = 0.7 + 0.3 * recent_ratio
        return round(min(1.0, base * diversity * recency), 3)
    except Exception as e:
        print(f"  ⚠️  compute_confidence: {e}")
    return None


# ── Public API ────────────────────────────────────────────────────────────────

def get_intel_snapshot(city):
    """
    Full intelligence snapshot for one city.
    Uses live DB computation when enough data exists; falls back to DEMO_INTEL.
    """
    demo = DEMO_INTEL.get(city, {})

    iii, n     = _compute_iii(city)
    volatility = _compute_volatility(city)
    pta        = _compute_pta(city)
    shock      = _compute_shock_score(city)
    confidence = _compute_confidence(city)

    wb_mult          = get_baseline_multiplier(city)
    official_pct     = round((wb_mult - 1) * 100, 1)
    rid              = round(iii - official_pct, 2) if iii is not None else None

    return {
        "iii":                  iii        if iii        is not None else demo.get("iii"),
        "volatility":           volatility if volatility is not None else demo.get("volatility"),
        "pta":                  pta        if pta        is not None else demo.get("pta"),
        "rid":                  rid        if rid        is not None else demo.get("rid"),
        "shock_score":          shock["score"] if shock else demo.get("shock_score"),
        "shock_label":          shock["label"] if shock else demo.get("shock_label", "stable"),
        "confidence":           confidence if confidence is not None else demo.get("confidence"),
        "report_count":         n if n > 0 else demo.get("report_count", 0),
        "official_inflation_pct": official_pct if official_pct else demo.get("official_inflation_pct"),
        "history":              demo.get("history", []),
    }


def get_all_intel():
    """Global + per-market snapshots. Used by /intel/global and /intel/export."""
    city_market = {
        "Lagos, Nigeria": "lagos",
        "Delhi, India":   "delhi",
        "Metz, France":   "metz",
    }
    markets     = []
    iii_vals    = []
    vol_vals    = []
    conf_vals   = []
    n_total     = 0

    for city, market_id in city_market.items():
        snap              = get_intel_snapshot(city)
        snap["market_id"] = market_id
        snap["city"]      = city
        markets.append(snap)
        if snap["iii"]        is not None: iii_vals.append(snap["iii"])
        if snap["volatility"] is not None: vol_vals.append(snap["volatility"])
        if snap["confidence"] is not None: conf_vals.append(snap["confidence"])
        n_total += snap.get("report_count", 0)

    return {
        "markets": markets,
        "global": {
            "iii":          round(float(np.mean(iii_vals)),  2) if iii_vals  else None,
            "volatility":   round(float(np.mean(vol_vals)),  4) if vol_vals  else None,
            "confidence":   round(float(np.mean(conf_vals)), 3) if conf_vals else None,
            "report_count": n_total,
        },
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


def migrate_intel_db():
    """Add percent_above column to market_reports if not present."""
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "ALTER TABLE market_reports "
                    "ADD COLUMN IF NOT EXISTS percent_above NUMERIC(8,3)"
                )
            conn.commit()
        print("  ✅ intel migration: percent_above column ready")
    except Exception as e:
        print(f"  ⚠️  intel migration failed: {e}")
