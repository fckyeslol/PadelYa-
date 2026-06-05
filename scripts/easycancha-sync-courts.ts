/**
 * Alinea public.venue_courts con la cantidad REAL de canchas de cada club en
 * EasyCancha (distintos court_id vistos en easycancha_slots). Así el tope de
 * disponibilidad lo manda EasyCancha: si EasyCancha dice 4 canchas, PadelYa tiene 4.
 *
 *   npx tsx scripts/easycancha-sync-courts.ts            # dry-run (muestra el plan)
 *   npx tsx scripts/easycancha-sync-courts.ts --apply    # inserta las canchas faltantes
 *
 * Idempotente y aditivo: nunca borra ni renombra canchas existentes (no rompe los
 * venue_court_id que ya referencian partidos); solo agrega las que faltan.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { EASYCANCHA_CLUBS } from "../config/easycancha";

function loadEnvLocal(): void {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    if (!process.env[t.slice(0, i)]) process.env[t.slice(0, i)] = t.slice(i + 1);
  }
}

async function main() {
  loadEnvLocal();
  const apply = process.argv.includes("--apply");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  console.log(apply ? "== APLICANDO ==" : "== DRY-RUN (usá --apply para ejecutar) ==");

  for (const club of EASYCANCHA_CLUBS) {
    // Canchas reales según EasyCancha = court_id distintos vistos.
    const { data: slots } = await supabase
      .from("easycancha_slots")
      .select("court_id")
      .eq("club_id", club.id);
    const ecCourtIds = new Set((slots ?? []).map((s) => s.court_id));
    const ecCount = ecCourtIds.size;

    // Canchas activas que ya tiene PadelYa para esa sede.
    const { data: existing } = await supabase
      .from("venue_courts")
      .select("id, sort_order")
      .eq("venue_id", club.venueId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    const existingCount = existing?.length ?? 0;
    const maxSort = (existing ?? []).reduce((m, c) => Math.max(m, c.sort_order ?? 0), 0);

    const need = ecCount - existingCount;
    const status = need > 0 ? `→ AGREGAR ${need}` : need < 0 ? `(PadelYa tiene ${-need} de más)` : "= OK";
    console.log(
      `${club.venueId.padEnd(24)} easycancha=${ecCount}  padelya=${existingCount}  ${status}`,
    );

    if (apply && need > 0) {
      const rows = Array.from({ length: need }, (_, i) => ({
        venue_id: club.venueId,
        name: `Cancha ${existingCount + i + 1}`,
        sort_order: maxSort + i + 1,
      }));
      const { error } = await supabase.from("venue_courts").insert(rows);
      if (error) console.log(`  ERROR insertando: ${error.message}`);
      else console.log(`  + ${rows.map((r) => r.name).join(", ")}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
