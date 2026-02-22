import os
import random
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# ── Neighborhood Hotspots ──────────────────────────────────────────────────────
NEIGHBORHOODS = [
    {
        "name": "Marché de Metz (Local Market)",
        "lat": 49.1193,
        "lng": 6.1727,
        "price_modifier": 1.0,   # baseline — locals shop here
    },
    {
        "name": "Place Saint-Jacques (Tourist Trap)",
        "lat": 49.1204,
        "lng": 6.1756,
        "price_modifier": 1.5,   # tourist premium
    },
    {
        "name": "Quartier Pontiffroy (Student Zone)",
        "lat": 49.1221,
        "lng": 6.1698,
        "price_modifier": 0.82,  # student discount area
    },
]

# ── Item Definitions ───────────────────────────────────────────────────────────
# (name, category, base_price_eur)
STAPLES = [
    ("Whole Chicken",   "Staple", 9.50),
    ("Mirabelle Jam",   "Staple", 4.20),
    ("Eggs (dozen)",    "Staple", 3.80),
    ("Rice (1kg)",      "Staple", 2.10),
]

STREET_FOOD = [
    ("Quiche Lorraine (slice)", "Street Food", 3.50),
    ("Baguette",                "Street Food", 1.20),
]

MERCHANDISE = [
    ("GT Hoodie",    "Merchandise", 35.00),
    ("Wool Scarf",   "Merchandise", 18.00),
]

GOUGING_RATE   = 0.15   # 15% of records are outliers
GOUGING_LOW    = 1.8
GOUGING_HIGH   = 2.5

# date range: February 2026
START_DATE = datetime(2026, 2, 1)
END_DATE   = datetime(2026, 2, 28)


def random_date():
    delta = END_DATE - START_DATE
    return START_DATE + timedelta(seconds=random.randint(0, int(delta.total_seconds())))


def generate_price(base_price, modifier, is_gouging):
    fair_price = base_price * modifier
    if is_gouging:
        multiplier = random.uniform(GOUGING_LOW, GOUGING_HIGH)
        return round(fair_price * multiplier, 2)
    else:
        # ±12% natural variance
        variance = random.uniform(0.88, 1.12)
        return round(fair_price * variance, 2)


def build_records(item_list, count_range):
    records = []
    count = random.randint(*count_range)
    for _ in range(count):
        item_name, category, base_price = random.choice(item_list)
        hood = random.choice(NEIGHBORHOODS)
        is_gouging = random.random() < GOUGING_RATE

        # slight lat/lng jitter within the neighborhood (~50–150m)
        lat = hood["lat"] + random.uniform(-0.0008, 0.0008)
        lng = hood["lng"] + random.uniform(-0.0008, 0.0008)

        price = generate_price(base_price, hood["price_modifier"], is_gouging)
        reported_at = random_date()

        records.append((
            "Metz, France",
            hood["name"],
            round(lat, 6),
            round(lng, 6),
            item_name,
            category,
            price,
            "EUR",
            is_gouging,
            reported_at,
        ))
    return records


def seed():
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    # Create table if it doesn't exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS market_reports (
            id            SERIAL PRIMARY KEY,
            city          TEXT        NOT NULL,
            neighborhood  TEXT        NOT NULL,
            lat           NUMERIC(9,6) NOT NULL,
            lng           NUMERIC(9,6) NOT NULL,
            item_name     TEXT        NOT NULL,
            category      TEXT        NOT NULL,
            price         NUMERIC(10,2) NOT NULL,
            currency      TEXT        NOT NULL DEFAULT 'EUR',
            is_gouging    BOOLEAN     NOT NULL DEFAULT FALSE,
            reported_at   TIMESTAMP   NOT NULL DEFAULT NOW()
        );
    """)
    conn.commit()

    all_records = []
    all_records += build_records(STAPLES,      (30, 45))
    all_records += build_records(STREET_FOOD,  (20, 25))
    all_records += build_records(MERCHANDISE,  (10, 15))

    insert_sql = """
        INSERT INTO market_reports
            (city, neighborhood, lat, lng, item_name, category,
             price, currency, is_gouging, reported_at)
        VALUES %s
    """
    execute_values(cur, insert_sql, all_records)
    conn.commit()

    print(f"[France/Metz] Inserted {len(all_records)} records.")
    print(f"  Gouging rows : {sum(1 for r in all_records if r[8])}")
    print(f"  Fair rows    : {sum(1 for r in all_records if not r[8])}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    seed()