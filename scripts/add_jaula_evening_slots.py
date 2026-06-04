"""Declarative: set La Jaula evening pricing blocks in the CSV.

Each BLOCK lists slot times and the RAW court price; the pricing generator
adds the $20k markup, so final court price = raw + 20_000 and the per-player
fee = (raw + 20_000) / 4.

Idempotent: drops every La Jaula row in [START_DATE..END_DATE] whose slot is
managed by any block, then re-adds clean rows. Re-run after editing BLOCKS,
then run: python scripts/gen_pricing.py

Current blocks:
  7:00pm–9:30pm  -> raw 154.000 (+20k = 174.000 court, 43.500 / player)
  10:00pm–11:30pm -> raw  88.000 (+20k = 108.000 court, 27.000 / player)
"""
import csv
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "barranquilla_padel_prices.csv"

CLUB = "La Jaula Padel Barranquilla"
START_DATE = date(2026, 6, 4)   # today onward
END_DATE = date(2026, 6, 30)    # end of current calendar

BLOCKS = [
    {  # 7:00pm – 9:30pm
        "slots": ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30"],
        "raw": 154_000,
    },
    {  # 10:00pm – 11:30pm
        "slots": ["22:00", "22:30", "23:00", "23:30"],
        "raw": 88_000,
    },
]


def raw_to_price_str(raw: int) -> str:
    # "$ 154.000,00 COP" — dot thousands separator, comma cents.
    thousands = f"{raw:,}".replace(",", ".")  # 154000 -> "154.000"
    return f"$ {thousands},00 COP"


# All slots under management (drop set).
managed = {s for b in BLOCKS for s in b["slots"]}


def in_range(d_str: str) -> bool:
    try:
        y, m, d = map(int, d_str.split("-"))
        return START_DATE <= date(y, m, d) <= END_DATE
    except ValueError:
        return False


with CSV_PATH.open(newline="", encoding="utf-8") as f:
    reader = csv.reader(f)
    header = next(reader)
    kept = []
    dropped = 0
    for row in reader:
        if not row:
            continue
        club, _field, d_str, tslot = row[0], row[1], row[2], row[3]
        if club == CLUB and tslot in managed and in_range(d_str):
            dropped += 1
            continue
        kept.append(row)

new_rows = []
cur = START_DATE
while cur <= END_DATE:
    d_str = cur.isoformat()
    for block in BLOCKS:
        price_str = raw_to_price_str(block["raw"])
        for tslot in block["slots"]:
            new_rows.append([CLUB, "", d_str, tslot, price_str])
    cur += timedelta(days=1)

with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(header)
    writer.writerows(kept)
    writer.writerows(new_rows)

print(f"Dropped {dropped} stale La Jaula managed rows in range.")
print(f"Added {len(new_rows)} La Jaula rows "
      f"({START_DATE}..{END_DATE}, {len(managed)} slots/day).")
for b in BLOCKS:
    final = b["raw"] + 20_000
    print(f"  {b['slots'][0]}–{b['slots'][-1]}: raw {b['raw']} "
          f"-> {final} court / {final // 4} player")
