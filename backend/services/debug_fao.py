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

    # Show unique Element values
    if "Element" in df.columns:
        print(f"\n  Unique 'Element' values:")
        for e in df["Element"].dropna().unique():
            print(f"    • '{e}'")
    else:
        print("  ⚠️  No 'Element' column found")

    # Show first 3 rows raw
    print(f"\n  First 3 rows:")
    print(df.head(3).to_string())