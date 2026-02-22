import os
import json
import anthropic
import psycopg2
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from services.worldbank import get_baseline_multiplier
from services.fao import get_price_floor

load_dotenv()

DATABASE_URL  = os.getenv("DATABASE_URL")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")

client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

# ── Currency formatting ────────────────────────────────────────────────────────
CURRENCY_SYMBOLS = {
    "NGN": "₦",
    "INR": "₹",
    "EUR": "€",
    "USD": "$",
}

# ── Cultural negotiation context per city ─────────────────────────────────────
CULTURAL_CONTEXT = {
    "Lagos, Nigeria": (
        "Negotiation is expected and respected in Lagos markets. "
        "Vendors quote high expecting a counter. Walking away slowly often works. "
        "Reference other stalls nearby. Never accept the first price. "
        "Be friendly and use humor — aggressive haggling backfires."
    ),
    "Delhi, India": (
        "Bargaining is standard practice in Delhi street markets. "
        "Start at 50-60% of the asking price and work up. "
        "Show mild disinterest to gain leverage. "
        "Comparing prices from neighboring vendors is effective. "
        "Buying multiple items gives you stronger negotiating power."
    ),
    "Metz, France": (
        "Hard bargaining is less common in French markets than in Asia or Africa. "
        "Politely questioning the price or asking for a discount on multiple items works better. "
        "Reference supermarket prices as a benchmark. "
        "End of market day (after 12pm) is when vendors are more willing to reduce prices."
    ),
}


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def migrate_db():
    """
    Add new columns to market_reports that weren't in the original seed schema.
    Uses IF NOT EXISTS so it's safe to call on every startup.
    """
    alterations = [
        "ALTER TABLE market_reports ADD COLUMN IF NOT EXISTS reporter_type  TEXT DEFAULT 'tourist'",
        "ALTER TABLE market_reports ADD COLUMN IF NOT EXISTS quality        INTEGER",
        "ALTER TABLE market_reports ADD COLUMN IF NOT EXISTS amount         TEXT",
        "ALTER TABLE market_reports ADD COLUMN IF NOT EXISTS percent_above  NUMERIC(8,3)",
    ]
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                for sql in alterations:
                    cur.execute(sql)
            conn.commit()
        print("  ✅ DB migration complete (reporter_type, quality, amount)")
    except Exception as e:
        print(f"  ⚠️  DB migration failed: {e}")


def save_price_report(city, lat, lng, item_name, category, price, currency,
                      is_gouging, reporter_type='tourist', quality=None,
                      amount=None, neighborhood=None, percent_above=None):
    """
    Persist a user-submitted price report to market_reports.
    Returns the new row id, or None on failure.
    """
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO market_reports
                        (city, neighborhood, lat, lng, item_name, category,
                         price, currency, is_gouging, reporter_type, quality, amount,
                         percent_above)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    city,
                    neighborhood or 'User Report',
                    lat,
                    lng,
                    item_name,
                    category or 'Staple',
                    price,
                    currency,
                    is_gouging,
                    reporter_type or 'tourist',
                    quality,
                    amount,
                    percent_above,
                ))
                row = cur.fetchone()
            conn.commit()
        report_id = row["id"] if row else None
        print(f"  ✅ Saved report #{report_id}: {item_name} @ {price} {currency} ({'gouging' if is_gouging else 'fair'})")
        return report_id
    except Exception as e:
        print(f"  ⚠️  DB save failed: {e}")
        return None


def _get_community_prices(city, item_name):
    """
    Fetch fair community prices weighted by reporter type.
    Locals count more than tourists (higher weight = more trustworthy).
    reporter_type column is added by migrate_db() at startup.
    """
    sql = """
        SELECT
            price,
            CASE
                WHEN reporter_type = 'local'   THEN 3.0
                WHEN reporter_type = 'student' THEN 2.0
                WHEN reporter_type = 'tourist' THEN 1.0
                ELSE 1.5
            END AS weight
        FROM market_reports
        WHERE city      = %s
          AND item_name = %s
          AND is_gouging = FALSE
        ORDER BY reported_at DESC
        LIMIT 50
    """
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (city, item_name))
                rows = cur.fetchall()

        if not rows:
            return None, None

        total_weight  = sum(float(r["weight"]) for r in rows)
        weighted_mean = sum(float(r["price"]) * float(r["weight"]) for r in rows) / total_weight
        return round(weighted_mean, 2), len(rows)

    except Exception as e:
        print(f"  ⚠️  DB fetch failed: {e}")
        return None, None


# ── Fairness score ─────────────────────────────────────────────────────────────

