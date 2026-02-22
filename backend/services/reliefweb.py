import os
import requests
import json
from datetime import datetime, timedelta

# ── Country mapping ────────────────────────────────────────────────────────────
COUNTRIES = {
    "Lagos, Nigeria": "nigeria",
    "Delhi, India":   "india",
    "Metz, France":   "france",
}

# ── Disaster type → affected item categories ──────────────────────────────────
# When a disaster hits, these item categories get their baseline raised
DISASTER_IMPACT = {
    "drought":        {"categories": ["Staple"],              "multiplier": 1.35},
    "flood":          {"categories": ["Staple", "Street Food"], "multiplier": 1.28},
    "cyclone":        {"categories": ["Staple", "Street Food", "Merchandise"], "multiplier": 1.40},
    "epidemic":       {"categories": ["Staple"],              "multiplier": 1.20},
    "food insecurity":{"categories": ["Staple", "Street Food"], "multiplier": 1.30},
    "locust":         {"categories": ["Staple"],              "multiplier": 1.45},
    "conflict":       {"categories": ["Staple", "Street Food", "Merchandise"], "multiplier": 1.50},
    "default":        {"categories": [],                      "multiplier": 1.10},
}

BASE_URL   = "https://api.reliefweb.int/v1"
APP_NAME   = "marketlens-hacklytics"   # ReliefWeb asks for an app name, no key needed

CACHE_FILE  = "reliefweb_cache.json"
CACHE_TTL_H = 6   # disasters can change faster than CPI, refresh every 6hrs


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


# ── Disaster type parser ───────────────────────────────────────────────────────

def _parse_disaster_type(disaster_name):
    """
    Map a ReliefWeb disaster name to one of our known impact types.
    Falls back to 'default' if no match found.
    """
    name_lower = disaster_name.lower()
    for key in DISASTER_IMPACT:
        if key in name_lower:
            return key
    return "default"


# ── Core fetch ─────────────────────────────────────────────────────────────────

def _fetch_disasters(country_name):
    """
    Fetch active/ongoing disasters for a country from ReliefWeb.
    Returns a list of disaster dicts.
    """
    url = f"{BASE_URL}/disasters?appname={APP_NAME}"

    payload = {
        "filter": {
            "operator": "AND",
            "conditions": [
                {
                    "field": "country.name",
                    "value": country_name.title(),
                },
                {
                    "field": "status",
                    "value": ["ongoing", "alert"],
                    "operator": "OR",
                },
            ],
        },
        "fields": {
            "include": ["name", "type", "status", "date", "country", "description"],
        },
        "sort":  ["date.created:desc"],
        "limit": 10,
    }

    try:
        resp = requests.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        disasters = []
        for item in data.get("data", []):
            fields       = item.get("fields", {})
            raw_type     = fields.get("type", [{}])
            type_name    = raw_type[0].get("name", "Unknown") if raw_type else "Unknown"
            disaster_key = _parse_disaster_type(type_name)
            impact       = DISASTER_IMPACT[disaster_key]

            disasters.append({
                "name":               fields.get("name", "Unknown"),
                "type":               type_name,
                "disaster_key":       disaster_key,
                "status":             fields.get("status", "unknown"),
                "date":               fields.get("date", {}).get("created", ""),
                "affected_categories": impact["categories"],
                "baseline_multiplier": impact["multiplier"],
            })

        return disasters

    except Exception as e:
        print(f"  ⚠️  ReliefWeb fetch failed ({country_name}): {e}")
        return []


# ── Public API ─────────────────────────────────────────────────────────────────

def get_active_disasters(city_name):
    """
    Returns active disasters and their price impact for a given city.

    Example return:
    {
        "city": "Lagos, Nigeria",
        "country": "nigeria",
        "disasters": [
            {
                "name": "Nigeria: Floods 2025",
                "type": "Flood",
                "disaster_key": "flood",
                "status": "ongoing",
                "affected_categories": ["Staple", "Street Food"],
                "baseline_multiplier": 1.28,
            }
        ],
        "highest_multiplier": 1.28,
        "affected_categories": ["Staple", "Street Food"],
        "has_active_disaster": True,
        "cached_at": "2026-02-21T10:00:00"
    }
    """
    country = COUNTRIES.get(city_name)
    if not country:
        print(f"  ⚠️  No country mapped for: {city_name}")
        return _empty_result(city_name)

    cache     = _load_cache()
    cache_key = f"{country}_disasters"

    if _cache_is_fresh(cache, cache_key):
        print(f"  📦 Cache hit for {city_name} disasters")
        return cache[cache_key]["data"]

    print(f"  🌐 Fetching ReliefWeb disasters for {city_name} ({country})...")

    disasters = _fetch_disasters(country)

    # Aggregate: find the highest multiplier across all active disasters
    highest_multiplier = 1.0
    all_affected       = set()

    for d in disasters:
        if d["baseline_multiplier"] > highest_multiplier:
            highest_multiplier = d["baseline_multiplier"]
        all_affected.update(d["affected_categories"])

    result = {
        "city":                city_name,
        "country":             country,
        "disasters":           disasters,
        "highest_multiplier":  highest_multiplier,
        "affected_categories": list(all_affected),
        "has_active_disaster": len(disasters) > 0,
        "cached_at":           datetime.utcnow().isoformat(),
    }

    cache[cache_key] = {
        "cached_at": datetime.utcnow().isoformat(),
        "data":      result,
    }
    _save_cache(cache)

    return result


def get_all_cities():
    """Fetch disaster data for all three cities at once."""
    return {city: get_active_disasters(city) for city in COUNTRIES}


def get_category_multiplier(city_name, category):
    """
    Quick helper for anomaly.py — returns the disaster multiplier
    for a specific item category in a city.
    Falls back to 1.0 if no relevant disaster.

    Usage:
        multiplier = get_category_multiplier("Lagos, Nigeria", "Staple")
    """
    data = get_active_disasters(city_name)
    if not data or not data["has_active_disaster"]:
        return 1.0
    if category in data["affected_categories"]:
        return data["highest_multiplier"]
    return 1.0


def _empty_result(city_name):
    return {
        "city":                city_name,
        "country":             None,
        "disasters":           [],
        "highest_multiplier":  1.0,
        "affected_categories": [],
        "has_active_disaster": False,
        "cached_at":           datetime.utcnow().isoformat(),
    }


# ── CLI test ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  MarketLens — ReliefWeb Disaster Fetch")
    print("=" * 55)

    all_data = get_all_cities()

    for city, data in all_data.items():
        print(f"\n📍 {city}")
        if not data["has_active_disaster"]:
            print("   ✅ No active disasters — baseline unaffected")
        else:
            print(f"   🚨 {len(data['disasters'])} active disaster(s) found:")
            for d in data["disasters"]:
                print(f"      • {d['name']} ({d['type']}, {d['status']})")
                print(f"        Affects: {d['affected_categories']}")
                print(f"        Multiplier: {d['baseline_multiplier']}x")
            print(f"   → Highest multiplier applied: {data['highest_multiplier']}x")
            print(f"   → Affected categories: {data['affected_categories']}")

    print("\n✅ Done.")