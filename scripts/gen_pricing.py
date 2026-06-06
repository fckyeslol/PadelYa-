"""Build config/pricing-slots.json from barranquilla_padel_prices.csv (+ markup)."""
import csv
import json
import re
from datetime import datetime
from pathlib import Path

MARKUP = 26_000
ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "barranquilla_padel_prices.csv"
OUT_PATH = ROOT / "config" / "pricing-slots.json"

VENUE_MAP = {
    "PADEL ZENTER DEL RIO": "padel-zenter-del-rio",
    "PADEL ZENTER LA ARENOSA": "padel-zenter-la-arenosa",
    "Pádel Park Barranquilla": "padel-park",
    "La Jaula Padel Barranquilla": "la-jaula",
    "X3 Padel Club": "x3-padel-club",
    "Ace Padel Club": "ace-padel-club",
}


def parse_price(s: str) -> int:
    t = s.replace("$", "").replace("COP", "").strip()
    t = re.sub(r",\d{2}$", "", t)
    t = t.replace(".", "").strip()
    return int(t)


def time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


# venue -> date -> time -> max court price (across courts)
by_date: dict[str, dict[str, dict[str, int]]] = {}
calendar_dates: set[str] = set()

with CSV_PATH.open(newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        club = row["Club Name"].strip()
        vid = VENUE_MAP.get(club)
        if not vid:
            continue
        date = row["Date"].strip()
        tm = row["Time Slot"].strip()
        court_price = parse_price(row["Price"]) + MARKUP
        calendar_dates.add(date)
        venue_dates = by_date.setdefault(vid, {})
        day_slots = venue_dates.setdefault(date, {})
        day_slots[tm] = max(day_slots.get(tm, 0), court_price)

sorted_dates = sorted(calendar_dates)

output = {
    "markupCop": MARKUP,
    "source": "barranquilla_padel_prices.csv",
    "calendarDates": sorted_dates,
    "byDate": {vid: dict(dates) for vid, dates in by_date.items()},
    "fixedVenues": {
        "casa-padel": {
            "courtCop": 70_000 + MARKUP,
            "playerCop": (70_000 + MARKUP) // 4,
            "note": "ReservaDeportes flat rate, any time",
        }
    },
}

OUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {OUT_PATH}")
print(f"  dates: {sorted_dates[0]} .. {sorted_dates[-1]} ({len(sorted_dates)} days)")
for vid in sorted(by_date):
    total = sum(len(slots) for slots in by_date[vid].values())
    print(f"  {vid}: {total} slot entries")
