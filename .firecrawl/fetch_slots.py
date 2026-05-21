#!/usr/bin/env python3
"""Fetch Barranquilla padel slot data from easycancha API."""

import urllib.request
import urllib.parse
import json
import csv
import time
import os

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTc3MjQ2MywiZW1haWwiOiJtYXRlb3BpcmVsYTA4QGdtYWlsLmNvbSIsImZpcnN0X25hbWUiOiJNYXRlbyBkZSBKZXN1cyIsImxhc3RfbmFtZSI6IlBpcmVsYSBQdWxpZG8iLCJyb2xlIjoidXNlciIsInN1YnNjcmlwdGlvbiI6e30sInNjb3BlIjpbXSwiaWF0IjoxNzc5MjgxNDY2LCJleHAiOjE3Nzk4ODYyNjYsImF1ZCI6ImVhc3ljYW5jaGEtdXNlci1wcm9kdWN0aW9uIiwiaXNzIjoiZWFzeWNhbmNoYS5jb20tdXNlciIsInN1YiI6Im1hdGVvcGlyZWxhMDhAZ21haWwuY29tIn0.a3T4yn8kLI-WOilMMPyVcEB-rAovcitCpVdRhSNwsDk"
AWSALB = "uxC+W5XUOit2h0sTwApeQNXyM/i8tTPcCqpcYfGUPYRDQkR8E2IqFBFgtOMTFuBTdv//E7iCULuJtux0p//0XsC3xchmr2um5oKXs7HPn7ujV1/Z5sP1sn2ZZhVP"

CLUBS = [
    {"id": 1125, "name": "PADEL ZENTER DEL RIO",    "sport_id": 7, "timespan": 90},
    {"id": 1475, "name": "PADEL ZENTER LA ARENOSA", "sport_id": 7, "timespan": 90},
    {"id": 1442, "name": "Pádel Park Barranquilla",  "sport_id": 7, "timespan": 60},
]

DATES = [
    "2026-05-20", "2026-05-21", "2026-05-22", "2026-05-23",
    "2026-05-24", "2026-05-25", "2026-05-26", "2026-05-27",
]

# Probe times — we only need one good time; the response contains all alt slots
PROBE_TIMES = ["08:00", "10:00", "14:00", "18:00"]

HEADERS = {
    "Authorization": TOKEN,
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "app-id": "easycancha",
    "app-os": "web",
    "acceptLanguage": "es-CO",
    "country": "CO",
    "Origin": "https://www.easycancha.com",
    "Referer": "https://www.easycancha.com/book/clubs/1125/sports",
    "Cookie": f"authtoken={TOKEN}; country=CO; acceptLanguage=es-CO; appId=easycancha; appOs=web; AWSALB={AWSALB}",
}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  ERROR fetching {url}: {e}")
        return None


def extract_rows(data, club_name, date, timespan):
    rows = []
    seen = set()

    def parse_ts(hour_str, ts_list):
        hour = hour_str[:5]  # "08:00:00" → "08:00"
        for ts in ts_list:
            court = ts.get("courtName") or ts.get("court_name") or ""
            price_info = ts.get("priceInfo") or {}
            amount = price_info.get("amount") or price_info.get("app_amount") or 0
            # Skip already-booked slots (bookingId is set)
            if ts.get("bookingId"):
                continue
            price_str = f"$ {amount:,.0f}".replace(",", ".") + ",00 COP"
            key = (club_name, court, date, hour)
            if key not in seen:
                seen.add(key)
                rows.append({
                    "Club Name": club_name,
                    "Field/Court": court,
                    "Date": date,
                    "Time Slot": hour,
                    "Price": price_str,
                    "_amount": amount,
                })

    # Primary timeslots
    for ts in data.get("timeslots", []):
        hour = ts.get("local_start_time", "")[:5]
        parse_ts(hour + ":00", [ts])

    # Alternative timeslots (these carry all available hours for the day)
    for alt in data.get("alternative_timeslots", []):
        parse_ts(alt["hour"], alt.get("timeslots", []))

    return rows


all_rows = []
seen_club_date = set()

for club in CLUBS:
    print(f"\n=== {club['name']} (id={club['id']}) ===")
    for date in DATES:
        key = (club["id"], date)
        if key in seen_club_date:
            continue
        rows_for_day = []
        for probe_time in PROBE_TIMES:
            url = (
                f"https://www.easycancha.com/api/sports/{club['sport_id']}"
                f"/clubs/{club['id']}/timeslots"
                f"?date={date}&time={probe_time}&timespan={club['timespan']}"
            )
            data = fetch(url)
            if data and not data.get("error"):
                rows = extract_rows(data, club["name"], date, club["timespan"])
                if rows:
                    rows_for_day = rows
                    seen_club_date.add(key)
                    break
            time.sleep(0.3)

        if rows_for_day:
            print(f"  {date}: {len(rows_for_day)} slots")
            all_rows.extend(rows_for_day)
        else:
            print(f"  {date}: no slots found")
        time.sleep(0.5)

# Sort: club → date → time → court
all_rows.sort(key=lambda r: (r["Club Name"], r["Date"], r["Time Slot"], r["Field/Court"]))

# Write CSV
out_path = os.path.join(os.path.dirname(__file__), "..", "barranquilla_padel_prices.csv")
with open(out_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["Club Name", "Field/Court", "Date", "Time Slot", "Price"])
    writer.writeheader()
    for r in all_rows:
        writer.writerow({k: r[k] for k in ["Club Name", "Field/Court", "Date", "Time Slot", "Price"]})

print(f"\nWrote {len(all_rows)} rows → barranquilla_padel_prices.csv")
print("\nSample rows:")
for r in all_rows[:5]:
    print(f"  {r['Club Name']} | {r['Field/Court']} | {r['Date']} | {r['Time Slot']} | {r['Price']}")
