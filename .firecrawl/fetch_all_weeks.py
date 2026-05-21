#!/usr/bin/env python3
"""
Comprehensive EasyCancha scraper for Barranquilla padel venues.
- Fresh login with provided credentials
- All 6 venues x 6 weeks
- Captures booked slots (price still available in API response)
- Pattern inference: fills gaps using same day-of-week pricing
- Outputs barranquilla_padel_prices.csv and config/pricing-slots.json
"""

import urllib.request
import json
import csv
import time
import os
import sys
from datetime import date, timedelta
from collections import defaultdict, Counter

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJ_DIR   = os.path.join(BASE_DIR, "..")
CSV_OUT    = os.path.join(PROJ_DIR, "barranquilla_padel_prices.csv")
JSON_OUT   = os.path.join(PROJ_DIR, "config", "pricing-slots.json")
MARKUP_COP = 20_000

# ── Clubs ─────────────────────────────────────────────────────────────────────
CLUBS = [
    {"id": 1125, "venue_id": "padel-zenter-del-rio",    "name": "PADEL ZENTER DEL RIO",        "sport_id": 7, "timespan": 90},
    {"id": 1475, "venue_id": "padel-zenter-la-arenosa", "name": "PADEL ZENTER LA ARENOSA",     "sport_id": 7, "timespan": 90},
    {"id": 1442, "venue_id": "padel-park",              "name": "Padel Park Barranquilla",      "sport_id": 7, "timespan": 60},
    {"id": 1526, "venue_id": "la-jaula",                "name": "La Jaula Padel Barranquilla",  "sport_id": 7, "timespan": 90},
    {"id": 1675, "venue_id": "x3-padel-club",           "name": "X3 Padel Club",                "sport_id": 7, "timespan": 90},
    {"id": 1866, "venue_id": "ace-padel-club",          "name": "Ace Padel Club",               "sport_id": 7, "timespan": 90},
]

# 6 weeks starting today
TODAY      = date(2026, 5, 20)
ALL_DATES  = [(TODAY + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(42)]

# Probe every 2h to maximise coverage; alt_timeslots usually gives the whole day
PROBE_TIMES = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]

