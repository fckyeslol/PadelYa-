/**
 * Recalcula org_fee_cop de todos los partidos desde barranquilla_padel_prices.csv.
 * Uso: npx tsx scripts/backfill-org-fees.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { bogotaDateAndTime, getPlayerFeeByVenueName, hasCsvPricingForVenueName } from "../config/pricing";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i);
    const val = t.slice(i + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, venue_name, scheduled_at, org_fee_cop");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const row of matches ?? []) {
    const venue = row.venue_name as string;
    const scheduledAt = row.scheduled_at as string;
    const { date, time } = bogotaDateAndTime(scheduledAt);

    if (!hasCsvPricingForVenueName(venue)) {
      skipped++;
      failures.push(`${row.id}: sin tarifa CSV (${venue})`);
      continue;
    }

    const fee = getPlayerFeeByVenueName(venue, date, time);
    if (fee === null) {
      skipped++;
      failures.push(`${row.id}: sin slot ${date} ${time} (${venue})`);
      continue;
    }

    if (fee === row.org_fee_cop) continue;

    const { error: updErr } = await supabase
      .from("matches")
      .update({ org_fee_cop: fee })
      .eq("id", row.id);

    if (updErr) {
      failures.push(`${row.id}: ${updErr.message}`);
      continue;
    }
    updated++;
    console.log(`${row.id} ${venue} ${date} ${time}: ${row.org_fee_cop} -> ${fee}`);
  }

  console.log(`\nDone. Updated: ${updated}, skipped: ${skipped}, total: ${matches?.length ?? 0}`);
  if (failures.length) {
    console.log("\nNot updated:");
    for (const f of failures) console.log(`  ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
