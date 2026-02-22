import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import re
import json
import math
import time
import threading
import base64
import requests
import anthropic
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from models.anomaly import (
    compute_adjusted_baseline,
    analyze_price,
    compute_market_gouging_rate,
    get_market_color,
)
from models.claude_insights import get_insights, get_market_summary, save_price_report, migrate_db
from models.intelligence import get_intel_snapshot, get_all_intel, migrate_intel_db
from services.reliefweb import get_active_disasters

# 1. Load the variables from .env
load_dotenv()

app = Flask(__name__)
CORS(app)


# Fix NaN/Infinity/-Infinity that React Native's Hermes JSON parser rejects.
# Regex word-boundary approach fails for -Infinity, so we parse → sanitize → re-dump.
def _sanitize_floats(obj):
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, dict):
        return {k: _sanitize_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_floats(v) for v in obj]
    return obj

@app.after_request
def fix_nan_in_json(response):
    if response.content_type and 'application/json' in response.content_type:
        body = response.get_data(as_text=True)
        try:
            data = json.loads(body)          # Python json.loads accepts NaN/Infinity
            data = _sanitize_floats(data)    # replace them with None → null
            response.set_data(json.dumps(data))
        except Exception:
            pass
    return response

GOOGLE_VISION_KEY  = os.getenv("GOOGLE_VISION_API_KEY")
ANTHROPIC_KEY      = os.getenv("ANTHROPIC_API_KEY")
_anthropic_client  = anthropic.Anthropic(api_key=ANTHROPIC_KEY) if ANTHROPIC_KEY else None

# ── Server-side response cache (5-min TTL) ─────────────────────────────────────
_cache: dict = {}
_cache_lock = threading.Lock()
CACHE_TTL = 5 * 60  # seconds

def _cache_get(key):
    with _cache_lock:
        entry = _cache.get(key)
        if entry and time.time() - entry["ts"] < CACHE_TTL:
            return entry["data"]
    return None

def _cache_set(key, data):
    with _cache_lock:
        _cache[key] = {"data": data, "ts": time.time()}

# ── Market definitions ─────────────────────────────────────────────────────────
MARKETS = [
    {
        "id":       "lagos",
        "name":     "Balogun Market",
        "city":     "Lagos, Nigeria",
        "country":  "Nigeria",
        "lat":      6.4534,
        "lng":      3.3893,
        "currency": "NGN",
        "symbol":   "₦",
    },
    {
        "id":       "delhi",
        "name":     "Chandni Chowk Market",
        "city":     "Delhi, India",
        "country":  "India",
        "lat":      28.6505,
        "lng":      77.2303,
        "currency": "INR",
        "symbol":   "₹",
    },
    {
        "id":       "metz",
        "name":     "Marché de Metz",
        "city":     "Metz, France",
        "country":  "France",
        "lat":      49.1193,
        "lng":      6.1727,
        "currency": "EUR",
        "symbol":   "€",
    },
]

MARKET_BY_ID = {m["id"]: m for m in MARKETS}

# Items per market
MARKET_ITEMS = {
    "lagos": [
        "Imported Rice (50kg bag)",
        "Beef (1kg)",
        "Titus Fish (frozen, 1kg)",
        "Fresh Tomatoes (Basket)",
        "Eggs (crate of 30)",
        "Suya (100g skewer)",
        "Jollof Rice (plate)",
        "Ankara Fabric (6 yards)",
    ],
    "delhi": [
        "Basmati Rice (1kg)",
        "Chicken (1kg)",
        "Eggs (dozen)",
        "Dal/Lentils (1kg)",
        "Paneer (200g)",
        "Chole Bhature (plate)",
        "Masala Chai (cup)",
        "Hand-painted Scarf",
    ],
    "metz": [
        "Whole Chicken",
        "Mirabelle Jam",
        "Eggs (dozen)",
        "Rice (1kg)",
        "Quiche Lorraine (slice)",
        "Baguette",
        "GT Hoodie",
        "Wool Scarf",
    ],
}

