import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/utils/dates";
import { formatCop } from "@/utils/currency";

/**
 * WhatsApp Business Cloud API (Meta) — template-based notifications.
 *
 * Proactive messages outside the 24h customer-service window REQUIRE a
 * pre-approved template. Each function below maps to a template that must
 * exist (and be approved) in WhatsApp Manager with the EXACT name and
 * variable order documented next to TEMPLATES.
 */

/** Template names — must match exactly what's created & approved in Meta. */
const TEMPLATES = {
  /** partido_creado · vars: [hostName, venue, date, link] · Utility */
  matchCreated: "partido_creado",
  /** nuevo_partido · vars: [venue, date, level, price, link] · Marketing */
  newMatch: "nuevo_partido",
  /** jugador_unido · vars: [playerName, venue, date, roster, link] · Utility */
  playerJoined: "jugador_unido",
  /** partido_lleno · vars: [venue, date, link] · Utility */
  matchFull: "partido_lleno",
} as const;

/** Language code of the approved templates (must match Meta). */
const TEMPLATE_LANG = "es";

const SKILL_LABELS: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

function getMetaWaEnv() {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const accessToken = process.env.WA_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken };
}

function getOwnerPhone(): string | null {
  return process.env.OWNER_WHATSAPP_PHONE ?? null;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://padelya.co";
}

function matchLink(matchId: string): string {
  return `${appUrl()}/matches/${matchId}`;
}

/** Sends one approved template message. Throws on API error. */
async function sendTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
): Promise<void> {
  const env = getMetaWaEnv();
  if (!env) return; // silently skip if not configured

  // Meta requires phone without leading + — just digits with country code.
  const phone = to.replace(/^\+/, "");

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${env.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: TEMPLATE_LANG },
          components: bodyParams.length
            ? [
                {
                  type: "body",
                  parameters: bodyParams.map((text) => ({ type: "text", text })),
                },
              ]
            : [],
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp template send failed (${res.status}): ${err}`);
  }
}

async function safeSendTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
): Promise<void> {
  try {
    await sendTemplate(to, templateName, bodyParams);
  } catch (err) {
    console.error("[WhatsApp] template send failed", { to, templateName, error: err });
  }
}

/** Fan-out a template to many phones in bounded-concurrency batches. */
async function sendTemplateToMany(
  phones: string[],
  templateName: string,
  bodyParams: string[],
): Promise<void> {
  const BATCH = 20;
  const unique = [...new Set(phones.filter((p) => p !== ""))];
  for (let i = 0; i < unique.length; i += BATCH) {
    const slice = unique.slice(i, i + BATCH);
    await Promise.all(slice.map((ph) => safeSendTemplate(ph, templateName, bodyParams)));
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

type ProfilePhoneRow = {
  whatsapp_phone?: string | null;
  phone?: string | null;
  full_name?: string | null;
};

function bestPhone(profile: ProfilePhoneRow | null): string {
  return (profile?.whatsapp_phone ?? profile?.phone ?? "").trim();
}

/** Active players (paid + pending) in a match with a phone, excluding one id. */
async function getActivePlayerPhones(
  matchId: string,
  excludePlayerId: string,
): Promise<string[]> {
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

  return (profiles ?? []).map((p) => bestPhone(p as ProfilePhoneRow)).filter((p) => p !== "");
}

/** Notifies the host that their match is published. Template: partido_creado. */
export async function notifyHostMatchCreated(params: {
  hostPhone: string;
  hostName: string;
  matchId: string;
  venueName: string;
  scheduledAt: string | null;
  maxPlayers: number;
}): Promise<void> {
  await safeSendTemplate(params.hostPhone, TEMPLATES.matchCreated, [
    params.hostName,
    params.venueName,
    formatMatchDate(params.scheduledAt),
    matchLink(params.matchId),
  ]);
}

/**
 * Broadcasts a newly published match to the owner + every registered user
 * that has a phone. Template: nuevo_partido.
 *
 * NOTE: this is a marketing-style broadcast. Meta requires recipients to have
 * opted in; sending to users who never opted in risks the number being blocked.
 * excludePlayerId skips the host (who already got partido_creado).
 */
export async function notifyAllUsersNewMatch(params: {
  matchId: string;
  venueName: string;
  scheduledAt: string | null;
  skillLevel: string;
  feeCop: number;
  excludePlayerId?: string;
}): Promise<void> {
  const bodyParams = [
    params.venueName,
    formatMatchDate(params.scheduledAt),
    SKILL_LABELS[params.skillLevel] ?? params.skillLevel,
    formatCop(params.feeCop),
    matchLink(params.matchId),
  ];

  const ownerPhone = getOwnerPhone();
  if (ownerPhone) {
    await safeSendTemplate(ownerPhone, TEMPLATES.newMatch, bodyParams);
  }

  const supabase = getSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, whatsapp_phone, phone")
    .or("whatsapp_phone.not.is.null,phone.not.is.null");

  const phones = (profiles ?? [])
    .filter((p) => p.id !== params.excludePlayerId)
    .map((p) => bestPhone(p as ProfilePhoneRow))
    .filter((p) => p !== "" && p !== ownerPhone);

  await sendTemplateToMany(phones, TEMPLATES.newMatch, bodyParams);
}

/**
 * Notifies the host + existing players when a new player joins.
 * Template: jugador_unido.
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
  const bodyParams = [
    params.newPlayerName,
    params.venueName,
    formatMatchDate(params.scheduledAt),
    `${params.currentPaidCount}/${params.maxPlayers}`,
    matchLink(params.matchId),
  ];

  const phones = await getActivePlayerPhones(params.matchId, params.newPlayerId);
  const ownerPhone = getOwnerPhone();
  if (ownerPhone) phones.push(ownerPhone);

  await sendTemplateToMany(phones, TEMPLATES.playerJoined, bodyParams);
}

/** Notifies the owner + all players when a match becomes full. Template: partido_lleno. */
export async function notifyMatchFull(params: {
  matchId: string;
  venueName: string;
  scheduledAt: string | null;
  maxPlayers: number;
}): Promise<void> {
  const bodyParams = [
    params.venueName,
    formatMatchDate(params.scheduledAt),
    matchLink(params.matchId),
  ];

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("match_players")
    .select("player_id, profiles(phone, whatsapp_phone)")
    .eq("match_id", params.matchId)
    .eq("status", "paid");

  const phones = (data ?? [])
    .map((row) => {
      const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as
        | ProfilePhoneRow
        | null;
      return bestPhone(profile);
    })
    .filter((p) => p !== "");

  const ownerPhone = getOwnerPhone();
  if (ownerPhone) phones.push(ownerPhone);

  await sendTemplateToMany(phones, TEMPLATES.matchFull, bodyParams);
}
