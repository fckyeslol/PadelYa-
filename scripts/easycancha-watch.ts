/**
 * Gestiona los watches de alertas de EasyCancha (tabla easycancha_slot_watches).
 *
 *   npx tsx scripts/easycancha-watch.ts list
 *   npx tsx scripts/easycancha-watch.ts add <email> [club=1125] [weekday=6] [from=18:00] [to=22:00]
 *   npx tsx scripts/easycancha-watch.ts remove <email>
 *
 * Sin filtros, "add <email>" crea un watch comodín (todos los clubes/días/horas).
 * weekday: 0=domingo … 6=sábado.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

function parseFlags(args: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of args) {
    const i = a.indexOf("=");
    if (i > 0) out[a.slice(0, i)] = a.slice(i + 1);
  }
  return out;
}

async function list(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase
    .from("easycancha_slot_watches")
    .select("id, notify_email, club_id, weekday, time_from, time_to, active")
    .order("created_at");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    console.log("(sin watches)");
    return;
  }
  for (const w of data) {
    const club = w.club_id ?? "todos";
    const day = w.weekday ?? "todos";
    const range = w.time_from || w.time_to ? `${w.time_from ?? "00:00"}–${w.time_to ?? "23:59"}` : "todo";
    console.log(`${w.active ? "●" : "○"} ${w.notify_email}  club:${club}  día:${day}  hora:${range}  [${w.id}]`);
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const [cmd, email, ...rest] = process.argv.slice(2);

  if (cmd === "list") {
    await list(supabase);
    return;
  }
  if (cmd === "remove") {
    if (!email) throw new Error("uso: remove <email>");
    const { error } = await supabase.from("easycancha_slot_watches").delete().eq("notify_email", email);
    if (error) throw new Error(error.message);
    console.log(`watch(es) de ${email} eliminados`);
    return;
  }
  if (cmd === "add") {
    if (!email) throw new Error("uso: add <email> [club=N] [weekday=N] [from=HH:MM] [to=HH:MM]");
    const f = parseFlags(rest);
    const row = {
      notify_email: email,
      club_id: f.club ? Number(f.club) : null,
      weekday: f.weekday ? Number(f.weekday) : null,
      time_from: f.from ?? null,
      time_to: f.to ?? null,
    };
    const { error } = await supabase.from("easycancha_slot_watches").insert(row);
    if (error) throw new Error(error.message);
    console.log(`watch agregado: ${JSON.stringify(row)}`);
    return;
  }

  console.log("comandos: list | add <email> [club= weekday= from= to=] | remove <email>");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
