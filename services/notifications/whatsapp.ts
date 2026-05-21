import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/utils/dates";

function getUltraMsgEnv() {
  const instance = process.env.ULTRAMSG_INSTANCE;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instance || !token) return null;
  return { instance, token };
}

function getOwnerPhone(): string | null {
  return process.env.OWNER_WHATSAPP_PHONE ?? null;
}

async function send(to: string, body: string): Promise<void> {
  const env = getUltraMsgEnv();
  if (!env) return;

  const phone = to.startsWith("+") ? to : `+${to}`;

  const res = await fetch(`https://api.ultramsg.com/${env.instance}/messages/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: env.token, to: phone, body }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`UltraMsg send failed (${res.status}): ${err}`);
  }
}

async function safeSend(to: string, body: string): Promise<void> {
  try {
    await send(to, body);
  } catch (err) {
    console.error("[WhatsApp] send failed", { to, error: err });
  }
}

function formatMatchDate(scheduledAt: string | null): string {
  if (!scheduledAt) return "fecha por confirmar";
  try {
    return formatDateTime(scheduledAt);
  } catch {
    return scheduledAt;
  }
}

type ProfilePhoneRow = { whatsapp_phone?: string | null; phone?: string | null; full_name?: string | null };

function bestPhone(profile: ProfilePhoneRow | null): string {
  return (profile?.whatsapp_phone ?? profile?.phone ?? "").trim();
}

/** Paid players in a match with a phone, excluding excludePlayerId. */
async function getPaidPlayerPhones(
  matchId: string,
  excludePlayerId: string,
): Promise<{ phone: string; name: string }[]> {
  const supabase = getSupabaseAdminClient();

  const { data: players, error } = await supabase
    .from("match_players")
    .select("player_id")
    .eq("match_id", matchId)
    .in("status", ["paid", "pending_payment"])
    .neq("player_id", excludePlayerId);

  if (error || !players?.length) return [];

  const playerIds = players.map((p) => p.player_id).filter(Boolean) as string[];
  if (!playerIds.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, phone, whatsapp_phone")
    .in("id", playerIds);

  if (profilesError) return [];

  return (profiles ?? [])
    .map((p) => ({
      phone: bestPhone(p as ProfilePhoneRow),
      name: p.full_name ?? "Jugador",
    }))
    .filter((p) => p.phone !== "");
}

/** Notifies the host (creator) when their match is confirmed and they're in. */
export async function notifyHostMatchCreated(params: {
  hostPhone: string;
  hostName: string;
  matchId: string;
  venueName: string;
  scheduledAt: string | null;
  maxPlayers: number;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://padel-ya.uk";
  const body = [
    `*PadelYa!*`,
    ``,
    `Hola ${params.hostName}, tu partido ha sido creado exitosamente.`,
    ``,
    `Cancha: ${params.venueName}`,
    `Fecha: ${formatMatchDate(params.scheduledAt)}`,
    `Jugadores: 1/${params.maxPlayers}`,
    ``,
    `Comparte este link para llenar el partido:`,
    `${appUrl}/matches/${params.matchId}`,
  ].join("\n");

  await safeSend(params.hostPhone, body);
}

/** Notifies the owner when the host creates a game and joins (1st paid slot). */
export async function notifyOwnerNewGame(params: {
  matchId: string;
  hostName: string;
  venueName: string;
  scheduledAt: string | null;
}): Promise<void> {
  const ownerPhone = getOwnerPhone();
  if (!ownerPhone) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://padel-ya.uk";
  const body = [
    `*PadelYa! — Nuevo partido*`,
    ``,
    `${params.hostName} acaba de crear un partido.`,
    ``,
    `Cancha: ${params.venueName}`,
    `Fecha: ${formatMatchDate(params.scheduledAt)}`,
    `Estado: 1/4 jugadores`,
    ``,
    `${appUrl}/matches/${params.matchId}`,
  ].join("\n");

  await safeSend(ownerPhone, body);
}

/** Notifies the owner + all existing players each time a new player joins. */
export async function notifyOnPlayerJoined(params: {
  matchId: string;
  newPlayerName: string;
  newPlayerId: string;
  venueName: string;
  scheduledAt: string | null;
  currentPaidCount: number;
  maxPlayers: number;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://padel-ya.uk";
  const matchLink = `${appUrl}/matches/${params.matchId}`;
  const roster = `${params.currentPaidCount}/${params.maxPlayers}`;

  const ownerPhone = getOwnerPhone();
  if (ownerPhone) {
    const ownerMsg = [
      `*PadelYa! — Jugador unido*`,
      ``,
      `${params.newPlayerName} se unio a un partido.`,
      ``,
      `Cancha: ${params.venueName}`,
      `Fecha: ${formatMatchDate(params.scheduledAt)}`,
      `Estado: ${roster} jugadores`,
      ``,
      `${matchLink}`,
    ].join("\n");
    await safeSend(ownerPhone, ownerMsg);
  }

  const others = await getPaidPlayerPhones(params.matchId, params.newPlayerId);
  if (others.length === 0) return;

  const playerMsg = [
    `*PadelYa!*`,
    ``,
    `${params.newPlayerName} se unio a tu partido.`,
    ``,
    `Cancha: ${params.venueName}`,
    `Fecha: ${formatMatchDate(params.scheduledAt)}`,
    `Jugadores: ${roster}`,
    ``,
    `${matchLink}`,
  ].join("\n");

  await Promise.all(others.map((p) => safeSend(p.phone, playerMsg)));
}

/** Notifies the owner + all players when a match becomes full (4/4). */
export async function notifyMatchFull(params: {
  matchId: string;
  venueName: string;
  scheduledAt: string | null;
  maxPlayers: number;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://padel-ya.uk";
  const matchLink = `${appUrl}/matches/${params.matchId}`;
  const roster = `${params.maxPlayers}/${params.maxPlayers}`;

  const ownerPhone = getOwnerPhone();
  if (ownerPhone) {
    const ownerMsg = [
      `*PadelYa! — Partido lleno*`,
      ``,
      `Un partido acaba de llenarse.`,
      ``,
      `Cancha: ${params.venueName}`,
      `Fecha: ${formatMatchDate(params.scheduledAt)}`,
      `Jugadores: ${roster}`,
      ``,
      `${matchLink}`,
    ].join("\n");
    await safeSend(ownerPhone, ownerMsg);
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("match_players")
    .select("player_id, profiles(phone, whatsapp_phone)")
    .eq("match_id", params.matchId)
    .eq("status", "paid");

  const phones = (data ?? [])
    .map((row) => {
      const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as ProfilePhoneRow | null;
      return bestPhone(profile);
    })
    .filter((p) => p !== "");

  if (phones.length === 0) return;

  const playerMsg = [
    `*PadelYa!*`,
    ``,
    `Tu partido esta completo. Ya son ${roster} jugadores confirmados.`,
    ``,
    `Cancha: ${params.venueName}`,
    `Fecha: ${formatMatchDate(params.scheduledAt)}`,
    ``,
    `${matchLink}`,
  ].join("\n");

  await Promise.all(phones.map((phone) => safeSend(phone, playerMsg)));
}
