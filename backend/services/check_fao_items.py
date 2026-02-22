import pandas as pd
import os

files = {
    "west_africa": r"C:\Hackalytics\Marketlens\backend\data\raw\fao_west_africa_producer_prices.csv",
    "india":       r"C:\Hackalytics\Marketlens\backend\data\raw\fao_india_producer_prices.csv",
    "france":      r"C:\Hackalytics\Marketlens\backend\data\raw\fao_france_producer_prices.csv",
}

for region, path in files.items():
    if not os.path.exists(path):
        print(f"\n⚠️  File not found: {path}")
        continue

    try:
        df = pd.read_csv(path, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding="latin-1")

    print(f"\n{'='*50}")
    print(f"  {region.upper()}")
    print(f"{'='*50}")

    if "Item" in df.columns:
        items = sorted(df["Item"].dropna().unique())
        for item in items:
            print(f"  • {item}")
    else:
        print("  ⚠️  No 'Item' column found")
        print(f"  Columns: {list(df.columns)}")