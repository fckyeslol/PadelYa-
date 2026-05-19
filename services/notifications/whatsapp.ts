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

/** Paid whatsapp phones of all OTHER players in a match (excluding excludePlayerId). */
async function getPaidPlayerPhones(
  matchId: string,
  excludePlayerId: string,
): Promise<{ playerId: string; phone: string; name: string }[]> {
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
        playerId: row.player_id as string,
        phone: (profile as { whatsapp_phone?: string | null } | null)?.whatsapp_phone ?? "",
        name: (profile as { full_name?: string | null } | null)?.full_name ?? "Jugador",
      };
    })
    .filter((p) => p.phone.trim() !== "");
}

/**
 * Notifies the owner when a new game is created and the host joins (first paid slot).
 */
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

/**
 * Notifies the owner (and all existing players) each time a new player joins.
 */
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

  // Message to the owner
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

  // Message to the other existing players in the match
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

/**
 * Notifies the owner and all players when a match becomes full.
 */
export async function notifyMatchFull(params: {
  matchId: string;
  venueName: string;
  scheduledAt: string | null;
  maxPlayers: number;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://padel-ya.uk";
  const matchLink = `${appUrl}/matches/${params.matchId}`;
  const roster = `${params.maxPlayers}/${params.maxPlayers}`;

  // Notify owner
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

  // Notify all players in the match
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("match_players")
    .select("player_id, profiles(full_name, whatsapp_phone)")
    .eq("match_id", params.matchId)
    .eq("status", "paid");

  const players = (data ?? [])
    .map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return (profile as { whatsapp_phone?: string | null } | null)?.whatsapp_phone ?? "";
    })
    .filter((p) => p.trim() !== "");

  if (players.length === 0) return;

  const playerMsg = [
    `✅ *¡Tu partido está lleno!*`,
    ``,
    `📍 ${params.venueName}`,
    `📅 ${formatMatchDate(params.scheduledAt)}`,
    `👥 ${roster} — ¡Todo listo para jugar!`,
    ``,
    `🔗 ${matchLink}`,
  ].join("\n");

  await Promise.all(players.map((phone) => safeSend(phone, playerMsg)));
}
