import os
import numpy as np
from scipy import stats
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from services.worldbank import get_baseline_multiplier
from services.reliefweb import get_category_multiplier

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# ── Constants ──────────────────────────────────────────────────────────────────
GOUGING_Z_THRESHOLD  = 1.5   # z-score above this = gouging alert
BELL_CURVE_POINTS    = 60    # number of points to generate for bell curve
MIN_REPORTS_REQUIRED = 5     # minimum reports needed to compute a reliable baseline


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def _fetch_fair_prices(city, item_name):
    """
    Pull only non-gouging prices for a city + item to build a clean baseline.
    Excludes outliers so they don't skew the mean.
    """
    sql = """
        SELECT price
        FROM   market_reports
        WHERE  city      = %s
          AND  item_name = %s
          AND  is_gouging = FALSE
        ORDER  BY reported_at DESC
        LIMIT  100
    """
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (city, item_name))
            rows = cur.fetchall()
    return [float(r["price"]) for r in rows]


def _fetch_all_prices(city, item_name):
    """
    Pull all prices (including gouging) for trend analysis.
    """
    sql = """
        SELECT price, reported_at, neighborhood, is_gouging
        FROM   market_reports
        WHERE  city      = %s
          AND  item_name = %s
        ORDER  BY reported_at DESC
        LIMIT  100
    """
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (city, item_name))
            rows = cur.fetchall()
    return rows


def _fetch_category(city, item_name):
    """Get the category for an item so we know which disaster multiplier to apply."""
    sql = """
        SELECT category FROM market_reports
        WHERE city = %s AND item_name = %s
        LIMIT 1
    """
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (city, item_name))
            row = cur.fetchone()
    return row["category"] if row else "Staple"


# ── Baseline calculation ───────────────────────────────────────────────────────

def compute_adjusted_baseline(city, item_name):
    """
    Computes the inflation + disaster adjusted baseline mean and std for an item.

    Adjustment stack:
      1. Raw mean/std from fair prices in DB
      2. × World Bank food inflation multiplier (macroeconomic)
      3. × ReliefWeb disaster multiplier (event-driven, category-specific)

    Returns a dict with everything anomaly detection needs.
    """
    fair_prices = _fetch_fair_prices(city, item_name)

    if len(fair_prices) < MIN_REPORTS_REQUIRED:
        return {
            "error":    f"Not enough data — need {MIN_REPORTS_REQUIRED} reports, have {len(fair_prices)}",
            "city":     city,
            "item":     item_name,
        }

    raw_mean = float(np.mean(fair_prices))
    raw_std  = float(np.std(fair_prices, ddof=1))

    # ── External adjustment factors ────────────────────────────────────────────
    wb_multiplier       = get_baseline_multiplier(city)           # World Bank CPI
    category            = _fetch_category(city, item_name)
    disaster_multiplier = get_category_multiplier(city, category) # ReliefWeb

    # Combined multiplier — both factors compound
    combined_multiplier = round(wb_multiplier * disaster_multiplier, 4)

    # Adjusted mean shifts up with inflation/disasters
    # Std scales proportionally so the distribution shape stays realistic
    adjusted_mean = round(raw_mean * combined_multiplier, 4)
    adjusted_std  = round(raw_std  * combined_multiplier, 4)

    return {
        "city":                 city,
        "item":                 item_name,
        "category":             category,
        "raw_mean":             raw_mean,
        "raw_std":              raw_std,
        "wb_multiplier":        wb_multiplier,
        "disaster_multiplier":  disaster_multiplier,
        "combined_multiplier":  combined_multiplier,
        "adjusted_mean":        adjusted_mean,
        "adjusted_std":         adjusted_std,
        "sample_size":          len(fair_prices),
        "price_floor":          round(adjusted_mean - 2 * adjusted_std, 2),
        "price_ceiling":        round(adjusted_mean + 2 * adjusted_std, 2),
    }


# ── Bell curve generator ───────────────────────────────────────────────────────

