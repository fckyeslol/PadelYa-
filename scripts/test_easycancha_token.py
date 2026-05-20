import json, urllib.request, re
from pathlib import Path
raw = Path(".firecrawl/cookies_out.json").read_text(encoding="utf-8")
m = re.search(r"token%22%3A%22([^%]+)", raw)
token = m.group(1) if m else ""
url = "https://www.easycancha.com/api/sports/7/clubs/1125/timeslots?date=2026-05-24&time=16:00&timespan=90"
req = urllib.request.Request(
    url,
    headers={
        "Authorization": token,
        "Accept": "application/json",
        "Cookie": f"authtoken={token}; country=CO",
    },
)
try:
    r = urllib.request.urlopen(req, timeout=15)
    d = json.loads(r.read())
    print("OK", "error" in d, len(d.get("alternative_timeslots", [])))
except Exception as e:
    print("FAIL", e)
