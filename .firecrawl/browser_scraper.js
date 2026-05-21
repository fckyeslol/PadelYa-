/**
 * EasyCancha price scraper — paste in browser console while logged in at easycancha.com
 * Downloads easycancha_pricing.json when done (~10-15 min for 6 clubs × 42 days)
 */

const CLUBS = [
  { id: 1125, name: "PADEL ZENTER DEL RIO",       sport_id: 7, timespan: 90 },
  { id: 1475, name: "PADEL ZENTER LA ARENOSA",    sport_id: 7, timespan: 90 },
  { id: 1442, name: "Padel Park Barranquilla",     sport_id: 7, timespan: 60 },
  { id: 1526, name: "La Jaula Padel Barranquilla", sport_id: 7, timespan: 90 },
  { id: 1675, name: "X3 Padel Club",              sport_id: 7, timespan: 90 },
  { id: 1866, name: "Ace Padel Club",             sport_id: 7, timespan: 90 },
];

// 6 weeks from 2026-05-20
const dates = [];
const start = new Date("2026-05-20T12:00:00");
for (let i = 0; i < 42; i++) {
  const d = new Date(start);
  d.setDate(start.getDate() + i);
  dates.push(d.toISOString().split("T")[0]);
}

// 3 probe times is enough — alt_timeslots gives the full-day picture on first hit
const PROBE_TIMES = ["07:00", "12:00", "18:00"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchSlots(club, date, time) {
  const url =
    `https://www.easycancha.com/api/sports/${club.sport_id}` +
    `/clubs/${club.id}/timeslots` +
    `?date=${date}&time=${time}&timespan=${club.timespan}`;
  try {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function parseSlots(data) {
  const slots = {};

  function add(time5, ts) {
    const pi = ts.priceInfo || {};
    const amount = parseInt(pi.amount || pi.app_amount || 0, 10);
    if (amount > 0 && !(time5 in slots)) {
      slots[time5] = amount;
    }
  }

  for (const ts of data.timeslots || []) {
    const t = (ts.local_start_time || "").substring(0, 5);
    if (t.length === 5) add(t, ts);
  }

  for (const alt of data.alternative_timeslots || []) {
    const t = (alt.hour || "").substring(0, 5);
    if (t.length !== 5) continue;
    for (const ts of alt.timeslots || []) {
      add(t, ts);
    }
  }

  return slots;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const raw = {};
const total = CLUBS.length * dates.length;
let done = 0;

for (const club of CLUBS) {
  raw[club.id] = { name: club.name, dates: {} };
  console.log(`\n── ${club.name} ──`);

  for (const date of dates) {
    const daySlots = {};
    let gotFullDay = false;

    for (const time of PROBE_TIMES) {
      const data = await fetchSlots(club, date, time);
      if (!data) { await sleep(300); continue; }

      const slots = parseSlots(data);
      for (const [t, p] of Object.entries(slots)) {
        if (!(t in daySlots)) daySlots[t] = p;
      }

      if ((data.alternative_timeslots || []).length > 0) {
        gotFullDay = true;
        break; // full-day data captured
      }

      await sleep(250);
    }

    if (Object.keys(daySlots).length > 0) {
      raw[club.id].dates[date] = daySlots;
    }

    done++;
    if (done % 6 === 0) {
      const pct = Math.round((done / total) * 100);
      const slotCount = Object.keys(daySlots).length;
      console.log(`[${pct}%] ${club.name} | ${date} | ${slotCount} slots${gotFullDay ? " (full)" : ""}`);
    }

    await sleep(350);
  }
}

// ── Download JSON ─────────────────────────────────────────────────────────────

const blob = new Blob([JSON.stringify(raw, null, 2)], { type: "application/json" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "easycancha_pricing.json";
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);

console.log("\n✓ Done! File downloaded as easycancha_pricing.json");
console.log("Clubs scraped:", CLUBS.length);
console.log("Total days:", dates.length);
const totalSlots = Object.values(raw).reduce((s, c) =>
  s + Object.values(c.dates).reduce((s2, d) => s2 + Object.keys(d).length, 0), 0);
console.log("Total slots captured:", totalSlots);
