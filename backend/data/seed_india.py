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
        "name": "Chandni Chowk (Local Market)",
        "lat": 28.6505,
        "lng": 77.2303,
        "price_modifier": 1.0,   # baseline — old Delhi, locals
    },
    {
        "name": "Connaught Place (Tourist Zone)",
        "lat": 28.6315,
        "lng": 77.2167,
        "price_modifier": 1.55,  # central tourist/business area
    },
    {
        "name": "Lajpat Nagar (Student/Residential Zone)",
        "lat": 28.5677,
        "lng": 77.2433,
        "price_modifier": 0.88,  # residential, budget-friendly
    },
]

# ── Item Definitions ───────────────────────────────────────────────────────────
# Prices in INR (Indian Rupee), ~Feb 2026 realistic estimates
STAPLES = [
    ("Basmati Rice (1kg)",   "Staple",  120),
    ("Chicken (1kg)",        "Staple",  220),
    ("Eggs (dozen)",         "Staple",   80),
    ("Dal (Lentils, 1kg)",   "Staple",  100),
    ("Paneer (200g)",        "Staple",   90),
]

STREET_FOOD = [
    ("Chole Bhature (plate)",    "Street Food",  80),
    ("Masala Chai (cup)",        "Street Food",  20),
    ("Aloo Tikki (2 pieces)",    "Street Food",  40),
    ("Paratha with Butter",      "Street Food",  50),
]

MERCHANDISE = [
    ("Hand-painted Scarf",       "Merchandise",  650),
    ("Block Print Kurta",        "Merchandise",  850),
    ("Embroidered Tote Bag",     "Merchandise",  380),
]

GOUGING_RATE   = 0.15
GOUGING_LOW    = 1.8
GOUGING_HIGH   = 2.5

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
        variance = random.uniform(0.88, 1.12)
        return round(fair_price * variance, 2)


def build_records(item_list, count_range):
    records = []
    count = random.randint(*count_range)
    for _ in range(count):
        item_name, category, base_price = random.choice(item_list)
        hood = random.choice(NEIGHBORHOODS)
        is_gouging = random.random() < GOUGING_RATE

        lat = hood["lat"] + random.uniform(-0.0010, 0.0010)
        lng = hood["lng"] + random.uniform(-0.0010, 0.0010)

        price = generate_price(base_price, hood["price_modifier"], is_gouging)
        reported_at = random_date()

        records.append((
            "Delhi, India",
            hood["name"],
            round(lat, 6),
            round(lng, 6),
            item_name,
            category,
            price,
            "INR",
            is_gouging,
            reported_at,
        ))
    return records


def seed():
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

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
            currency      TEXT        NOT NULL DEFAULT 'INR',
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

    print(f"[India/Delhi] Inserted {len(all_records)} records.")
    print(f"  Gouging rows : {sum(1 for r in all_records if r[8])}")
    print(f"  Fair rows    : {sum(1 for r in all_records if not r[8])}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    seed()