# Vision API label → our item names
VISION_ITEM_MAP = {
    "rice":        {"lagos": "Imported Rice (50kg bag)", "delhi": "Basmati Rice (1kg)", "metz": "Rice (1kg)"},
    "tomato":      {"lagos": "Fresh Tomatoes (Basket)",  "delhi": "Fresh Tomatoes (Basket)", "metz": "Fresh Tomatoes (Basket)"},
    "chicken":     {"lagos": "Suya (100g skewer)",       "delhi": "Chicken (1kg)",      "metz": "Whole Chicken"},
    "egg":         {"lagos": "Eggs (crate of 30)",       "delhi": "Eggs (dozen)",       "metz": "Eggs (dozen)"},
    "bread":       {"lagos": "Jollof Rice (plate)",      "delhi": "Chole Bhature (plate)", "metz": "Baguette"},
    "beef":        {"lagos": "Beef (1kg)",               "delhi": "Dal/Lentils (1kg)",  "metz": "Whole Chicken"},
    "fish":        {"lagos": "Titus Fish (frozen, 1kg)", "delhi": "Chicken (1kg)",      "metz": "Whole Chicken"},
    "fabric":      {"lagos": "Ankara Fabric (6 yards)",  "delhi": "Hand-painted Scarf", "metz": "Wool Scarf"},
    "scarf":       {"lagos": "Ankara Fabric (6 yards)",  "delhi": "Hand-painted Scarf", "metz": "Wool Scarf"},
    "fruit":       {"lagos": "Fresh Tomatoes (Basket)",  "delhi": "Fresh Tomatoes (Basket)", "metz": "Mirabelle Jam"},
    "vegetable":   {"lagos": "Fresh Tomatoes (Basket)",  "delhi": "Fresh Tomatoes (Basket)", "metz": "Fresh Tomatoes (Basket)"},
    "meat":        {"lagos": "Beef (1kg)",               "delhi": "Chicken (1kg)",      "metz": "Whole Chicken"},
}


# ── Health check ───────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "MarketLens API"})


# ── GET /markets ───────────────────────────────────────────────────────────────

@app.route("/markets", methods=["GET"])
def get_markets():
    """
    Returns all markets with gouging rates and heatmap colors.
    Used by the Map page.
    """
    result = []
    for market in MARKETS:
        gouging_rate = compute_market_gouging_rate(market["city"])
        color        = get_market_color(gouging_rate)

        # Check for active disasters
        disaster_data = get_active_disasters(market["city"])
        has_disaster  = disaster_data.get("has_active_disaster", False)

        result.append({
            **market,
            "gouging_rate":    gouging_rate,
            "gouging_pct":     round(gouging_rate * 100, 1),
            "color":           color,
            "has_disaster":    has_disaster,
            "disaster_count":  len(disaster_data.get("disasters", [])),
        })

    return jsonify(result)


# ── GET /heatmap ───────────────────────────────────────────────────────────────

@app.route("/heatmap", methods=["GET"])
def get_heatmap():
    """
    Simplified heatmap data — just coords + color + gouging rate.
    """
    result = []
    for market in MARKETS:
        gouging_rate = compute_market_gouging_rate(market["city"])
        color        = get_market_color(gouging_rate)
        result.append({
            "id":          market["id"],
            "name":        market["name"],
            "lat":         market["lat"],
            "lng":         market["lng"],
            "color":       color,
            "gouging_pct": round(gouging_rate * 100, 1),
        })

    return jsonify(result)


# ── GET /market/<id> ───────────────────────────────────────────────────────────

