#!/usr/bin/env python3
"""Fetch 4 weeks of EasyCancha padel slots for all 6 Barranquilla clubs via API."""

from __future__ import annotations

import csv
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_CSV = ROOT / "barranquilla_padel_prices.csv"
SESSION_PATH = ROOT / ".firecrawl" / "session.json"

CLUBS = [
    {"id": 1125, "name": "PADEL ZENTER DEL RIO", "sport_id": 7, "timespan": 90},
    {"id": 1475, "name": "PADEL ZENTER LA ARENOSA", "sport_id": 7, "timespan": 90},
    {"id": 1442, "name": "Pádel Park Barranquilla", "sport_id": 7, "timespan": 60},
    {"id": 1526, "name": "La Jaula Padel Barranquilla", "sport_id": 7, "timespan": 90},
    {"id": 1675, "name": "X3 Padel Club", "sport_id": 7, "timespan": 90},
    {"id": 1866, "name": "Ace Padel Club", "sport_id": 7, "timespan": 90},
]

PROBE_TIMES = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]


def load_token() -> tuple[str, str]:
    token = os.environ.get("EASYCANCHA_TOKEN", "").strip()
    awsalb = os.environ.get("EASYCANCHA_AWSALB", "").strip()
    if SESSION_PATH.exists():
        data = json.loads(SESSION_PATH.read_text(encoding="utf-8"))
        token = token or (data.get("token") or "").strip()
        awsalb = awsalb or (data.get("awsalb") or "").strip()
    if not token and (ROOT / ".firecrawl" / "cookies_out.json").exists():
        raw = (ROOT / ".firecrawl" / "cookies_out.json").read_text(encoding="utf-8")
        m = re.search(r'"token":"([^"]+)"', raw) or re.search(r"token%22%3A%22([^%]+)", raw)
        if m:
            token = m.group(1)
    if not token:
        raise SystemExit("No auth token. Run firecrawl login flow or set EASYCANCHA_TOKEN.")
    return token, awsalb


def date_range_weeks(start: date, weeks: int) -> list[str]:
    days = weeks * 7
    return [(start + timedelta(days=i)).isoformat() for i in range(days)]


def headers(token: str, awsalb: str, club_id: int) -> dict[str, str]:
    cookie = f"authtoken={token}; country=CO; acceptLanguage=es-CO; appId=easycancha; appOs=web"
    if awsalb:
        cookie += f"; AWSALB={awsalb}"
    return {
        "Authorization": token,
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "app-id": "easycancha",
        "app-os": "web",
        "acceptLanguage": "es-CO",
        "country": "CO",
        "Origin": "https://www.easycancha.com",
        "Referer": f"https://www.easycancha.com/book/clubs/{club_id}/sports",
        "Cookie": cookie,
    }


def fetch_json(url: str, hdrs: dict[str, str]) -> dict | None:
    req = urllib.request.Request(url, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:200]
        print(f"  HTTP {e.code}: {body}")
        return None
    except Exception as e:
        print(f"  ERR: {e}")
        return None


def extract_rows(data: dict, club_name: str, day: str) -> list[dict]:
    rows: list[dict] = []
    seen: set[tuple[str, str, str, str]] = set()

    def parse_ts(hour_str: str, ts_list: list) -> None:
        hour = hour_str[:5]
        for ts in ts_list:
            if ts.get("bookingId"):
                continue
            court = (ts.get("courtName") or ts.get("court_name") or "").strip() or "(sin nombre)"
            pi = ts.get("priceInfo") or {}
            amount = pi.get("amount") or pi.get("app_amount") or 0
            if not amount:
                continue
            price_str = f"$ {amount:,.0f}".replace(",", ".") + ",00 COP"
            key = (club_name, court, day, hour)
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "Club Name": club_name,
                    "Field/Court": court,
                    "Date": day,
                    "Time Slot": hour,
                    "Price": price_str,
                }
            )

    for ts in data.get("timeslots", []):
        parse_ts((ts.get("local_start_time") or "00:00")[:5] + ":00", [ts])
    for alt in data.get("alternative_timeslots", []):
        parse_ts(alt.get("hour", "00:00:00"), alt.get("timeslots", []))
    return rows


def main() -> None:
    token, awsalb = load_token()
    start = date.today()
    dates = date_range_weeks(start, 4)
    print(f"Fetching {len(dates)} days x {len(CLUBS)} clubs ({dates[0]} .. {dates[-1]})")

    all_rows: list[dict] = []
    auth_failed = False

    for club in CLUBS:
        print(f"\n=== {club['name']} (id={club['id']}) ===")
        hdrs = headers(token, awsalb, club["id"])
        for day in dates:
            day_rows: list[dict] = []
            for probe in PROBE_TIMES:
                url = (
                    f"https://www.easycancha.com/api/sports/{club['sport_id']}"
                    f"/clubs/{club['id']}/timeslots"
                    f"?date={day}&time={probe}&timespan={club['timespan']}"
                )
                data = fetch_json(url, hdrs)
                if data is None:
                    if probe == PROBE_TIMES[0]:
                        auth_failed = True
                    continue
                if data.get("error"):
                    err = data.get("error")
                    if err in (401, 403) or "auth" in str(err).lower():
                        auth_failed = True
                    break
                rows = extract_rows(data, club["name"], day)
                if rows:
                    day_rows = rows
                    break
                time.sleep(0.15)
            print(f"  {day}: {len(day_rows)} slots")
            all_rows.extend(day_rows)
            time.sleep(0.25)

    if auth_failed and not all_rows:
        raise SystemExit("Auth failed or no data — refresh token via firecrawl login.")

    all_rows.sort(key=lambda r: (r["Club Name"], r["Date"], r["Time Slot"], r["Field/Court"]))

    # Merge with existing CSV unless --replace
    import sys

    existing: list[dict] = []
    if OUT_CSV.exists() and "--replace" not in sys.argv:
        existing = list(csv.DictReader(OUT_CSV.open(encoding="utf-8")))
        keys = {(r["Club Name"], r["Field/Court"], r["Date"], r["Time Slot"]) for r in existing}
        merged = existing + [r for r in all_rows if (r["Club Name"], r["Field/Court"], r["Date"], r["Time Slot"]) not in keys]
        all_rows = merged
        all_rows.sort(key=lambda r: (r["Club Name"], r["Date"], r["Time Slot"], r["Field/Court"]))

    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Club Name", "Field/Court", "Date", "Time Slot", "Price"])
        w.writeheader()
        w.writerows(all_rows)

    print(f"\nWrote {len(all_rows)} rows -> {OUT_CSV}")


if __name__ == "__main__":
    main()
