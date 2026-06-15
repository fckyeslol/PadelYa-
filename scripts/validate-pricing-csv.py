"""Verify every CSV row maps to correct player fee after markup."""
import csv
import json
import re
from pathlib import Path

MARKUP = 22_500
ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "barranquilla_padel_prices.csv"
JSON_PATH = ROOT / "config" / "pricing-slots.json"

VENUE_MAP = {
    "PADEL ZENTER DEL RIO": "padel-zenter-del-rio",
    "PADEL ZENTER LA ARENOSA": "padel-zenter-la-arenosa",
    "Pádel Park Barranquilla": "padel-park",
    "La Jaula Padel Barranquilla": "la-jaula",
    "X3 Padel Club": "x3-padel-club",
    "Ace Padel Club": "ace-padel-club",
}


def parse_price(s: str) -> int:
    t = re.sub(r",\d{2}$", "", s.replace("$", "").replace("COP", "").strip()).replace(".", "").strip()
    return int(t)


data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
errors = []
checked = 0

with CSV_PATH.open(newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        club = row["Club Name"].strip()
        vid = VENUE_MAP.get(club)
        if not vid:
            continue
        date = row["Date"].strip()
        tm = row["Time Slot"].strip()
        expected_court = parse_price(row["Price"]) + MARKUP
        expected_player = expected_court // 4
        actual_court = data["byDate"][vid][date][tm]
        checked += 1
        if actual_court != expected_court:
            errors.append(
                f"{club} {date} {tm}: court json={actual_court} expected={expected_court}"
            )
        if actual_court // 4 != expected_player:
            errors.append(f"{club} {date} {tm}: player mismatch")

print(f"Checked {checked} CSV rows")
if errors:
    print(f"ERRORS {len(errors)}:")
    for e in errors[:20]:
        print(" ", e)
    raise SystemExit(1)
print("All CSV rows match pricing-slots.json")