def _build_market_payload(market_id):
    """Builds the full market detail payload. Called by both the route and warmup."""
    market = MARKET_BY_ID[market_id]
    city   = market["city"]
    items  = MARKET_ITEMS.get(market_id, [])

    # ── Compute all item baselines in parallel ──────────────────────────────
    def fetch_baseline(item_name):
        return item_name, compute_adjusted_baseline(city, item_name)

    with ThreadPoolExecutor(max_workers=min(8, len(items))) as ex:
        results = list(ex.map(fetch_baseline, items))

    gouging_rate = compute_market_gouging_rate(city)
    item_data, top_flagged = [], []

    for item_name, baseline in results:
        if "error" in baseline:
            continue
        if gouging_rate > 0.15:
            top_flagged.append(item_name)
        item_data.append({
            "name":           item_name,
            "mean":           baseline["adjusted_mean"],
            "std":            baseline["adjusted_std"],
            "min":            baseline["price_floor"],
            "max":            baseline["price_ceiling"],
            "raw_mean":       baseline["raw_mean"],
            "sample_size":    baseline["sample_size"],
            "wb_multiplier":  baseline["wb_multiplier"],
            "dis_multiplier": baseline["disaster_multiplier"],
        })

    # ── These two can also run in parallel ─────────────────────────────────
    with ThreadPoolExecutor(max_workers=2) as ex:
        summary_f      = ex.submit(get_market_summary, city, gouging_rate, top_flagged[:3])
        disaster_f     = ex.submit(get_active_disasters, city)
        summary        = summary_f.result()
        disaster_data  = disaster_f.result()

    return {
        **market,
        "gouging_rate":   gouging_rate,
        "gouging_pct":    round(gouging_rate * 100, 1),
        "color":          get_market_color(gouging_rate),
        "items":          item_data,
        "market_summary": summary,
        "disasters":      disaster_data.get("disasters", []),
        "has_disaster":   disaster_data.get("has_active_disaster", False),
    }


@app.route("/market/<market_id>", methods=["GET"])
def get_market(market_id):
    """
    Market detail — items with price ranges and trend data.
    Used by the Market detail page.
    """
    if market_id not in MARKET_BY_ID:
        return jsonify({"error": f"Market '{market_id}' not found"}), 404

    cached = _cache_get(f"market:{market_id}")
    if cached:
        return jsonify(cached)

    payload = _build_market_payload(market_id)
    _cache_set(f"market:{market_id}", payload)
    return jsonify(payload)


# ── POST /price/submit ─────────────────────────────────────────────────────────