def generate_bell_curve(mean, std, submitted_price=None):
    """
    Generates BELL_CURVE_POINTS points for a normal distribution curve.
    Range spans mean ± 3.5 std to show the full curve.

    Returns list of { x, y } dicts ready for Recharts AreaChart.
    """
    x_min = mean - 3.5 * std
    x_max = mean + 3.5 * std
    x_vals = np.linspace(x_min, x_max, BELL_CURVE_POINTS)
    y_vals = stats.norm.pdf(x_vals, loc=mean, scale=std)

    # Normalize y to 0–1 range so the chart looks clean regardless of currency
    y_max = float(np.max(y_vals))
    points = [
        {"x": round(float(x), 4), "y": round(float(y) / y_max, 6)}
        for x, y in zip(x_vals, y_vals)
    ]

    # If submitted price is outside chart range, extend the x axis
    if submitted_price is not None:
        if submitted_price > x_max:
            extra_x = np.linspace(x_max, submitted_price * 1.05, 15)
            extra_y = stats.norm.pdf(extra_x, loc=mean, scale=std)
            for x, y in zip(extra_x, extra_y):
                points.append({"x": round(float(x), 4), "y": round(float(y) / y_max, 6)})

    return points


# ── Core analysis function ─────────────────────────────────────────────────────

def analyze_price(city, item_name, submitted_price):
    """
    Main entry point — called by Flask POST /price/submit.

    Takes a submitted price, computes Z-score against the adjusted baseline,
    and returns everything the frontend needs to render the bell curve + alert.

    Returns:
    {
        "city":                  "Lagos, Nigeria",
        "item":                  "Fresh Tomatoes (Basket)",
        "submitted_price":       5800,
        "currency":              "NGN",
        "mean":                  2500.0,
        "std":                   310.0,
        "adjusted_mean":         3375.0,
        "adjusted_std":          418.5,
        "z_score":               5.81,
        "is_gouged":             True,
        "percent_above":         71.9,
        "severity":              "extreme",
        "fair_price_range":      {"min": 2538.0, "max": 4212.0},
        "suggested_counter":     2800,
        "bell_curve":            [...60 points...],
        "adjustments": {
            "wb_multiplier":       1.293,
            "disaster_multiplier": 1.28,
            "combined":            1.655,
            "reason":              "Adjusted for 29.3% food inflation + active flood event"
        }
    }
    """
    baseline = compute_adjusted_baseline(city, item_name)

    if "error" in baseline:
        return {"error": baseline["error"]}

    mean = baseline["adjusted_mean"]
    std  = baseline["adjusted_std"]

    # Guard against zero std (all prices identical)
    if std == 0:
        std = mean * 0.05  # assume 5% natural variance

    z_score      = float((submitted_price - mean) / std)
    is_gouged    = z_score > GOUGING_Z_THRESHOLD
    percent_above = round(((submitted_price - mean) / mean) * 100, 1)

    # Severity tiers
    if z_score <= GOUGING_Z_THRESHOLD:
        severity = "fair"
    elif z_score <= 2.5:
        severity = "moderate"
    elif z_score <= 4.0:
        severity = "high"
    else:
        severity = "extreme"

    # Suggested counter-offer: 5% below the mean (realistic negotiation anchor)
    suggested_counter = round(mean * 0.95, 2)

    # Fair range: mean ± 1 std
    fair_range = {
        "min": round(mean - std, 2),
        "max": round(mean + std, 2),
    }

    # Bell curve data for Recharts
    bell_curve = generate_bell_curve(mean, std, submitted_price)

    # Human-readable adjustment reason
    wb_pct       = round((baseline["wb_multiplier"] - 1) * 100, 1)
    dis_pct      = round((baseline["disaster_multiplier"] - 1) * 100, 1)
    reason_parts = []
    if wb_pct > 0:
        reason_parts.append(f"{wb_pct}% food inflation")
    if dis_pct > 0:
        reason_parts.append(f"active disaster event (+{dis_pct}%)")
    adjustment_reason = (
        "Adjusted for " + " and ".join(reason_parts)
        if reason_parts else "No external adjustments applied"
    )

    # Fetch currency for this city
    currency_map = {
        "Lagos, Nigeria": "NGN",
        "Delhi, India":   "INR",
        "Metz, France":   "EUR",
    }
    currency = currency_map.get(city, "USD")

    return {
        "city":             city,
        "item":             item_name,
        "submitted_price":  submitted_price,
        "currency":         currency,
        "raw_mean":         baseline["raw_mean"],
        "raw_std":          baseline["raw_std"],
        "adjusted_mean":    mean,
        "adjusted_std":     std,
        "z_score":          round(z_score, 4),
        "is_gouged":        is_gouged,
        "percent_above":    percent_above,
        "severity":         severity,
        "fair_price_range": fair_range,
        "suggested_counter": suggested_counter,
        "sample_size":      baseline["sample_size"],
        "bell_curve":       bell_curve,
        "adjustments": {
            "wb_multiplier":        baseline["wb_multiplier"],
            "disaster_multiplier":  baseline["disaster_multiplier"],
            "combined":             baseline["combined_multiplier"],
            "reason":               adjustment_reason,
        },
    }


