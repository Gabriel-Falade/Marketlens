import os
import requests
import json
from datetime import datetime, timedelta

# ── Country codes for our three markets ───────────────────────────────────────
COUNTRIES = {
    "Lagos, Nigeria":  "NGA",
    "Delhi, India":    "IND",
    "Metz, France":    "FRA",
}

# ── Indicators ─────────────────────────────────────────────────────────────────
INDICATORS = {
    "cpi":              "FP.CPI.TOTL.ZG",   # General inflation rate (annual %)
    "food_inflation":   "FP.FPI.TOTL.ZG",   # Food price inflation (annual %)
}

BASE_URL = "https://api.worldbank.org/v2"

# Simple file cache so we don't hammer the API on every request
CACHE_FILE  = "worldbank_cache.json"
CACHE_TTL_H = 12  # hours before refreshing


# ── Cache helpers ──────────────────────────────────────────────────────────────

def _load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            return json.load(f)
    return {}


def _save_cache(data):
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f, indent=2)


def _cache_is_fresh(cache, key):
    if key not in cache:
        return False
    cached_at = datetime.fromisoformat(cache[key]["cached_at"])
    return datetime.utcnow() - cached_at < timedelta(hours=CACHE_TTL_H)


# ── Core fetch ─────────────────────────────────────────────────────────────────

def _fetch_indicator(country_code, indicator, most_recent_n=3):
    """
    Fetch the most recent N years of a World Bank indicator for a country.
    Returns a list of { year, value } dicts, newest first.
    """
    url = (
        f"{BASE_URL}/country/{country_code}/indicator/{indicator}"
        f"?format=json&mrv={most_recent_n}&per_page={most_recent_n}"
    )
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        payload = resp.json()

        # World Bank returns [metadata, data_array]
        if len(payload) < 2 or not payload[1]:
            return []

        results = []
        for entry in payload[1]:
            if entry.get("value") is not None:
                results.append({
                    "year":  entry["date"],
                    "value": round(float(entry["value"]), 4),
                })
        return results

    except Exception as e:
        print(f"  ⚠️  World Bank fetch failed ({country_code} / {indicator}): {e}")
        return []


# ── Public API ─────────────────────────────────────────────────────────────────

def get_country_indicators(city_name):
    """
    Returns CPI + food inflation data for a given city name.

    Example return value:
    {
        "country_code": "NGA",
        "cpi": [
            { "year": "2023", "value": 24.66 },
            { "year": "2022", "value": 18.85 },
        ],
        "food_inflation": [
            { "year": "2023", "value": 29.32 },
            { "year": "2022", "value": 21.01 },
        ],
        "latest_cpi": 24.66,
        "latest_food_inflation": 29.32,
        "baseline_multiplier": 1.2466,   # 1 + (cpi% / 100)
        "cached_at": "2026-02-21T10:00:00"
    }
    """
    country_code = COUNTRIES.get(city_name)
    if not country_code:
        print(f"  ⚠️  No country code mapped for: {city_name}")
        return None

    cache     = _load_cache()
    cache_key = f"{country_code}_indicators"

    if _cache_is_fresh(cache, cache_key):
        print(f"  📦 Cache hit for {city_name} ({country_code})")
        return cache[cache_key]["data"]

    print(f"  🌐 Fetching World Bank data for {city_name} ({country_code})...")

    cpi_data   = _fetch_indicator(country_code, INDICATORS["cpi"])
    food_data  = _fetch_indicator(country_code, INDICATORS["food_inflation"])

    latest_cpi   = cpi_data[0]["value"]   if cpi_data   else 0.0
    latest_food  = food_data[0]["value"]  if food_data  else 0.0

    # baseline_multiplier: how much to scale fair prices upward due to inflation
    # e.g. 24.66% inflation → multiply baseline by 1.2466
    baseline_multiplier = round(1 + (latest_food / 100), 4) if latest_food else 1.0

    result = {
        "country_code":          country_code,
        "cpi":                   cpi_data,
        "food_inflation":        food_data,
        "latest_cpi":            latest_cpi,
        "latest_food_inflation": latest_food,
        "baseline_multiplier":   baseline_multiplier,
        "cached_at":             datetime.utcnow().isoformat(),
    }

    # Save to cache
    cache[cache_key] = {
        "cached_at": datetime.utcnow().isoformat(),
        "data":      result,
    }
    _save_cache(cache)

    return result


def get_all_countries():
    """
    Fetch indicators for all three cities at once.
    Returns a dict keyed by city name.
    """
    results = {}
    for city in COUNTRIES:
        data = get_country_indicators(city)
        if data:
            results[city] = data
    return results


def get_baseline_multiplier(city_name):
    """
    Quick helper — just returns the float multiplier for Z-score baseline adjustment.
    Falls back to 1.0 if fetch fails.
    """
    data = get_country_indicators(city_name)
    if data:
        return data["baseline_multiplier"]
    return 1.0


# ── CLI test ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  MarketLens — World Bank Indicator Fetch")
    print("=" * 55)

    all_data = get_all_countries()

    for city, data in all_data.items():
        print(f"\n📍 {city} ({data['country_code']})")
        print(f"   Latest CPI (general):      {data['latest_cpi']}%")
        print(f"   Latest Food Inflation:     {data['latest_food_inflation']}%")
        print(f"   Baseline Multiplier:       {data['baseline_multiplier']}x")
        print(f"   → Fair prices scaled UP by {round((data['baseline_multiplier'] - 1) * 100, 2)}%")

    print("\n✅ Done.")