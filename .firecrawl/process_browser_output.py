#!/usr/bin/env python3
"""
Process the JSON downloaded by browser_scraper.js into:
  - barranquilla_padel_prices.csv
  - config/pricing-slots.json

Usage:
  python .firecrawl/process_browser_output.py <path-to-easycancha_pricing.json>
"""

import json
import csv
import sys
import os
from datetime import date
from collections import Counter, defaultdict

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJ_DIR   = os.path.join(BASE_DIR, "..")
CSV_OUT    = os.path.join(PROJ_DIR, "barranquilla_padel_prices.csv")
JSON_OUT   = os.path.join(PROJ_DIR, "config", "pricing-slots.json")
MARKUP_COP = 22_500

CLUBS = [
    {"id": 1125, "venue_id": "padel-zenter-del-rio",    "name": "PADEL ZENTER DEL RIO"},
    {"id": 1475, "venue_id": "padel-zenter-la-arenosa", "name": "PADEL ZENTER LA ARENOSA"},
    {"id": 1442, "venue_id": "padel-park",              "name": "Padel Park Barranquilla"},
    {"id": 1526, "venue_id": "la-jaula",                "name": "La Jaula Padel Barranquilla"},
    {"id": 1675, "venue_id": "x3-padel-club",           "name": "X3 Padel Club"},
    {"id": 1866, "venue_id": "ace-padel-club",          "name": "Ace Padel Club"},
]

ID_TO_VENUE = {str(c["id"]): c for c in CLUBS}

def infer_patterns(raw):
    """Fill missing (date, time) slots using same day-of-week modal price."""
    venue_dow_time_prices = defaultdict(lambda: defaultdict(list))
    for venue_id, date_slots in raw.items():
        for date_str, time_slots in date_slots.items():
            dow = date.fromisoformat(date_str).weekday()
            for t, price in time_slots.items():
                venue_dow_time_prices[venue_id][(dow, t)].append(price)

    pattern = {}
    for venue_id, dtp in venue_dow_time_prices.items():
        pattern[venue_id] = {}
        for (dow, t), prices in dtp.items():
            pattern[venue_id][(dow, t)] = Counter(prices).most_common(1)[0][0]

    # All 42 days from today regardless of what was observed
    all_dates = [(date(2026, 5, 20) + __import__('datetime').timedelta(days=i)).isoformat() for i in range(42)]

    filled = 0
    for date_str in all_dates:
        dow = date.fromisoformat(date_str).weekday()
        for venue_id in raw:
            known = raw[venue_id].get(date_str, {})
            inferred = {
                t: p
                for (d, t), p in pattern.get(venue_id, {}).items()
                if d == dow and t not in known
            }
            if inferred:
                if date_str not in raw[venue_id]:
                    raw[venue_id][date_str] = {}
                raw[venue_id][date_str].update(inferred)
                filled += len(inferred)

    print(f"  Pattern inference: filled {filled} slots via day-of-week")
    return raw

def write_csv(raw):
    rows = []
    for venue_id, date_slots in raw.items():
        club = next((c for c in CLUBS if c["venue_id"] == venue_id), None)
        if not club:
            continue
        for date_str, time_slots in sorted(date_slots.items()):
            for t, price_cop in sorted(time_slots.items()):
                rows.append({
                    "Club Name":   club["name"],
                    "Field/Court": "",
                    "Date":        date_str,
                    "Time Slot":   t,
                    "Price":       f'"$ {price_cop:,.0f},00 COP"'.replace(",", "."),
                })
    rows.sort(key=lambda r: (r["Club Name"], r["Date"], r["Time Slot"]))
    with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Club Name", "Field/Court", "Date", "Time Slot", "Price"])
        w.writeheader()
        w.writerows(rows)
    print(f"CSV: {len(rows)} rows written")

def write_json(raw):
    by_date = {}
    all_calendar_dates = set()

    for venue_id, date_slots in raw.items():
        by_date[venue_id] = {}
        for date_str, time_slots in date_slots.items():
            court_prices = {
                t: price_cop + MARKUP_COP
                for t, price_cop in sorted(time_slots.items())
                if price_cop > 0
            }
            if court_prices:
                by_date[venue_id][date_str] = court_prices
                all_calendar_dates.add(date_str)

    output = {
        "markupCop":     MARKUP_COP,
        "source":        "barranquilla_padel_prices.csv",
        "calendarDates": sorted(all_calendar_dates),
        "byDate":        by_date,
        "fixedVenues": {
            "casa-padel": {
                "courtCop":  90_000,
                "playerCop": 22_500,
                "note":      "ReservaDeportes flat rate, any time",
            }
        },
    }

    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    total = sum(len(ts) for vs in by_date.values() for ts in vs.values())
    print(f"JSON: {total} slots across {len(all_calendar_dates)} dates written")

def main():
    if len(sys.argv) < 2:
        print("Usage: python process_browser_output.py <easycancha_pricing.json>")
        sys.exit(1)

    input_file = sys.argv[1]
    with open(input_file, encoding="utf-8") as f:
        browser_data = json.load(f)

    # Re-key by venue_id (browser data uses numeric club IDs as keys)
    raw = {}
    for club_id_str, club_data in browser_data.items():
        club = ID_TO_VENUE.get(str(club_id_str))
        if not club:
            print(f"  Unknown club ID: {club_id_str}, skipping")
            continue
        raw[club["venue_id"]] = club_data.get("dates", {})

    print(f"\nLoaded data for {len(raw)} venues:")
    for venue_id, date_slots in raw.items():
        n_slots = sum(len(v) for v in date_slots.values())
        print(f"  {venue_id:<30} {len(date_slots)} dates, {n_slots} slots")

    print("\nRunning pattern inference...")
    raw = infer_patterns(raw)

    write_csv(raw)
    write_json(raw)

    print("\n── Summary ──────────────────────────────────────────────────")
    for club in CLUBS:
        vid = club["venue_id"]
        n_dates = len(raw.get(vid, {}))
        n_slots = sum(len(v) for v in raw.get(vid, {}).values())
        print(f"  {club['name']:<35} {n_dates} dates, {n_slots} slots")
    print("\nDone ✓")

if __name__ == "__main__":
    main()