# ── Market-level gouging rate (for heatmap) ────────────────────────────────────

def compute_market_gouging_rate(city):
    """
    Computes the overall gouging rate for a market.
    Used by GET /markets to color the heatmap.

    Returns float 0.0 – 1.0 (e.g. 0.14 = 14% of reports are gouging)
    """
    sql = """
        SELECT
            COUNT(*)                                         AS total,
            SUM(CASE WHEN is_gouging THEN 1 ELSE 0 END)     AS gouging_count
        FROM market_reports
        WHERE city = %s
    """
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (city,))
            row = cur.fetchone()

    total   = row["total"]
    gouging = row["gouging_count"] or 0

    if total == 0:
        return 0.0

    rate = gouging / total
    return round(rate, 4)


def get_market_color(gouging_rate):
    """
    Maps a gouging rate to a heatmap color.
      < 10%  → green  (fair)
      10-25% → amber  (moderate)
      > 25%  → red    (high gouging)
    """
    if gouging_rate < 0.10:
        return "#22c55e"
    elif gouging_rate < 0.25:
        return "#f59e0b"
    else:
        return "#ef4444"


# ── CLI test ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  MarketLens — Anomaly Detection Engine Test")
    print("=" * 55)

    # Test 1: Gouged price
    print("\n🧪 Test 1: Obvious gouging — Lagos tomatoes at 3x market rate")
    result = analyze_price("Lagos, Nigeria", "Fresh Tomatoes (Basket)", 7500)
    if "error" not in result:
        print(f"   Z-Score:      {result['z_score']}")
        print(f"   Is Gouged:    {result['is_gouged']}")
        print(f"   Severity:     {result['severity']}")
        print(f"   % Above Mean: {result['percent_above']}%")
        print(f"   Counter Offer:{result['currency']} {result['suggested_counter']}")
        print(f"   Adjustment:   {result['adjustments']['reason']}")
    else:
        print(f"   ⚠️  {result['error']}")

    # Test 2: Fair price
    print("\n🧪 Test 2: Fair price — Delhi chai at normal rate")
    result = analyze_price("Delhi, India", "Masala Chai (cup)", 22)
    if "error" not in result:
        print(f"   Z-Score:      {result['z_score']}")
        print(f"   Is Gouged:    {result['is_gouged']}")
        print(f"   Severity:     {result['severity']}")
    else:
        print(f"   ⚠️  {result['error']}")

    # Test 3: Heatmap colors
    print("\n🧪 Test 3: Market gouging rates")
    for city in ["Lagos, Nigeria", "Delhi, India", "Metz, France"]:
        rate  = compute_market_gouging_rate(city)
        color = get_market_color(rate)
        print(f"   {city}: {round(rate * 100, 1)}% gouging → {color}")

    print("\n✅ Done.")