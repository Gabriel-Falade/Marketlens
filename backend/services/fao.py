import os
import json
import pandas as pd

# ── File paths ─────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data", "raw")

FAO_FILES = {
    "west_africa": os.path.join(DATA_DIR, "fao_west_africa_producer_prices.csv"),
    "india":       os.path.join(DATA_DIR, "fao_india_producer_prices.csv"),
    "france":      os.path.join(DATA_DIR, "fao_france_producer_prices.csv"),
}

# ── City → FAO region mapping ──────────────────────────────────────────────────
CITY_REGION = {
    "Lagos, Nigeria": "west_africa",
    "Delhi, India":   "india",
    "Metz, France":   "france",
}

# ── West Africa countries weighted by proximity to Lagos ──────────────────────
WEST_AFRICA_WEIGHTS = {
    "Nigeria":        3.0,
    "Benin":          2.5,
    "Ghana":          2.0,
    "Togo":           1.8,
    "Niger":          1.5,
    "Senegal":        1.0,
    "Cote d'Ivoire":  1.0,
    "Mali":           0.8,
    "Burkina Faso":   0.8,
    "Guinea":         0.6,
    "Sierra Leone":   0.5,
    "Liberia":        0.5,
    "Gambia":         0.4,
    "Guinea-Bissau":  0.3,
    "Cabo Verde":     0.2,
    "Mauritania":     0.2,
}

# ── Shared fallback item map ───────────────────────────────────────────────────
ITEM_MAP = {
    "Tomatoes":                                                    "Fresh Tomatoes (Basket)",
    "Hen eggs in shell, fresh":                                    "Eggs (dozen)",
    "Meat of cattle with the bone, fresh or chilled":              "Beef (1kg)",
    "Meat of cattle with the bone, fresh or chilled (biological)": "Beef (1kg)",
    "Onions and shallots, dry (excluding dehydrated)":             "Onions per kg",
    "Lentils, dry":                                                "Chole Bhature (plate)",
    "Cow peas, dry":                                               "Eggs (crate of 30)",
    "Wheat":                                                       "Baguette",
}

# ── Region-specific overrides — checked BEFORE ITEM_MAP ───────────────────────
ITEM_MAP_OVERRIDES = {
    "west_africa": {
        "Rice":                                                "Imported Rice (50kg bag)",
        "Meat of chickens, fresh or chilled":                  "Suya (100g skewer)",
        "Meat of chickens, fresh or chilled (biological)":     "Suya (100g skewer)",
    },
    "india": {
        "Rice":                                                "Basmati Rice (1kg)",
        "Meat of chickens, fresh or chilled":                  "Chicken (1kg)",
        "Meat of chickens, fresh or chilled (biological)":     "Chicken (1kg)",
    },
    "france": {
        "Rice":                                                "Rice (1kg)",
        "Meat of chickens, fresh or chilled":                  "Whole Chicken",
    },
}

CACHE_FILE = "fao_cache.json"


# ── Cache helpers ──────────────────────────────────────────────────────────────

def _load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            return json.load(f)
    return {}


def _save_cache(data):
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


# ── CSV loader ─────────────────────────────────────────────────────────────────