def compute_fairness_score(analysis):
    """
    Computes a 1–100 fairness score from three signals:
      - Z-score vs community reports         (50%)
      - Ratio vs FAO producer price floor    (30%)
      - Ratio vs World Bank adjusted mean    (20%)

    100 = incredible deal
    70+ = fair
    50-69 = slightly above market
    30-49 = overpriced
    10-29 = gouging
    1-9   = extreme gouging
    """
    z_score        = analysis.get("z_score", 0)
    submitted      = analysis.get("submitted_price", 0)
    adjusted_mean  = analysis.get("adjusted_mean", 1)
    city           = analysis.get("city")
    item           = analysis.get("item")

    # Signal 1: Z-score component (50%)
    # z=0 → 100 points, z=1.5 → 50 points, z=3+ → 0 points
    z_component = max(0, min(100, 100 - (z_score * 33.3)))

    # Signal 2: FAO floor ratio (30%)
    fao_floor    = get_price_floor(city, item)
    fao_component = 100  # default if no FAO data
    if fao_floor and fao_floor > 0:
        # Convert FAO USD floor to local currency using the adjusted mean ratio
        # (rough proxy since we don't have live FX)
        ratio         = submitted / (adjusted_mean * 1.2)  # 1.2x markup over producer price is fair
        fao_component = max(0, min(100, 100 - ((ratio - 1) * 80)))

    # Signal 3: WB adjusted mean ratio (20%)
    if adjusted_mean > 0:
        ratio_vs_mean  = submitted / adjusted_mean
        wb_component   = max(0, min(100, 100 - ((ratio_vs_mean - 1) * 60)))
    else:
        wb_component = 100

    # Weighted composite
    score = (
        z_component   * 0.50 +
        fao_component * 0.30 +
        wb_component  * 0.20
    )
    score = round(max(1, min(100, score)))

    # Label
    if score >= 90:
        label = "Excellent Deal"
    elif score >= 70:
        label = "Fair Price"
    elif score >= 50:
        label = "Slightly Above Market"
    elif score >= 30:
        label = "Overpriced"
    elif score >= 10:
        label = "Gouging"
    else:
        label = "Extreme Gouging"

    return {"score": score, "label": label}


# ── Negotiation targets ────────────────────────────────────────────────────────

def compute_negotiation_targets(analysis, community_weighted_mean):
    """
    Computes negotiation price targets from three signals:
      - Community weighted mean (50%)
      - FAO floor with fair markup (30%)
      - World Bank adjusted mean (20%)
    """
    city          = analysis.get("city")
    item          = analysis.get("item")
    adjusted_mean = analysis.get("adjusted_mean", 0)
    currency      = analysis.get("currency", "USD")

    # Signal 1: community weighted mean
    community_mean = community_weighted_mean or adjusted_mean

    # Signal 2: FAO floor with fair retail markup (2.5x farm gate is typical)
    fao_floor     = get_price_floor(city, item)
    fao_signal    = adjusted_mean  # fallback
    if fao_floor and fao_floor > 0:
        # Convert USD floor to local currency (rough: use ratio of adjusted_mean to known USD equivalent)
        fao_signal = fao_floor * 2.5 * (adjusted_mean / max(adjusted_mean, 1))

    # Signal 3: WB adjusted mean
    wb_signal = adjusted_mean

    # Weighted fair price
    fair_price = (
        community_mean * 0.50 +
        fao_signal     * 0.30 +
        wb_signal      * 0.20
    )

    symbol = CURRENCY_SYMBOLS.get(currency, currency + " ")

    return {
        "fair_price":    round(fair_price, 2),
        "counter_offer": round(fair_price * 0.88, 2),   # open 12% below fair
        "walk_away":     round(fair_price * 1.15, 2),   # ceiling 15% above fair
        "symbol":        symbol,
        "currency":      currency,
    }


# ── Claude API call ────────────────────────────────────────────────────────────

