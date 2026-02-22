import subprocess
import sys

scripts = [
    "seed_france.py",
    "seed_nigeria.py",
    "seed_india.py",
]

for script in scripts:
    print(f"\n▶ Running {script}...")
    result = subprocess.run([sys.executable, script])
    if result.returncode != 0:
        print(f"❌ {script} failed. Stopping.")
        sys.exit(1)

print("\n✅ All three seed scripts completed successfully.")