#!/usr/bin/env python3
"""Fetch remaining Barranquilla padel clubs and append to CSV."""

import urllib.request, json, csv, time, os

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTc3MjQ2MywiZW1haWwiOiJtYXRlb3BpcmVsYTA4QGdtYWlsLmNvbSIsImZpcnN0X25hbWUiOiJNYXRlbyBkZSBKZXN1cyIsImxhc3RfbmFtZSI6IlBpcmVsYSBQdWxpZG8iLCJyb2xlIjoidXNlciIsInN1YnNjcmlwdGlvbiI6e30sInNjb3BlIjpbXSwiaWF0IjoxNzc5MjgxNDY2LCJleHAiOjE3Nzk4ODYyNjYsImF1ZCI6ImVhc3ljYW5jaGEtdXNlci1wcm9kdWN0aW9uIiwiaXNzIjoiZWFzeWNhbmNoYS5jb20tdXNlciIsInN1YiI6Im1hdGVvcGlyZWxhMDhAZ21haWwuY29tIn0.a3T4yn8kLI-WOilMMPyVcEB-rAovcitCpVdRhSNwsDk"
AWSALB = "uxC+W5XUOit2h0sTwApeQNXyM/i8tTPcCqpcYfGUPYRDQkR8E2IqFBFgtOMTFuBTdv//E7iCULuJtux0p//0XsC3xchmr2um5oKXs7HPn7ujV1/Z5sP1sn2ZZhVP"

CLUBS = [
    {"id": 1526, "name": "La Jaula Padel Barranquilla", "sport_id": 7, "timespan": 90},
    {"id": 1675, "name": "X3 Padel Club",               "sport_id": 7, "timespan": 90},
    {"id": 1866, "name": "Ace Padel Club",               "sport_id": 7, "timespan": 90},
]

DATES = [
    "2026-05-20","2026-05-21","2026-05-22","2026-05-23",
    "2026-05-24","2026-05-25","2026-05-26","2026-05-27",
]
PROBE_TIMES = ["08:00","10:00","14:00","18:00"]

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
        print(f"  ERR {url}: {e}")
        return None


def extract_rows(data, club_name, date):
    rows, seen = [], set()

    def parse_ts(hour_str, ts_list):
        hour = hour_str[:5]
        for ts in ts_list:
            court = ts.get("courtName") or ts.get("court_name") or ""
            if ts.get("bookingId"):
                continue
            pi = ts.get("priceInfo") or {}
            amount = pi.get("amount") or pi.get("app_amount") or 0
            price_str = f"$ {amount:,.0f} COP".replace(",", ".")
            key = (club_name, court, date, hour)
            if key not in seen:
                seen.add(key)
                rows.append({"Club Name": club_name, "Field/Court": court,
                              "Date": date, "Time Slot": hour, "Price": price_str})

    for ts in data.get("timeslots", []):
        parse_ts((ts.get("local_start_time") or "")[:5] + ":00", [ts])
    for alt in data.get("alternative_timeslots", []):
        parse_ts(alt["hour"], alt.get("timeslots", []))
    return rows


all_rows = []
for club in CLUBS:
    print(f"\n=== {club['name']} ===")
    seen_date = set()
    for date in DATES:
        if date in seen_date:
            continue
        day_rows = []
        for probe in PROBE_TIMES:
            url = (f"https://www.easycancha.com/api/sports/{club['sport_id']}"
                   f"/clubs/{club['id']}/timeslots"
                   f"?date={date}&time={probe}&timespan={club['timespan']}")
            data = fetch(url)
            if data and not data.get("error"):
                rows = extract_rows(data, club["name"], date)
                if rows:
                    day_rows = rows
                    seen_date.add(date)
                    break
            time.sleep(0.3)
        print(f"  {date}: {len(day_rows)} slots")
        all_rows.extend(day_rows)
        time.sleep(0.5)

# Append to existing CSV
out_path = os.path.join(os.path.dirname(__file__), "..", "barranquilla_padel_prices.csv")
with open(out_path, "a", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["Club Name","Field/Court","Date","Time Slot","Price"])
    writer.writerows(all_rows)

print(f"\nAppended {len(all_rows)} rows to barranquilla_padel_prices.csv")