def get_insights(analysis, quality=None, amount=None, reporter_type=None, neighborhood=None):
    """
    Main entry point. Takes analyze_price() output from anomaly.py.
    Returns fairness score + negotiation targets + Claude-generated explanation and script.

    Optional args enrich the Claude prompt:
      quality       – int 1-10: buyer's quality rating of the goods
      amount        – str: quantity purchased, e.g. "1kg", "500g", "1 plate"
      reporter_type – 'tourist'|'local'|'student': affects negotiation tone
      neighborhood  – str: specific area within the market

    Full return shape:
    {
        "fairness_score":    { "score": 23, "label": "Gouging" },
        "negotiation": {
            "fair_price":    2800,
            "counter_offer": 2464,
            "walk_away":     3220,
            "symbol":        "₦",
            "currency":      "NGN"
        },
        "explanation":   "This tomato price is ...",
        "negotiation_script": "Here's exactly what to say ...",
        "summary_line":  "You're being charged 140% above market rate.",
    }
    """
    if "error" in analysis:
        return {"error": analysis["error"]}

    city      = analysis["city"]
    item      = analysis["item"]
    currency  = analysis["currency"]
    symbol    = CURRENCY_SYMBOLS.get(currency, currency + " ")
    submitted = analysis["submitted_price"]
    mean      = analysis["adjusted_mean"]
    z_score   = analysis["z_score"]
    severity  = analysis["severity"]
    is_gouged = analysis["is_gouged"]
    pct_above = analysis["percent_above"]
    adj_info  = analysis["adjustments"]

    # Normalise optional fields
    reporter_type = (reporter_type or "tourist").lower()
    reporter_label = {
        "tourist": "Tourist/Visitor",
        "local":   "Local resident",
        "student": "Student",
    }.get(reporter_type, "Visitor")

    # Reporter-type-specific negotiation tone instructions
    reporter_tone = {
        "tourist": (
            "The buyer is a tourist/visitor. Give them a confident, firm script. "
            "Suggest referencing other stalls ('I saw this cheaper next door') and "
            "being comfortable walking away — tourists often get quoted tourist prices."
        ),
        "local": (
            "The buyer is a local resident. They can use familiarity as leverage — "
            "mention they are a regular, use the local language if possible, and appeal "
            "to a long-term relationship with the vendor. Locals have more social leverage."
        ),
        "student": (
            "The buyer is a student on a tight budget. Encourage them to be upfront about it — "
            "many vendors respect students and may offer a small discount. Suggest buying "
            "in bulk or asking for a student-friendly price."
        ),
    }.get(reporter_type, "")

    # Quality context: low quality is leverage; high quality may justify higher price
    quality_context = ""
    if quality is not None:
        if quality <= 3:
            quality_context = (
                f"The buyer rated the quality as {quality}/10 — very poor. "
                "This is strong negotiating leverage: the goods are substandard and "
                "the price should reflect that. Mention quality issues explicitly in the script."
            )
        elif quality <= 6:
            quality_context = (
                f"The buyer rated the quality as {quality}/10 — average. "
                "Quality is neither a strong selling point nor a red flag."
            )
        else:
            quality_context = (
                f"The buyer rated the quality as {quality}/10 — good to excellent. "
                "High quality may partially justify a premium, but not above the walk-away ceiling."
            )

    # Amount context
    amount_context = f"Quantity/Amount: {amount}" if amount else "Quantity not specified."

    # Neighborhood context
    location_context = (
        f"Specific location within market: {neighborhood}." if neighborhood
        else "No specific neighborhood noted."
    )

    # Get community weighted mean
    community_mean, sample_size = _get_community_prices(city, item)

    # Compute scores and targets
    fairness       = compute_fairness_score(analysis)
    targets        = compute_negotiation_targets(analysis, community_mean)
    cultural_notes = CULTURAL_CONTEXT.get(city, "Polite negotiation is generally acceptable.")

    # Build prompt for Claude
    prompt = f"""You are MarketLens, a price transparency assistant helping travelers and locals avoid being overcharged in street markets.

A user just submitted a price report. Here is the full context:

LOCATION: {city}
ITEM: {item}
SUBMITTED PRICE: {symbol}{submitted} {currency}
MARKET AVERAGE (community): {symbol}{community_mean or mean} {currency}
FAIR PRICE ESTIMATE: {symbol}{targets['fair_price']} {currency}
Z-SCORE: {z_score} (threshold for gouging: 1.5)
SEVERITY: {severity}
PERCENT ABOVE MARKET: {pct_above}%
FAIRNESS SCORE: {fairness['score']}/100 ({fairness['label']})
IS FLAGGED AS GOUGING: {is_gouged}

ECONOMIC CONTEXT:
{adj_info['reason']}

BUYER CONTEXT:
- Reporter type: {reporter_label}
- {amount_context}
- {location_context}
{f'- Quality assessment: {quality_context}' if quality_context else ''}

CULTURAL NEGOTIATION NOTES FOR {city.upper()}:
{cultural_notes}

REPORTER-SPECIFIC TONE:
{reporter_tone}

NEGOTIATION TARGETS:
- Counter-offer (open with): {symbol}{targets['counter_offer']} {currency}
- Fair price (your goal): {symbol}{targets['fair_price']} {currency}
- Walk away price (ceiling): {symbol}{targets['walk_away']} {currency}

Please respond with a JSON object with exactly these three fields:

{{
  "explanation": "2-3 sentences explaining why this price is {'suspicious' if is_gouged else 'reasonable'}, referencing the economic context and any quality or location notes. Be specific, not generic.",
  "negotiation_script": "A practical word-for-word negotiation script the user can actually say to the vendor. Tailor it to the reporter type ({reporter_label}){' and mention the quality issues' if quality and quality <= 4 else ''}. Include what to open with, how to respond to pushback, and when to walk away. Make it culturally appropriate for {city}. 4-6 sentences.",
  "summary_line": "One punchy sentence summarizing the situation. If gouging, make it clear. If fair, reassure them."
}}

Respond ONLY with the JSON object. No markdown, no extra text."""

    try:
        message = client.messages.create(
            model      = "claude-sonnet-4-20250514",
            max_tokens = 1000,
            messages   = [{"role": "user", "content": prompt}]
        )

        raw      = message.content[0].text.strip()
        # Strip markdown fences if present
        raw      = raw.replace("```json", "").replace("```", "").strip()
        claude   = json.loads(raw)

    except json.JSONDecodeError:
        claude = {
            "explanation":        f"This price is {pct_above}% above the market average for {item} in {city}.",
            "negotiation_script": f"Try offering {symbol}{targets['counter_offer']} and don't go above {symbol}{targets['walk_away']}.",
            "summary_line":       f"Fairness score: {fairness['score']}/100 — {fairness['label']}.",
        }
    except Exception as e:
        print(f"  ⚠️  Claude API error: {e}")
        claude = {
            "explanation":        f"Price analysis complete. Z-score: {z_score}.",
            "negotiation_script": f"Suggest counter-offering at {symbol}{targets['counter_offer']}.",
            "summary_line":       f"{fairness['label']} — {fairness['score']}/100.",
        }

    return {
        "fairness_score":      fairness,
        "negotiation":         targets,
        "explanation":         claude["explanation"],
        "negotiation_script":  claude["negotiation_script"],
        "summary_line":        claude["summary_line"],
    }