def _load_csv(region):
    filepath = FAO_FILES.get(region)
    if not filepath or not os.path.exists(filepath):
        print(f"  ⚠️  FAO CSV not found: {filepath}")
        return None
    try:
        try:
            df = pd.read_csv(filepath, encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(filepath, encoding="latin-1")
        df.columns = df.columns.str.strip()
        print(f"  📂 Loaded {region} CSV: {len(df)} rows")
        return df
    except Exception as e:
        print(f"  ⚠️  Failed to load {region}: {e}")
        return None


# ── Core parser ────────────────────────────────────────────────────────────────

def _parse_producer_prices(df, region):
    results = {}

    # Detect columns
    col_map = {}
    for col in df.columns:
        cl = col.lower().strip()
        if cl == "item":
            col_map["item"] = col
        elif cl == "area":
            col_map["area"] = col
        elif cl == "year":
            col_map["year"] = col
        elif cl == "value":
            col_map["value"] = col
        elif cl == "element":
            col_map["element"] = col
        elif cl == "months code":
            col_map["months_code"] = col

    required = ["item", "value", "year"]
    missing  = [r for r in required if r not in col_map]
    if missing:
        print(f"  ⚠️  Missing columns in {region}: {missing}")
        return {}

    # Filter to USD/tonne producer prices only
    if "element" in col_map:
        df = df[df[col_map["element"]].str.contains("USD/tonne", na=False)]

    # Keep only annual values (7021) since that's what was downloaded
    if "months_code" in col_map:
        df = df[df[col_map["months_code"]] == 7021]

    if df.empty:
        print(f"  ⚠️  No rows left after filtering for {region}")
        return {}

    region_overrides = ITEM_MAP_OVERRIDES.get(region, {})

    for _, row in df.iterrows():
        fao_item = str(row.get(col_map["item"], "")).strip()

        # Region override first, then shared map
        our_item = region_overrides.get(fao_item) or ITEM_MAP.get(fao_item)
        if not our_item:
            continue

        value = row.get(col_map["value"])
        if pd.isna(value) or value == 0:
            continue

        # USD/tonne → USD/kg
        price_per_kg = round(float(value) / 1000, 6)
        year         = int(row.get(col_map["year"], 0))
        country      = str(row.get(col_map.get("area", "area"), "Unknown")).strip()
        weight       = WEST_AFRICA_WEIGHTS.get(country, 0.5) if region == "west_africa" else 1.0

        if our_item not in results:
            results[our_item] = {"entries": []}

        results[our_item]["entries"].append({
            "year":             year,
            "price_usd_per_kg": price_per_kg,
            "country":          country,
            "weight":           weight,
        })

    # Post-process each item
    for item_name, data in results.items():
        entries = data["entries"]
        if not entries:
            continue

        # Sort newest first
        entries.sort(key=lambda x: x["year"], reverse=True)
        latest_year    = entries[0]["year"]
        recent_entries = [e for e in entries if e["year"] == latest_year]

        # Weighted average for west africa, simple average otherwise
        if region == "west_africa":
            total_weight = sum(e["weight"] for e in recent_entries)
            latest_price = (
                sum(e["price_usd_per_kg"] * e["weight"] for e in recent_entries) / total_weight
                if total_weight > 0 else recent_entries[0]["price_usd_per_kg"]
            )
        else:
            latest_price = sum(e["price_usd_per_kg"] for e in recent_entries) / len(recent_entries)

        # Trend vs previous year
        prev_entries = [e for e in entries if e["year"] == latest_year - 1]
        trend = "stable"
        if prev_entries:
            prev_avg   = sum(e["price_usd_per_kg"] for e in prev_entries) / len(prev_entries)
            pct_change = (latest_price - prev_avg) / prev_avg if prev_avg else 0
            if pct_change > 0.05:
                trend = "rising"
            elif pct_change < -0.05:
                trend = "falling"

        data["latest_price_usd_per_kg"] = round(latest_price, 4)
        data["latest_year"]             = latest_year
        data["trend"]                   = trend

    return results


# ── Public API ─────────────────────────────────────────────────────────────────

def get_producer_prices(city_name):
    region = CITY_REGION.get(city_name)
    if not region:
        print(f"  ⚠️  No FAO region mapped for: {city_name}")
        return None

    cache     = _load_cache()
    cache_key = f"fao_{region}"

    if cache_key in cache:
        print(f"  📦 FAO cache hit for {city_name}")
        return cache[cache_key]

    print(f"  📂 Parsing FAO CSV for {city_name} ({region})...")
    df = _load_csv(region)
    if df is None:
        return None

    items  = _parse_producer_prices(df, region)
    result = {"city": city_name, "region": region, "items": items}

    cache[cache_key] = result
    _save_cache(cache)
    return result


def get_price_floor(city_name, item_name):
    """Returns FAO producer price floor in USD/kg. Falls back to None."""
    data = get_producer_prices(city_name)
    if not data or "items" not in data:
        return None
    item_data = data["items"].get(item_name)
    if not item_data:
        return None
    return item_data.get("latest_price_usd_per_kg")


def get_price_trend(city_name, item_name):
    """Returns 'rising', 'falling', or 'stable'."""
    data = get_producer_prices(city_name)
    if not data or "items" not in data:
        return "unknown"
    item_data = data["items"].get(item_name)
    if not item_data:
        return "unknown"
    return item_data.get("trend", "unknown")


def get_all_cities():
    return {city: get_producer_prices(city) for city in CITY_REGION}


# ── CLI test ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  MarketLens — FAO Producer Price Parser")
    print("=" * 55)

    all_data = get_all_cities()

    for city, data in all_data.items():
        print(f"\n📍 {city} ({data['region']})")
        if not data["items"]:
            print("   ⚠️  No matching items found")
        for item_name, item_data in data["items"].items():
            print(f"   • {item_name}")
            print(f"     Floor : ${item_data['latest_price_usd_per_kg']}/kg (USD)")
            print(f"     Year  : {item_data['latest_year']}")
            print(f"     Trend : {item_data['trend']}")

    print("\n✅ Done.")