@app.route("/price/submit", methods=["POST"])
def submit_price():
    """
    Core endpoint — submit a price, get back gouging analysis,
    bell curve data, fairness score, and negotiation advice.

    Body: { market_id, item_name, submitted_price, quality?, amount?, reporter_type?, neighborhood? }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    market_id       = data.get("market_id")
    item_name       = data.get("item_name")
    submitted_price = data.get("submitted_price")

    # Optional enrichment fields from the new report form
    quality       = data.get("quality")        # int 1-10 or None
    amount        = data.get("amount")         # str e.g. "1kg", "500g"
    reporter_type = data.get("reporter_type", "tourist")  # 'tourist'|'local'|'student'
    neighborhood  = data.get("neighborhood")   # str or None
    dry_run       = bool(data.get("dry_run", False))  # True = analyse only, don't save

    if not all([market_id, item_name, submitted_price]):
        return jsonify({"error": "market_id, item_name, and submitted_price are required"}), 400

    market = MARKET_BY_ID.get(market_id)
    if not market:
        return jsonify({"error": f"Market '{market_id}' not found"}), 404

    try:
        submitted_price = float(submitted_price)
    except (ValueError, TypeError):
        return jsonify({"error": "submitted_price must be a number"}), 400

    # Run anomaly detection
    analysis = analyze_price(market["city"], item_name, submitted_price)
    if "error" in analysis:
        return jsonify(analysis), 400

    # Get Claude insights + fairness score + negotiation (enriched with reporter context)
    insights = get_insights(
        analysis,
        quality=quality,
        amount=amount,
        reporter_type=reporter_type,
        neighborhood=neighborhood,
    )

    # Persist this report to the community dataset (skipped if dry_run=True)
    report_id = None
    if not dry_run:
        report_id = save_price_report(
            city          = market["city"],
            lat           = market["lat"],
            lng           = market["lng"],
            item_name     = item_name,
            category      = None,
            price         = submitted_price,
            currency      = market["currency"],
            is_gouging    = analysis.get("is_gouged", False),
            reporter_type = reporter_type,
            quality       = quality,
            amount        = amount,
            neighborhood  = neighborhood,
            percent_above = analysis.get("percent_above"),
        )

    return jsonify({
        **analysis,
        **insights,
        "report_saved": report_id is not None,
        "report_id":    report_id,
    })


# ── POST /identify ─────────────────────────────────────────────────────────────

@app.route("/identify", methods=["POST"])
def identify_item():
    """
    XR endpoint — send base64 image, get back identified item + price range.
    Body: { image_base64: "...", market_id: "lagos" }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    image_b64 = data.get("image_base64")
    market_id = data.get("market_id", "lagos")

    if not image_b64:
        return jsonify({"error": "image_base64 is required"}), 400

    market = MARKET_BY_ID.get(market_id)
    if not market:
        return jsonify({"error": f"Market '{market_id}' not found"}), 404

    # Call Google Cloud Vision API
    identified_item = None
    vision_label    = None

    if GOOGLE_VISION_KEY:
        try:
            vision_url = f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_VISION_KEY}"
            vision_payload = {
                "requests": [{
                    "image":    {"content": image_b64},
                    "features": [{"type": "LABEL_DETECTION", "maxResults": 10}],
                }]
            }
            vision_resp = requests.post(vision_url, json=vision_payload, timeout=10)
            vision_resp.raise_for_status()
            labels = vision_resp.json().get("responses", [{}])[0].get("labelAnnotations", [])

            # Match first label that we know about
            for label in labels:
                desc  = label.get("description", "").lower()
                score = label.get("score", 0)
                if score < 0.7:
                    continue
                for keyword, market_map in VISION_ITEM_MAP.items():
                    if keyword in desc:
                        vision_label    = desc
                        identified_item = market_map.get(market_id)
                        break
                if identified_item:
                    break

        except Exception as e:
            print(f"  ⚠️  Vision API error: {e}")

    # Fallback: use Claude vision to identify the item
    if not identified_item and _anthropic_client:
        try:
            items_list = MARKET_ITEMS.get(market_id, [])
            msg = _anthropic_client.messages.create(
                model      = "claude-haiku-4-5-20251001",
                max_tokens = 50,
                messages   = [{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type":       "base64",
                                "media_type": "image/jpeg",
                                "data":        image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "Which item from this list is shown in the photo? "
                                "Reply with ONLY the exact item name, nothing else.\n\n"
                                + "\n".join(items_list)
                            ),
                        },
                    ],
                }],
            )
            claude_pick = msg.content[0].text.strip()
            if claude_pick in items_list:
                identified_item = claude_pick
                vision_label    = "claude-vision"
        except Exception as e:
            print(f"  ⚠️  Claude vision error: {e}")

    # Final fallback
    if not identified_item:
        identified_item = MARKET_ITEMS.get(market_id, ["Unknown Item"])[0]
        vision_label    = "fallback"

    # Get price range for identified item
    baseline = compute_adjusted_baseline(market["city"], identified_item)

    if "error" in baseline:
        return jsonify({
            "identified_item": identified_item,
            "vision_label":    vision_label,
            "market_id":       market_id,
            "price_range":     None,
            "error":           baseline["error"],
        })

    return jsonify({
        "identified_item": identified_item,
        "vision_label":    vision_label,
        "market_id":       market_id,
        "market_name":     market["name"],
        "currency":        market["currency"],
        "symbol":          market["symbol"],
        "price_range": {
            "min":    baseline["price_floor"],
            "max":    baseline["price_ceiling"],
            "mean":   baseline["adjusted_mean"],
        },
    })


# ── GET /intel/global ──────────────────────────────────────────────────────────