# ── Market summary ─────────────────────────────────────────────────────────────

def get_market_summary(city, gouging_rate, top_flagged_items):
    """
    Generates a one-paragraph market briefing for the Market detail page.
    Called by GET /market/:id Flask route.
    """
    cultural_notes = CULTURAL_CONTEXT.get(city, "")
    pct            = round(gouging_rate * 100, 1)

    prompt = f"""You are MarketLens. Write a 2-3 sentence market briefing for {city}.

Data:
- Overall gouging rate: {pct}% of recent price reports flagged as suspicious
- Most flagged items: {', '.join(top_flagged_items) if top_flagged_items else 'none'}
- Cultural context: {cultural_notes}

Write a practical briefing that tells a traveler what to watch out for and what to expect. 
Be specific to this city and market. No fluff. Respond with plain text only, no JSON."""

    try:
        message = client.messages.create(
            model      = "claude-sonnet-4-20250514",
            max_tokens = 200,
            messages   = [{"role": "user", "content": prompt}]
        )
        return message.content[0].text.strip()

    except Exception as e:
        print(f"  ⚠️  Claude market summary error: {e}")
        return f"{city} currently has a {pct}% price gouging rate. Exercise caution when purchasing {', '.join(top_flagged_items[:2]) if top_flagged_items else 'staple goods'}."


# ── CLI test ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  MarketLens — Claude Insights Test")
    print("=" * 55)

    # Mock analysis output from anomaly.py
    mock_analysis = {
        "city":            "Lagos, Nigeria",
        "item":            "Fresh Tomatoes (Basket)",
        "submitted_price": 7500,
        "currency":        "NGN",
        "adjusted_mean":   3200.0,
        "adjusted_std":    420.0,
        "raw_mean":        2500.0,
        "raw_std":         310.0,
        "z_score":         10.24,
        "is_gouged":       True,
        "percent_above":   134.4,
        "severity":        "extreme",
        "adjustments": {
            "wb_multiplier":       1.293,
            "disaster_multiplier": 1.0,
            "combined":            1.293,
            "reason":              "Adjusted for 29.3% food inflation",
        }
    }

    print("\n🧪 Testing get_insights()...")
    result = get_insights(mock_analysis)

    print(f"\n  Fairness Score : {result['fairness_score']['score']}/100 — {result['fairness_score']['label']}")
    print(f"  Counter Offer  : {result['negotiation']['symbol']}{result['negotiation']['counter_offer']}")
    print(f"  Walk Away      : {result['negotiation']['symbol']}{result['negotiation']['walk_away']}")
    print(f"\n  Summary        : {result['summary_line']}")
    print(f"\n  Explanation    :\n  {result['explanation']}")
    print(f"\n  Script         :\n  {result['negotiation_script']}")

    print("\n🧪 Testing get_market_summary()...")
    summary = get_market_summary("Lagos, Nigeria", 0.18, ["Fresh Tomatoes (Basket)", "Beef (1kg)"])
    print(f"\n  {summary}")

    print("\n✅ Done.")