import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/utils/dates";

function getTwilioEnv() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

function getOwnerPhone(): string | null {
  return process.env.OWNER_WHATSAPP_PHONE ?? null;
}

async function send(to: string, body: string): Promise<void> {
  const env = getTwilioEnv();
  if (!env) return;

  const phone = to.startsWith("+") ? to : `+${to}`;
  const { default: twilio } = await import("twilio");
  const client = twilio(env.sid, env.token);

  await client.messages.create({
    from: `whatsapp:${env.from}`,
    to: `whatsapp:${phone}`,
    body,
  });
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

/** Paid players in a match with a whatsapp_phone, excluding excludePlayerId. */
async function getPaidPlayerPhones(
  matchId: string,
  excludePlayerId: string,
): Promise<{ phone: string; name: string }[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("match_players")
    .select("player_id, profiles(full_name, whatsapp_phone)")
    .eq("match_id", matchId)
    .eq("status", "paid")
    .neq("player_id", excludePlayerId);

  if (error || !data) return [];

  return data
    .map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        phone: (profile as { whatsapp_phone?: string | null } | null)?.whatsapp_phone ?? "",
        name: (profile as { full_name?: string | null } | null)?.full_name ?? "Jugador",
      };
    })
    .filter((p) => p.phone.trim() !== "");
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
    `🎾 *¡Tu partido está creado, ${params.hostName}!*`,
    ``,
    `📍 ${params.venueName}`,
    `📅 ${formatMatchDate(params.scheduledAt)}`,
    `👥 1/${params.maxPlayers} jugadores — ¡Comparte el link para llenar!`,
    ``,
    `🔗 ${appUrl}/matches/${params.matchId}`,
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
    `🎾 *Nuevo partido creado en PadelYa!*`,
    ``,
    `📍 ${params.venueName}`,
    `📅 ${formatMatchDate(params.scheduledAt)}`,
    `👤 Creado por: ${params.hostName}`,
    `🟡 Estado: 1/4 jugadores`,
    ``,
    `🔗 ${appUrl}/matches/${params.matchId}`,
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
  const roster = `${params.currentPaidCount}/${params.maxPlayers} jugadores`;

  const ownerPhone = getOwnerPhone();
  if (ownerPhone) {
    const ownerMsg = [
      `🎾 *${params.newPlayerName} se unió a un partido*`,
      ``,
      `📍 ${params.venueName}`,
      `📅 ${formatMatchDate(params.scheduledAt)}`,
      `👥 ${roster}`,
      ``,
      `🔗 ${matchLink}`,
    ].join("\n");
    await safeSend(ownerPhone, ownerMsg);
  }

  const others = await getPaidPlayerPhones(params.matchId, params.newPlayerId);
  if (others.length === 0) return;

  const playerMsg = [
    `🎾 *${params.newPlayerName} se unió a tu partido*`,
    ``,
    `📍 ${params.venueName}`,
    `📅 ${formatMatchDate(params.scheduledAt)}`,
    `👥 ${roster}`,
    ``,
    `🔗 ${matchLink}`,
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
      `✅ *¡Partido lleno en PadelYa!*`,
      ``,
      `📍 ${params.venueName}`,
      `📅 ${formatMatchDate(params.scheduledAt)}`,
      `👥 ${roster} — ¡Todo listo para jugar!`,
      ``,
      `🔗 ${matchLink}`,
    ].join("\n");
    await safeSend(ownerPhone, ownerMsg);
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("match_players")
    .select("player_id, profiles(whatsapp_phone)")
    .eq("match_id", params.matchId)
    .eq("status", "paid");

  const phones = (data ?? [])
    .map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return (profile as { whatsapp_phone?: string | null } | null)?.whatsapp_phone ?? "";
    })
    .filter((p) => p.trim() !== "");

  if (phones.length === 0) return;

  const playerMsg = [
    `✅ *¡Tu partido está lleno!*`,
    ``,
    `📍 ${params.venueName}`,
    `📅 ${formatMatchDate(params.scheduledAt)}`,
    `👥 ${roster} — ¡Todo listo para jugar!`,
    ``,
    `🔗 ${matchLink}`,
  ].join("\n");

  await Promise.all(phones.map((phone) => safeSend(phone, playerMsg)));
}
