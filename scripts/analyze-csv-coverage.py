"""Report CSV coverage: club x court x weekday x time slot. Writes coverage-gaps.json."""
import csv
import json
from datetime import date
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "barranquilla_padel_prices.csv"
OUT_PATH = ROOT / "coverage-gaps.json"

WEEKDAY_ES = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]

rows = list(csv.DictReader(open(CSV_PATH, newline="", encoding="utf-8")))

date_to_wd: dict[str, int] = {}
for d in sorted({r["Date"].strip() for r in rows}):
    date_to_wd[d] = date.fromisoformat(d).weekday()

DATE_FOR_WD = {wd: d for d, wd in date_to_wd.items()}

present: dict[str, dict[str, dict[int, set[str]]]] = defaultdict(
    lambda: defaultdict(lambda: defaultdict(set))
)

for r in rows:
    club = r["Club Name"].strip()
    court = (r.get("Field/Court") or r.get("Court") or "").strip() or "(sin nombre)"
    wd = date_to_wd[r["Date"].strip()]
    tm = r["Time Slot"].strip()
    present[club][court][wd].add(tm)

club_all_times: dict[str, set[str]] = defaultdict(set)
for club, courts in present.items():
    for court, wds in courts.items():
        for times in wds.values():
            club_all_times[club].update(times)

summary = {
    "dates": sorted(date_to_wd.keys()),
    "weekdaysRepresented": [WEEKDAY_ES[i] for i in sorted(set(date_to_wd.values()))],
    "allSevenWeekdays": len(set(date_to_wd.values())) == 7,
    "note": "Solo hay 1 fecha por dia de la semana. Huecos = sin fila en EasyCancha (no disponible o no scrapeado).",
    "clubs": {},
}

total_gaps = 0

for club in sorted(present.keys()):
    courts = sorted(present[club].keys())
    expected_times = sorted(club_all_times[club])
    club_info = {
        "courts": courts,
        "timeRange": [expected_times[0], expected_times[-1]] if expected_times else [],
        "distinctTimeSlots": len(expected_times),
        "gapsByCourtWeekday": [],
        "totalGaps": 0,
        "slotsPerWeekday": {},
    }

    for wd in range(7):
        union = set()
        for c in courts:
            union |= present[club][c].get(wd, set())
        club_info["slotsPerWeekday"][WEEKDAY_ES[wd]] = {
            "date": DATE_FOR_WD.get(wd),
            "distinctSlots": len(union),
        }

    for court in courts:
        for wd in range(7):
            have = present[club][court].get(wd, set())
            missing = [t for t in expected_times if t not in have]
            if missing:
                club_info["gapsByCourtWeekday"].append(
                    {
                        "court": court,
                        "weekday": WEEKDAY_ES[wd],
                        "date": DATE_FOR_WD.get(wd),
                        "missingCount": len(missing),
                        "missingTimes": missing,
                    }
                )
                club_info["totalGaps"] += len(missing)
                total_gaps += len(missing)

    summary["clubs"][club] = club_info

summary["totalGapsCourtWeekdayTime"] = total_gaps

OUT_PATH.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

# Compact stdout
print("Fechas:", ", ".join(summary["dates"]))
print("7 dias de semana:", summary["allSevenWeekdays"])
print("Total huecos (cancha x dia_semana x hora en rango del club):", total_gaps)
print()
for club, info in summary["clubs"].items():
    print(f"{club}")
    print(f"  Canchas: {info['courts']}")
    print(f"  Horarios en scrape: {info['timeRange'][0]}-{info['timeRange'][1]} ({info['distinctTimeSlots']} slots)")
    for wd, s in info["slotsPerWeekday"].items():
        print(f"  {wd} ({s['date']}): {s['distinctSlots']} horarios con precio (alguna cancha)")
    print(f"  Huecos detallados: {info['totalGaps']}")
    for g in info["gapsByCourtWeekday"][:3]:
        print(f"    - {g['court']} / {g['weekday']}: {g['missingCount']} faltan, ej. {g['missingTimes'][:5]}")
    if len(info["gapsByCourtWeekday"]) > 3:
        print(f"    ... +{len(info['gapsByCourtWeekday']) - 3} grupos mas")
    print()

print(f"Detalle completo: {OUT_PATH}")
