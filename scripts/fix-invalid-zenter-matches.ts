/**
 * Cancela partidos con venue "Padel Zenter" genérico (club inválido).
 * Renombra sedes antiguas al nombre canónico nuevo.
 * Uso: npx tsx scripts/fix-invalid-zenter-matches.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function isGenericPadelZenter(name: string): boolean {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (n.includes("del rio") || n.includes("arenosa")) return false;
  return n === "padel zenter" || n === "padel zenter barranquilla" || /^padel zenter$/i.test(name.trim());
}

const RESTORE_CANONICAL: [RegExp, string][] = [
  [/^del r[ií]o$/i, "Padel Zenter del Rio"],
  [/^la arenosa$/i, "Padel Zenter La Arenosa"],
];

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data: matches, error } = await supabase.from("matches").select("id, venue_name, status");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  for (const row of matches ?? []) {
    const venue = row.venue_name as string;

    if (isGenericPadelZenter(venue)) {
      const { error: updErr } = await supabase
        .from("matches")
        .update({
          status: "cancelled_by_organizer",
          cancel_reason:
            "Club inválido: elige Padel Zenter del Rio o Padel Zenter La Arenosa (no existe solo “Padel Zenter”).",
        })
        .eq("id", row.id);
      if (updErr) console.error(row.id, updErr.message);
      else console.log(`Cancelled ${row.id} (${venue})`);
      continue;
    }

    for (const [pattern, canonical] of RESTORE_CANONICAL) {
      if (pattern.test(venue.trim()) && venue !== canonical) {
        const { error: renErr } = await supabase
          .from("matches")
          .update({ venue_name: canonical })
          .eq("id", row.id);
        if (renErr) console.error(row.id, renErr.message);
        else console.log(`Renamed ${row.id}: "${venue}" -> "${canonical}"`);
        break;
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
