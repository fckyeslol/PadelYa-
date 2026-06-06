/**
 * Regenerate config/pricing-slots.json from barranquilla_padel_prices.csv
 * with the corrected 26,000 COP markup (6,500 per player × 4).
 *
 * Usage: node scripts/regen-pricing.js
 */
const fs = require("fs");
const path = require("path");

const MARKUP = 26_000;
const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(ROOT, "barranquilla_padel_prices.csv");
const OUT_PATH = path.join(ROOT, "config", "pricing-slots.json");

const VENUE_MAP = {
  "PADEL ZENTER DEL RIO": "padel-zenter-del-rio",
  "PADEL ZENTER LA ARENOSA": "padel-zenter-la-arenosa",
  "Pádel Park Barranquilla": "padel-park",
  "La Jaula Padel Barranquilla": "la-jaula",
  "X3 Padel Club": "x3-padel-club",
  "Ace Padel Club": "ace-padel-club",
};

function parsePrice(s) {
  let t = s.replace(/\$/g, "").replace("COP", "").trim();
  t = t.replace(/,\d{2}$/, "");
  t = t.replace(/\./g, "").trim();
  return parseInt(t, 10);
}

// Simple CSV parser that handles quoted fields
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const csv = fs.readFileSync(CSV_PATH, "utf-8").split("\n");
const byDate = {};
const calendarDates = new Set();

for (let i = 1; i < csv.length; i++) {
  const line = csv[i].trim();
  if (!line) continue;
  const fields = parseCSVLine(line);
  if (fields.length < 5) continue;

  const club = fields[0].trim();
  const date = fields[2].trim();
  const time = fields[3].trim();
  const priceStr = fields[4].trim();

  const vid = VENUE_MAP[club];
  if (!vid) continue;

  const courtPrice = parsePrice(priceStr) + MARKUP;
  calendarDates.add(date);

  if (!byDate[vid]) byDate[vid] = {};
  if (!byDate[vid][date]) byDate[vid][date] = {};
  byDate[vid][date][time] = Math.max(byDate[vid][date][time] || 0, courtPrice);
}

const sortedDates = [...calendarDates].sort();

const output = {
  markupCop: MARKUP,
  source: "barranquilla_padel_prices.csv",
  calendarDates: sortedDates,
  byDate: byDate,
  fixedVenues: {
    "casa-padel": {
      courtCop: 70_000 + MARKUP,
      playerCop: Math.floor((70_000 + MARKUP) / 4),
      note: "ReservaDeportes flat rate, any time",
    },
  },
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");
console.log("Wrote " + OUT_PATH);
console.log(
  `  dates: ${sortedDates[0]} .. ${sortedDates[sortedDates.length - 1]} (${sortedDates.length} days)`,
);
for (const vid of Object.keys(byDate).sort()) {
  let total = 0;
  for (const d of Object.keys(byDate[vid])) total += Object.keys(byDate[vid][d]).length;
  console.log(`  ${vid}: ${total} slot entries`);
}

// Verify key prices
const jaula = byDate["la-jaula"]["2026-06-06"];
if (jaula) {
  console.log("\nVerification — La Jaula 2026-06-06:");
  for (const t of ["06:30", "15:30", "19:00"]) {
    if (jaula[t])
      console.log(`  ${t}: court=${jaula[t]} → player=${Math.round(jaula[t] / 4)}`);
  }
}
console.log(
  `\nCasa Padel: court=${70_000 + MARKUP} → player=${Math.floor((70_000 + MARKUP) / 4)}`,
);