# ── Login ─────────────────────────────────────────────────────────────────────
def login(email: str, password: str):
    payload = json.dumps({"email": email, "password": password}).encode()
    headers = {
        "Content-Type": "application/json",
        "Accept":       "application/json",
        "app-id":       "easycancha",
        "app-os":       "web",
        "acceptLanguage": "es-CO",
        "country":      "CO",
        "Origin":       "https://www.easycancha.com",
        "Referer":      "https://www.easycancha.com/login",
    }
    req = urllib.request.Request(
        "https://www.easycancha.com/api/users/login",
        data=payload, headers=headers, method="POST"
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = json.loads(resp.read().decode())
        token = (
            body.get("token")
            or body.get("authtoken")
            or body.get("access_token")
            or body.get("jwt")
        )
        if not token:
            raise RuntimeError(f"No token in response: {list(body.keys())}")
        # Try to grab AWSALB from Set-Cookie
        awsalb = ""
        raw_cookie = resp.getheader("Set-Cookie") or ""
        for chunk in raw_cookie.split(";"):
            c = chunk.strip()
            if c.startswith("AWSALB="):
                awsalb = c[len("AWSALB="):]
                break
        return token, awsalb

# ── Fetch one API call ────────────────────────────────────────────────────────
def make_headers(token: str, awsalb: str) -> dict:
    cookie = f"authtoken={token}; country=CO; acceptLanguage=es-CO; appId=easycancha; appOs=web"
    if awsalb:
        cookie += f"; AWSALB={awsalb}"
    return {
        "Authorization":    token,
        "Accept":           "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "app-id":           "easycancha",
        "app-os":           "web",
        "acceptLanguage":   "es-CO",
        "country":          "CO",
        "Origin":           "https://www.easycancha.com",
        "Referer":          "https://www.easycancha.com/book/clubs/1125/sports",
        "Cookie":           cookie,
    }

def api_get(url: str, headers: dict):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 401:
            raise RuntimeError("401 Unauthorized — token expired")
        print(f"    HTTP {e.code}: {url}")
        return None
    except Exception as e:
        print(f"    ERR: {e}")
        return None

# ── Parse slots from API response ─────────────────────────────────────────────
def parse_response(data: dict, club_name: str, date_str: str):
    """
    Returns dict: time_str -> price_cop (original, no markup).
    Includes BOTH available and booked slots — booked slots carry the real price.
    """
    out = {}

    def process(ts):
        hour = (ts.get("local_start_time") or "")[:5]
        if not hour or len(hour) != 5:
            return
        pi = ts.get("priceInfo") or {}
        amount = int(pi.get("amount") or pi.get("app_amount") or 0)
        if amount <= 0:
            return
        # Keep the slot regardless of bookingId (booked slots have real prices too)
        if hour not in out:
            out[hour] = amount

    # Primary timeslot (the probe time itself)
    for ts in data.get("timeslots", []):
        process(ts)

    # Alternative timeslots — full-day view; each entry is {hour, timeslots:[...]}
    for alt in data.get("alternative_timeslots", []):
        hour = (alt.get("hour") or "")[:5]
        for ts in alt.get("timeslots", []):
            ts["local_start_time"] = hour + ":00"
            process(ts)

    return out

# ── Scrape all clubs × dates ──────────────────────────────────────────────────
def scrape(token: str, awsalb: str):
    headers = make_headers(token, awsalb)
    # raw_data[venue_id][date_str][time_str] = price_cop
    raw = defaultdict(lambda: defaultdict(dict))

    for club in CLUBS:
        print(f"\n{'─'*55}")
        print(f"  {club['name']}  (EC id={club['id']})")
        print(f"{'─'*55}")

        for date_str in ALL_DATES:
            day_slots: dict[str, int] = {}
            got_full_day = False  # True once alternative_timeslots is populated

            for probe in PROBE_TIMES:
                url = (
                    f"https://www.easycancha.com/api/sports/{club['sport_id']}"
                    f"/clubs/{club['id']}/timeslots"
                    f"?date={date_str}&time={probe}&timespan={club['timespan']}"
                )
                data = api_get(url, headers)
                if data is None or data.get("error"):
                    time.sleep(0.25)
                    continue

                slots = parse_response(data, club["name"], date_str)
                for t, p in slots.items():
                    if t not in day_slots:
                        day_slots[t] = p

                # If alternative_timeslots came back we have the full day picture;
                # still continue probing to catch booked slots not in alt list.
                if data.get("alternative_timeslots"):
                    got_full_day = True

                time.sleep(0.25)

            if day_slots:
                print(f"    {date_str} ({date.fromisoformat(date_str).strftime('%a')}): {len(day_slots)} slots")
                raw[club["venue_id"]][date_str] = dict(sorted(day_slots.items()))
            else:
                print(f"    {date_str}: —")

            time.sleep(0.35)

    return raw

# ── Pattern inference ─────────────────────────────────────────────────────────
def infer_patterns(raw):
    """
    Build per-venue patterns: (day_of_week, time) -> modal price.
    Then fill missing (date, time) slots using the pattern.
    """
    print("\n── Pattern inference ────────────────────────────────────────")

    # 1. Collect observed (dow, time) -> prices
    venue_dow_time_prices: dict[str, dict[tuple, list]] = defaultdict(lambda: defaultdict(list))
    for venue_id, date_slots in raw.items():
        for date_str, time_slots in date_slots.items():
            dow = date.fromisoformat(date_str).weekday()
            for t, price in time_slots.items():
                venue_dow_time_prices[venue_id][(dow, t)].append(price)

    # 2. Compute modal price per (venue, dow, time)
    pattern: dict[str, dict[tuple, int]] = {}
    for venue_id, dow_time_prices in venue_dow_time_prices.items():
        pattern[venue_id] = {}
        for (dow, t), prices in dow_time_prices.items():
            modal = Counter(prices).most_common(1)[0][0]
            pattern[venue_id][(dow, t)] = modal

    # 3. Fill gaps in raw
    filled = 0
    for date_str in ALL_DATES:
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

    print(f"  Filled {filled} slots via day-of-week pattern")
    return raw

# ── Write outputs ─────────────────────────────────────────────────────────────
def write_csv(raw):
    rows = []
    for venue_id, date_slots in raw.items():
        club = next(c for c in CLUBS if c["venue_id"] == venue_id)
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
    print(f"\nCSV  → {len(rows)} rows → {CSV_OUT}")

def write_json(raw):
    by_date: dict = {}
    all_calendar_dates: set = set()

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

    total = sum(
        len(ts)
        for vs in by_date.values()
        for ts in vs.values()
    )
    print(f"JSON → {total} slots × {len(all_calendar_dates)} dates → {JSON_OUT}")

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    EMAIL    = "matteotaofr@gmail.com"
    PASSWORD = "Familiapirela123"

    print(f"Logging in as {EMAIL} …")
    try:
        token, awsalb = login(EMAIL, PASSWORD)
        print(f"  OK — token: {token[:50]}…")
    except Exception as exc:
        print(f"Login failed: {exc}")
        sys.exit(1)

    print(f"\nScraping {len(CLUBS)} venues × {len(ALL_DATES)} days …")
    raw = scrape(token, awsalb)

    raw = infer_patterns(raw)

    write_csv(raw)
    write_json(raw)

    # Quick summary
    print("\n── Summary ──────────────────────────────────────────────────")
    for club in CLUBS:
        vid = club["venue_id"]
        n_dates  = len(raw.get(vid, {}))
        n_slots  = sum(len(v) for v in raw.get(vid, {}).values())
        print(f"  {club['name']:<35} {n_dates} dates, {n_slots} total slots")
    print("\nDone ✓")
