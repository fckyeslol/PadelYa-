"""One-shot: enable La Jaula evening slots (7:00pm–10:00pm, every 30 min).

Adds rows to barranquilla_padel_prices.csv so every date from START_DATE
onward has the night slots priced at RAW_PRICE (court). The pricing generator
adds the $20k markup on top, so the final court price = RAW_PRICE + 20_000 and
the per-player fee = (RAW_PRICE + 20_000) / 4.

After running this, run: python scripts/gen_pricing.py
"""
import csv
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "barranquilla_padel_prices.csv"

CLUB = "La Jaula Padel Barranquilla"
START_DATE = date(2026, 6, 4)   # today onward
END_DATE = date(2026, 6, 30)    # end of current calendar
NIGHT_SLOTS = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"]
RAW_PRICE = 154_000             # + 20_000 markup => 174_000 court => 43_500 / player
PRICE_STR = '$ 154.000,00 COP'

night_set = set(NIGHT_SLOTS)


def in_range(d_str: str) -> bool:
    try:
        y, m, d = map(int, d_str.split("-"))
        return START_DATE <= date(y, m, d) <= END_DATE
    except ValueError:
        return False


# Read existing rows, dropping La Jaula night-slot rows in range (we'll re-add them clean).
with CSV_PATH.open(newline="", encoding="utf-8") as f:
    reader = csv.reader(f)
    header = next(reader)
    kept = []
    dropped = 0
    for row in reader:
        if not row:
            continue
        club, _field, d_str, tslot, _price = row[0], row[1], row[2], row[3], row[4]
        if club == CLUB and tslot in night_set and in_range(d_str):
            dropped += 1
            continue
        kept.append(row)

# Build new night rows for every date in range.
new_rows = []
cur = START_DATE
while cur <= END_DATE:
    d_str = cur.isoformat()
    for tslot in NIGHT_SLOTS:
        new_rows.append([CLUB, "", d_str, tslot, PRICE_STR])
    cur += timedelta(days=1)

with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(header)
    writer.writerows(kept)
    writer.writerows(new_rows)

print(f"Dropped {dropped} stale La Jaula night rows in range.")
print(f"Added {len(new_rows)} La Jaula night rows "
      f"({START_DATE}..{END_DATE} x {len(NIGHT_SLOTS)} slots @ {RAW_PRICE} raw).")
