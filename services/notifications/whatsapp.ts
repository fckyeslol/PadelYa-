import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/utils/dates";
import { formatCop } from "@/utils/currency";

/**
 * WhatsApp Business Cloud API (Meta) — template-based notifications.
 *
 * Proactive messages outside the 24h window REQUIRE a pre-approved template.
 * Each template is designed with: an image header (static, brand), a clean
 * body (no raw link), a footer, and a dynamic-URL "Ver partido" button.
 *
 * The body parameters map to {{1}}, {{2}}… in order. The button URL is
 * defined in Meta as https://www.padelya.co/matches/{{1}} and the code sends
 * the matchId as that {{1}} (buttonUrlSuffix).
 */

/** Template names — must match exactly what's created & approved in Meta. */
const TEMPLATES = {
  /** partido_creado · body: [hostName, venue, date] · button: matchId · Utility */
  matchCreated: "partido_creado",
  /** nuevo_partido · body: [venue, date, level, price] · button: matchId · Marketing */
  newMatch: "nuevo_partido",
  /** jugador_unido · body: [playerName, venue, date, roster] · button: matchId · Utility */
  playerJoined: "jugador_unido",
  /** partido_lleno · body: [venue, date] · button: matchId · Utility */
  matchFull: "partido_lleno",
  /** reserva_cancha · body: [venue, when, price, courts] · sin botón · Utility */
  courtToBook: "reserva_cancha",
} as const;

/** Language code of the approved templates (must match Meta). */
const TEMPLATE_LANG = "es";

/** Graph API version. Keep current — old versions get deprecated ~2 yrs after release. */
const GRAPH_API_VERSION = "v23.0";

const SKILL_LABELS: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

type TemplateOpts = {
  bodyParams: string[];
  /** Dynamic suffix for the template's URL button (matches.../{{1}}). */
  buttonUrlSuffix?: string;
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

/**
 * The business sender number (digits only). WhatsApp rejects sending a message
 * from a number to itself, so we skip any recipient equal to it. Set
 * WA_BUSINESS_PHONE to the "De" number (e.g. 573159867166).
 */
function getBusinessPhone(): string {
  return (process.env.WA_BUSINESS_PHONE ?? "").replace(/\D/g, "");
}

/** Sends one approved template message. Throws on API error. */
async function sendTemplate(
  to: string,
  templateName: string,
  opts: TemplateOpts,
): Promise<void> {
  const env = getMetaWaEnv();
  if (!env) return; // silently skip if not configured

  // Meta requires digits only (country code, no +, no spaces/dashes).
  const phone = to.replace(/\D/g, "");
  if (!phone) return;

  // Can't send from the business number to itself — Meta rejects it.
  const businessPhone = getBusinessPhone();
  if (businessPhone && phone === businessPhone) {
    console.warn("[WhatsApp] skip self-send: recipient equals business sender number");
    return;
  }

  const components: Record<string, unknown>[] = [];
  if (opts.bodyParams.length) {
    components.push({
      type: "body",
      parameters: opts.bodyParams.map((text) => ({ type: "text", text })),
    });
  }
  if (opts.buttonUrlSuffix) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: opts.buttonUrlSuffix }],
    });
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.phoneNumberId}/messages`,
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
          components,
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
  opts: TemplateOpts,
): Promise<void> {
  try {
    await sendTemplate(to, templateName, opts);
  } catch (err) {
    console.error("[WhatsApp] template send failed", { to, templateName, error: err });
  }
}

/** Fan-out a template to many phones in bounded-concurrency batches. */
async function sendTemplateToMany(
  phones: string[],
  templateName: string,
  opts: TemplateOpts,
): Promise<void> {
  const BATCH = 20;
  const unique = [...new Set(phones.filter((p) => p !== ""))];
  for (let i = 0; i < unique.length; i += BATCH) {
    const slice = unique.slice(i, i + BATCH);
    await Promise.all(slice.map((ph) => safeSendTemplate(ph, templateName, opts)));
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
  await safeSendTemplate(params.hostPhone, TEMPLATES.matchCreated, {
    bodyParams: [params.hostName, params.venueName, formatMatchDate(params.scheduledAt)],
    buttonUrlSuffix: params.matchId,
  });
}

/**
 * Broadcasts a newly published match to the owner + every registered user
 * that opted in and has a phone. Template: nuevo_partido.
 *
 * NOTE: marketing-style broadcast. Only opted-in users receive it.
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
  const opts: TemplateOpts = {
    bodyParams: [
      params.venueName,
      formatMatchDate(params.scheduledAt),
      SKILL_LABELS[params.skillLevel] ?? params.skillLevel,
      formatCop(params.feeCop),
    ],
    buttonUrlSuffix: params.matchId,
  };

  const ownerPhone = getOwnerPhone();
  if (ownerPhone) {
    await safeSendTemplate(ownerPhone, TEMPLATES.newMatch, opts);
  }

  const supabase = getSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, whatsapp_phone, phone")
    .eq("wants_match_notifications", true)
    .or("whatsapp_phone.not.is.null,phone.not.is.null");

  const phones = (profiles ?? [])
    .filter((p) => p.id !== params.excludePlayerId)
    .map((p) => bestPhone(p as ProfilePhoneRow))
    .filter((p) => p !== "" && p !== ownerPhone);

  await sendTemplateToMany(phones, TEMPLATES.newMatch, opts);
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
  const opts: TemplateOpts = {
    bodyParams: [
      params.newPlayerName,
      params.venueName,
      formatMatchDate(params.scheduledAt),
      `${params.currentPaidCount}/${params.maxPlayers}`,
    ],
    buttonUrlSuffix: params.matchId,
  };

  const phones = await getActivePlayerPhones(params.matchId, params.newPlayerId);
  const ownerPhone = getOwnerPhone();
  if (ownerPhone) phones.push(ownerPhone);

  await sendTemplateToMany(phones, TEMPLATES.playerJoined, opts);
}

/** Notifies the owner + all players when a match becomes full. Template: partido_lleno. */
export async function notifyMatchFull(params: {
  matchId: string;
  venueName: string;
  scheduledAt: string | null;
  maxPlayers: number;
}): Promise<void> {
  const opts: TemplateOpts = {
    bodyParams: [params.venueName, formatMatchDate(params.scheduledAt)],
    buttonUrlSuffix: params.matchId,
  };

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

  await sendTemplateToMany(phones, TEMPLATES.matchFull, opts);
}

/**
 * Avisa al equipo (TEAM_WHATSAPP_PHONES + owner) que un partido se llenó y hay que
 * reservar la cancha en EasyCancha. Template: reserva_cancha (body-only, sin botón).
 */
export async function notifyTeamCourtToBook(params: {
  venueName: string;
  whenStr: string;
  priceStr: string;
  courtsInfo: string;
}): Promise<void> {
  const team = (process.env.TEAM_WHATSAPP_PHONES ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const ownerPhone = getOwnerPhone();
  if (ownerPhone) team.push(ownerPhone);
  const phones = [...new Set(team)];
  if (!phones.length) return;

  await sendTemplateToMany(phones, TEMPLATES.courtToBook, {
    bodyParams: [params.venueName, params.whenStr, params.priceStr, params.courtsInfo],
  });
}