@app.route("/intel/global", methods=["GET"])
def get_global_intel():
    """All-market intelligence snapshot + global composite. Used by the Intelligence page."""
    cached = _cache_get("intel:global")
    if cached:
        return jsonify(cached)
    data = get_all_intel()
    _cache_set("intel:global", data)
    return jsonify(data)


# ── GET /intel/<market_id> ─────────────────────────────────────────────────────

@app.route("/intel/<market_id>", methods=["GET"])
def get_market_intel(market_id):
    """Single-market intelligence snapshot."""
    market = MARKET_BY_ID.get(market_id)
    if not market:
        return jsonify({"error": f"Market '{market_id}' not found"}), 404
    cached = _cache_get(f"intel:{market_id}")
    if cached:
        return jsonify(cached)
    snap              = get_intel_snapshot(market["city"])
    snap["market_id"] = market_id
    snap["name"]      = market["name"]
    snap["city"]      = market["city"]
    _cache_set(f"intel:{market_id}", snap)
    return jsonify(snap)


# ── GET /intel/history/<market_id> ────────────────────────────────────────────

@app.route("/intel/history/<market_id>", methods=["GET"])
def get_market_intel_history(market_id):
    """8-week historical III + volatility series for sparklines."""
    market = MARKET_BY_ID.get(market_id)
    if not market:
        return jsonify({"error": f"Market '{market_id}' not found"}), 404
    snap = get_intel_snapshot(market["city"])
    return jsonify(snap.get("history", []))


# ── GET /intel/export ─────────────────────────────────────────────────────────

@app.route("/intel/export", methods=["GET"])
def export_intel():
    """
    B2B data export — full indices + methodology + history for all markets.
    In production: gate this behind an API key (X-API-Key header).
    """
    cached = _cache_get("intel:export")
    if cached:
        return jsonify(cached)
    data   = get_all_intel()
    export = {
        "version":          "1.0",
        "source":           "MarketLens Intelligence API",
        "generated":        data["generated_at"],
        "markets":          data["markets"],
        "global_composite": data["global"],
        "methodology": {
            "iii":        "Mean % deviation from WB+ReliefWeb adjusted baseline (30d window)",
            "volatility": "Normalized CoV across items (14d window); 0=stable, 1=extreme",
            "pta":        "% change in 7d mean price vs prior 7d — acceleration signal",
            "rid":        "III minus official food CPI — informal vs official inflation gap (pp)",
            "shock_score":"Spike in 3d gouging rate vs 30d baseline, weighted by submission density",
            "confidence": "Composite: volume (30-report baseline) × reporter diversity × recency",
        },
    }
    _cache_set("intel:export", export)
    return jsonify(export)


# ── Startup cache warmup ───────────────────────────────────────────────────────

def _warmup():
    """Pre-build all 3 market payloads in the background so first requests are instant."""
    print("  🔥 Warming market cache in background...")
    for mid in MARKET_BY_ID:
        try:
            payload = _build_market_payload(mid)
            _cache_set(f"market:{mid}", payload)
            print(f"  ✅ Cached {mid}")
        except Exception as e:
            print(f"  ⚠️  Warmup failed for {mid}: {e}")
    print("  🔥 Cache warm — all markets ready")

# Run DB migrations at startup
migrate_db()        # reporter_type / quality / amount / percent_above columns
migrate_intel_db()  # percent_above column (idempotent — safe double-call)

# Fire warmup in a daemon thread so it doesn't block Flask startup
threading.Thread(target=_warmup, daemon=True).start()


# ── Run ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  MarketLens API — Starting")
    print("=" * 55)
    print("  GET  /health")
    print("  GET  /markets")
    print("  GET  /heatmap")
    print("  GET  /market/<id>       (lagos | delhi | metz)")
    print("  POST /price/submit")
    print("  POST /identify")
    print("  GET  /intel/global")
    print("  GET  /intel/<id>        (lagos | delhi | metz)")
    print("  GET  /intel/history/<id>")
    print("  GET  /intel/export")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5000, debug=True)