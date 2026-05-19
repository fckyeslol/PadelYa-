import crypto from "node:crypto";
import { APP_CONFIG } from "@/config/business";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendPaymentStatusEmail, sendMatchFilledEmail } from "@/services/notifications/email";
import {
  notifyOwnerNewGame,
  notifyHostMatchCreated,
  notifyOnPlayerJoined,
  notifyMatchFull,
} from "@/services/notifications/whatsapp";
import { getAppUrl } from "@/utils/auth-url";
import { getMercadoPagoAccessToken, getMercadoPagoWebhookSecret } from "@/utils/env";
import { getErrorMessage } from "@/utils/errors";

const MP_API = "https://api.mercadopago.com";

// ── Types ──────────────────────────────────────────────────────────────────

export type CheckoutResult = {
  preferenceId: string;
  externalReference: string;
};

export type ProcessPaymentResult = {
  status: "approved" | "pending" | "rejected";
  redirectUrl?: string;
  mpPaymentId: string;
};

export type MPBrickFormData = Record<string, unknown>;

function parseMercadoPagoApiError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      message?: string;
      cause?: Array<{ description?: string; code?: string }>;
    };
    const detail = parsed.cause?.[0]?.description ?? parsed.message;
    if (detail) {
      if (/banktransfers?\s*api\s*fail/i.test(detail)) {
        return (
          "PSE no pudo conectarse con el banco. Verifica banco, documento y teléfono en tu perfil, " +
          "o paga con tarjeta. Si el problema continúa, PSE puede no estar habilitado en la cuenta de Mercado Pago."
        );
      }
      return `Mercado Pago: ${detail}`;
    }
  } catch {
    // keep raw text
  }
  return `Mercado Pago: ${raw.slice(0, 280)}`;
}

type PayerProfile = {
  fullName?: string | null;
  phone?: string | null;
};

function extractFinancialInstitution(raw: MPBrickFormData): string | null {
  const td = asRecord(raw.transaction_details);
  if (td?.financial_institution != null && String(td.financial_institution).trim()) {
    return String(td.financial_institution).trim();
  }
  if (raw.financial_institution != null && String(raw.financial_institution).trim()) {
    return String(raw.financial_institution).trim();
  }
  return null;
}

function normalizePaymentMethodId(raw: MPBrickFormData): {
  paymentMethodId: string;
  financialInstitution: string | null;
  isCard: boolean;
  isPse: boolean;
} {
  const isCard = Boolean(raw.token);
  let paymentMethodId = String(raw.payment_method_id ?? "").trim();
  let financialInstitution = extractFinancialInstitution(raw);

  // Brick may send the bank code as payment_method_id (e.g. "1040", "1507").
  if (/^\d{3,6}$/.test(paymentMethodId)) {
    financialInstitution = financialInstitution ?? paymentMethodId;
    paymentMethodId = "pse";
  }

  if (!isCard && financialInstitution && paymentMethodId !== "pse") {
    paymentMethodId = "pse";
  }

  return {
    paymentMethodId,
    financialInstitution,
    isCard,
    isPse: paymentMethodId === "pse",
  };
}

function normalizeIdentificationType(type: string): string {
  const normalized = type.trim().toUpperCase();
  if (normalized === "OTRO" || normalized === "OTHER") return "CC";
  return type.trim();
}

function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const cleaned = fullName.trim();
  if (!cleaned) return { first_name: "Jugador", last_name: "PadelYa" };
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0].slice(0, 32), last_name: parts[0].slice(0, 32) };
  }
  return {
    first_name: parts[0].slice(0, 32),
    last_name: parts.slice(1).join(" ").slice(0, 32),
  };
}

function parseColombianPhone(phone: string): { area_code: string; number: string } | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 10) {
    return { area_code: digits.slice(0, 3), number: digits.slice(3) };
  }
  return null;
}

function defaultPseAddress(): Record<string, string> {
  return {
    zip_code: "08001",
    street_name: "Calle 72",
    street_number: "1",
    neighborhood: "Centro",
    city: APP_CONFIG.city.slice(0, 18),
    federal_unit: "ATL",
  };
}

function enrichPsePayer(
  payer: Record<string, unknown>,
  payerRaw: Record<string, unknown> | null,
  options?: { payerProfile?: PayerProfile | null },
): void {
  const profileNames = options?.payerProfile?.fullName
    ? splitFullName(options.payerProfile.fullName)
    : null;

  if (!payer.first_name) {
    payer.first_name = payerRaw?.first_name
      ? String(payerRaw.first_name).slice(0, 32)
      : profileNames?.first_name ?? "Jugador";
  }
  if (!payer.last_name) {
    payer.last_name = payerRaw?.last_name
      ? String(payerRaw.last_name).slice(0, 32)
      : profileNames?.last_name ?? "PadelYa";
  }

  const addressRaw = payerRaw ? asRecord(payerRaw.address) : null;
  const defaults = defaultPseAddress();
  const address: Record<string, string> = {};
  for (const key of [
    "zip_code",
    "street_name",
    "street_number",
    "neighborhood",
    "city",
    "federal_unit",
  ] as const) {
    const fromBrick = addressRaw?.[key];
    address[key] = fromBrick ? String(fromBrick) : defaults[key];
  }
  if (address.zip_code.replace(/\D/g, "").length !== 5) {
    address.zip_code = defaults.zip_code;
  }
  payer.address = address;

  const phoneRaw = payerRaw ? asRecord(payerRaw.phone) : null;
  if (phoneRaw?.area_code && phoneRaw?.number) {
    payer.phone = {
      area_code: String(phoneRaw.area_code).replace(/\D/g, "").slice(0, 3),
      number: String(phoneRaw.number).replace(/\D/g, "").slice(0, 10),
    };
    return;
  }

  const phoneSource =
    (options?.payerProfile?.phone?.trim() ? options.payerProfile.phone : null) ??
    (typeof payerRaw?.phone === "string" ? payerRaw.phone : null);
  const parsed = phoneSource ? parseColombianPhone(phoneSource) : null;
  if (parsed) {
    payer.phone = parsed;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Normalizes Payment Brick onSubmit payload (shape varies by SDK version). */
export function normalizeBrickFormData(submitPayload: unknown): MPBrickFormData {
  const payload = asRecord(submitPayload);
  if (!payload) return {};

  const nested = asRecord(payload.formData);
  if (nested) return nested;

  if (payload.payment_method_id || payload.token) return payload;

  if (extractFinancialInstitution(payload)) return payload;

  return payload;
}

/** Builds a clean /v1/payments body from Payment Brick formData (avoids invalid extra fields). */
function buildMercadoPagoPaymentBody(
  raw: MPBrickFormData,
  payment: { amount_cop: number; match_id: string },
  externalReference: string,
  appUrl: string,
  options?: {
    clientIp?: string | null;
    payerEmail?: string | null;
    payerProfile?: PayerProfile | null;
  },
): Record<string, unknown> {
  const { paymentMethodId, financialInstitution, isCard, isPse } =
    normalizePaymentMethodId(raw);

  if (!paymentMethodId) {
    throw new Error("Selecciona un método de pago válido.");
  }

  const payerRaw = asRecord(raw.payer);
  const identificationRaw = payerRaw ? asRecord(payerRaw.identification) : null;
  const additionalInfoRaw = asRecord(raw.additional_info);

  const body: Record<string, unknown> = {
    transaction_amount: payment.amount_cop,
    payment_method_id: paymentMethodId,
    description: "PadelYa — cupo partido pádel",
    external_reference: externalReference,
    notification_url: `${appUrl}/api/webhooks/mercadopago`,
    callback_url: `${appUrl}/matches/${payment.match_id}`,
  };

  if (isCard) {
    body.token = String(raw.token);
    body.installments = Number(raw.installments ?? 1) || 1;
    if (raw.issuer_id != null && raw.issuer_id !== "") {
      body.issuer_id =
        typeof raw.issuer_id === "number" ? raw.issuer_id : String(raw.issuer_id);
    }
  }

  const payer: Record<string, unknown> = {};
  const payerEmail =
    (payerRaw?.email ? String(payerRaw.email) : null) ??
    options?.payerEmail ??
    null;
  if (payerEmail) payer.email = payerEmail;

  if (isPse) {
    payer.entity_type = payerRaw?.entity_type ? String(payerRaw.entity_type) : "individual";
  } else if (payerRaw?.entity_type) {
    payer.entity_type = String(payerRaw.entity_type);
  }

  if (identificationRaw?.type && identificationRaw?.number != null) {
    payer.identification = {
      type: normalizeIdentificationType(String(identificationRaw.type)),
      number: String(identificationRaw.number).replace(/\s/g, ""),
    };
  }

  if (!isPse) {
    if (payerRaw?.first_name) payer.first_name = String(payerRaw.first_name);
    if (payerRaw?.last_name) payer.last_name = String(payerRaw.last_name);
    if (payerRaw?.address) payer.address = payerRaw.address;
    if (payerRaw?.phone) payer.phone = payerRaw.phone;
  }

  if (isPse) {
    enrichPsePayer(payer, payerRaw, { payerProfile: options?.payerProfile });

    if (!financialInstitution) {
      throw new Error("Selecciona el banco para continuar con PSE.");
    }
    body.transaction_details = { financial_institution: financialInstitution };
  }

  if (Object.keys(payer).length > 0) {
    body.payer = payer;
  }

  if (isCard && !payer.email) {
    throw new Error("Ingresa un correo electrónico para continuar con el pago.");
  }

  if (isPse && !payer.email) {
    throw new Error("Ingresa un correo electrónico para PSE.");
  }

  if (isPse && !payer.identification) {
    throw new Error("Ingresa tu tipo y número de documento para PSE.");
  }

  if (isPse && !payer.phone) {
    throw new Error(
      "Agrega un teléfono móvil válido en tu perfil (10 dígitos) para pagar con PSE.",
    );
  }

  const clientIp = options?.clientIp?.trim() || null;
  if (additionalInfoRaw?.ip_address) {
    body.additional_info = { ip_address: String(additionalInfoRaw.ip_address) };
  } else if (isPse) {
    body.additional_info = { ip_address: clientIp ?? "127.0.0.1" };
  }

  return body;
}

// ── Checkout: create DB records + MP preference ────────────────────────────

export async function createCheckoutForMatch(
  matchId: string,
  options?: { isHost?: boolean },
): Promise<CheckoutResult> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User is not authenticated");

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("status, org_fee_cop, venue_name, scheduled_at")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) throw new Error(getErrorMessage(matchError, "No se pudo cargar el partido"));
  if (!match) throw new Error("Partido no encontrado");
  if (match.status !== "open") throw new Error("Este partido ya no acepta jugadores.");

  const totalAmountCop =
    (match.org_fee_cop ?? APP_CONFIG.defaultFeeCop) + APP_CONFIG.platformFeeCop;

  const { count: paidCount, error: paidCountError } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId)
    .eq("status", "paid");
  if (paidCountError) throw new Error(getErrorMessage(paidCountError, "No se pudo verificar cupos"));
  if ((paidCount ?? 0) >= APP_CONFIG.maxPlayersPerMatch) {
    throw new Error("Este partido ya está completo.");
  }

  const { data: existingPlayer } = await supabase
    .from("match_players")
    .select("id, status")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();

  if (existingPlayer?.status === "paid") {
    throw new Error("Ya tienes un cupo confirmado en este partido.");
  }

  let matchPlayerId: string;

  if (existingPlayer?.status === "pending_payment") {
    matchPlayerId = existingPlayer.id;

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, mp_preference_id, wompi_reference")
      .eq("match_player_id", matchPlayerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPayment?.mp_preference_id && existingPayment.wompi_reference) {
      return {
        preferenceId: existingPayment.mp_preference_id,
        externalReference: existingPayment.wompi_reference,
      };
    }
  } else {
    const { data: matchPlayer, error: matchPlayerError } = await supabase
      .from("match_players")
      .insert({
        match_id: matchId,
        player_id: user.id,
        status: "pending_payment",
        is_host: options?.isHost ?? false,
      })
      .select("id")
      .single();
    if (matchPlayerError) {
      throw new Error(getErrorMessage(matchPlayerError, "No se pudo reservar tu cupo"));
    }
    matchPlayerId = matchPlayer.id;
  }

  const idempotencyKey = crypto.randomUUID();
  const externalReference = crypto.randomUUID();

  const { data: stalePendingPayment } = await supabase
    .from("payments")
    .select("id")
    .eq("match_player_id", matchPlayerId)
    .eq("status", "pending")
    .is("mp_preference_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Create MP preference
  const accessToken = getMercadoPagoAccessToken();
  const appUrl = getAppUrl();
  const matchUrl = `${appUrl}/matches/${matchId}`;

  const prefBody = {
    items: [
      {
        id: matchId,
        title: `Cupo partido pádel — ${match.venue_name}`,
        unit_price: totalAmountCop,
        quantity: 1,
        currency_id: "COP",
      },
    ],
    payer: { email: user.email ?? "jugador@padelya.co" },
    external_reference: externalReference,
    back_urls: {
      success: matchUrl,
      failure: matchUrl,
      pending: matchUrl,
    },
    auto_return: "approved",
    notification_url: `${appUrl}/api/webhooks/mercadopago`,
    statement_descriptor: "PADELYA",
  };

  const prefResponse = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(prefBody),
  });

  if (!prefResponse.ok) {
    const err = await prefResponse.text();
    let detail = err;
    try {
      const parsed = JSON.parse(err) as { message?: string; cause?: Array<{ description?: string }> };
      detail = parsed.message ?? parsed.cause?.[0]?.description ?? err;
    } catch {
      // keep raw text
    }
    throw new Error(`Mercado Pago: ${detail}`);
  }

  const prefData = (await prefResponse.json()) as { id: string };

  const paymentPayload = {
    match_player_id: matchPlayerId,
    match_id: matchId,
    player_id: user.id,
    amount_cop: totalAmountCop,
    status: "pending" as const,
    provider: "mercadopago",
    wompi_reference: externalReference,
    mp_preference_id: prefData.id,
    idempotency_key: idempotencyKey,
  };

  const { error: paymentError } = stalePendingPayment
    ? await supabase.from("payments").update(paymentPayload).eq("id", stalePendingPayment.id)
    : await supabase.from("payments").insert(paymentPayload);

  if (paymentError) {
    throw new Error(getErrorMessage(paymentError, "No se pudo registrar el pago"));
  }

  await supabase.from("analytics_events").insert({
    event_name: "checkout_started",
    user_id: user.id,
    match_id: matchId,
    properties: { provider: "mercadopago" },
  });

  return { preferenceId: prefData.id, externalReference };
}

// ── Process: Brick submits → create MP payment ─────────────────────────────

export async function processMercadoPagoPayment(
  formData: MPBrickFormData,
  externalReference: string,
  options?: { clientIp?: string | null },
): Promise<ProcessPaymentResult> {
  const supabase = getSupabaseAdminClient();

  const normalizedFormData = normalizeBrickFormData(formData);

  const { data: payment } = await supabase
    .from("payments")
    .select("id, match_id, player_id, match_player_id, status, amount_cop, idempotency_key")
    .eq("wompi_reference", externalReference)
    .maybeSingle();

  if (!payment) throw new Error("Pago no encontrado");
  if (payment.status === "approved") {
    return { status: "approved", mpPaymentId: "" };
  }

  const [{ data: authUser }, { data: profile }] = await Promise.all([
    supabase.auth.admin.getUserById(payment.player_id),
    supabase
      .from("profiles")
      .select("full_name, phone, whatsapp_phone")
      .eq("id", payment.player_id)
      .maybeSingle(),
  ]);
  const payerEmail = authUser?.user?.email ?? null;
  const payerProfile: PayerProfile = {
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? profile?.whatsapp_phone ?? null,
  };

  const accessToken = getMercadoPagoAccessToken();
  const appUrl = getAppUrl();

  const payBody = buildMercadoPagoPaymentBody(
    normalizedFormData,
    payment,
    externalReference,
    appUrl,
    { clientIp: options?.clientIp, payerEmail, payerProfile },
  );

  const mpResponse = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": payment.idempotency_key,
    },
    body: JSON.stringify(payBody),
  });

  if (!mpResponse.ok) {
    const err = await mpResponse.text();
    console.error("[payments/process] MP rejected payment", {
      paymentMethodId: payBody.payment_method_id,
      hasToken: Boolean(payBody.token),
      status: mpResponse.status,
      err: err.slice(0, 500),
    });
    throw new Error(parseMercadoPagoApiError(err));
  }

  const mpPayment = (await mpResponse.json()) as {
    id: number;
    status: string;
    status_detail: string;
    payment_method_id: string;
    transaction_details?: { external_resource_url?: string };
  };

  const mappedStatus =
    mpPayment.status === "approved"
      ? "approved"
      : mpPayment.status === "rejected"
        ? "declined"
        : "pending";

  await supabase
    .from("payments")
    .update({
      mp_payment_id: String(mpPayment.id),
      status: mappedStatus,
      payment_method: mpPayment.payment_method_id,
      approved_at: mappedStatus === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", payment.id);

  if (mappedStatus === "approved") {
    await _handleApprovedPayment({
      paymentId: payment.id,
      matchId: payment.match_id,
      playerId: payment.player_id,
      matchPlayerId: payment.match_player_id,
      paymentMethod: mpPayment.payment_method_id,
      amountCop: payment.amount_cop,
    });
  } else if (mappedStatus === "declined") {
    await supabase
      .from("match_players")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", payment.match_player_id);
  }

  return {
    status:
      mappedStatus === "approved"
        ? "approved"
        : mappedStatus === "pending"
          ? "pending"
          : "rejected",
    redirectUrl: mpPayment.transaction_details?.external_resource_url,
    mpPaymentId: String(mpPayment.id),
  };
}

// ── Webhook: async confirmation from MP ────────────────────────────────────

export async function processMercadoPagoWebhook(
  body: Record<string, unknown>,
  signature: string | null,
  requestId: string | null,
) {
  if (body.type !== "payment") return;

  const paymentId = (body.data as Record<string, unknown>)?.id;
  if (!paymentId) return;

  // Validate MP webhook signature (v2)
  const webhookSecret = getMercadoPagoWebhookSecret();
  if (signature) {
    const parts = Object.fromEntries(
      signature.split(";").map((p) => p.split("=")),
    ) as Record<string, string>;
    const { ts, v1 } = parts;
    if (ts && v1) {
      const manifest = `id:${paymentId};request-id:${requestId ?? ""};ts:${ts};`;
      const expected = crypto.createHmac("sha256", webhookSecret).update(manifest).digest("hex");
      if (expected !== v1) throw new Error("Invalid webhook signature");
    }
  }

  const accessToken = getMercadoPagoAccessToken();
  const mpRes = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!mpRes.ok) return;

  const mpPayment = (await mpRes.json()) as {
    id: number;
    status: string;
    external_reference: string;
    payment_method_id: string;
  };

  const supabase = getSupabaseAdminClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, match_id, player_id, match_player_id, status, amount_cop")
    .eq("wompi_reference", mpPayment.external_reference)
    .maybeSingle();

  if (!payment || payment.status === "approved") return;

  const mappedStatus =
    mpPayment.status === "approved"
      ? "approved"
      : mpPayment.status === "rejected"
        ? "declined"
        : "voided";

  await supabase
    .from("payments")
    .update({
      mp_payment_id: String(mpPayment.id),
      status: mappedStatus,
      payment_method: mpPayment.payment_method_id,
      approved_at: mappedStatus === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", payment.id);

  if (mappedStatus === "approved") {
    await _handleApprovedPayment({
      paymentId: payment.id,
      matchId: payment.match_id,
      playerId: payment.player_id,
      matchPlayerId: payment.match_player_id,
      paymentMethod: mpPayment.payment_method_id,
      amountCop: payment.amount_cop,
    });
  } else {
    await supabase
      .from("match_players")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", payment.match_player_id);
    await _sendPaymentEmail(payment.player_id, payment.match_id, payment.amount_cop, mappedStatus as "declined" | "voided");
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────

async function _handleApprovedPayment({
  matchId,
  playerId,
  matchPlayerId,
  paymentMethod,
  amountCop,
}: {
  paymentId: string;
  matchId: string;
  playerId: string;
  matchPlayerId: string;
  paymentMethod: string;
  amountCop: number;
}) {
  const supabase = getSupabaseAdminClient();

  await supabase
    .from("match_players")
    .update({ status: "paid" })
    .eq("id", matchPlayerId);

  await supabase.rpc("try_fill_match", { p_match_id: matchId });

  await supabase.from("analytics_events").insert({
    event_name: "payment_approved",
    user_id: playerId,
    match_id: matchId,
    properties: { payment_method: paymentMethod, provider: "mercadopago" },
  });

  const { data: matchStatus } = await supabase
    .from("matches")
    .select("status, host_player_id, venue_name, scheduled_at, max_players")
    .eq("id", matchId)
    .maybeSingle();

  const venueName = matchStatus?.venue_name ?? "Tu partido de pádel";
  const scheduledAt = matchStatus?.scheduled_at ?? null;
  const maxPlayers = matchStatus?.max_players ?? APP_CONFIG.maxPlayersPerMatch;

  const { data: joiningProfile } = await supabase
    .from("profiles")
    .select("full_name, phone, whatsapp_phone")
    .eq("id", playerId)
    .maybeSingle();

  const joiningPlayerName = joiningProfile?.full_name ?? "Un jugador";
  const joiningPlayerPhone =
    joiningProfile?.whatsapp_phone?.trim() || joiningProfile?.phone?.trim() || null;

  const { count: paidCount } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId)
    .eq("status", "paid");
  const currentPaidCount = paidCount ?? 1;

  const { data: matchPlayer } = await supabase
    .from("match_players")
    .select("is_host")
    .eq("id", matchPlayerId)
    .maybeSingle();
  const isHost = matchPlayer?.is_host ?? false;

  if (isHost && currentPaidCount === 1) {
    await notifyOwnerNewGame({ matchId, hostName: joiningPlayerName, venueName, scheduledAt });
    if (joiningPlayerPhone) {
      await notifyHostMatchCreated({
        hostPhone: joiningPlayerPhone,
        hostName: joiningPlayerName,
        matchId,
        venueName,
        scheduledAt,
        maxPlayers,
      });
    }
  } else {
    await notifyOnPlayerJoined({
      matchId,
      newPlayerName: joiningPlayerName,
      newPlayerId: playerId,
      venueName,
      scheduledAt,
      currentPaidCount,
      maxPlayers,
    });
  }

  if (matchStatus?.status === "full") {
    await supabase.from("analytics_events").insert({
      event_name: "organizer_notification_needed",
      match_id: matchId,
    });
    await notifyMatchFull({ matchId, venueName, scheduledAt, maxPlayers });

    if (matchStatus.host_player_id) {
      const { data: hostAuth } = await supabase.auth.admin.getUserById(matchStatus.host_player_id);
      if (hostAuth?.user?.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        await sendMatchFilledEmail({
          to: hostAuth.user.email,
          hostName:
            (hostAuth.user.user_metadata?.full_name as string | undefined) ??
            (hostAuth.user.user_metadata?.first_name as string | undefined) ??
            "Organizador",
          matchVenueName: venueName,
          matchScheduledAt: scheduledAt,
          matchId,
          appUrl,
        });
      }
    }
  }

  await _sendPaymentEmail(playerId, matchId, amountCop, "approved");
}

async function _sendPaymentEmail(
  playerId: string,
  matchId: string,
  amountCop: number,
  status: "approved" | "declined" | "voided",
) {
  const supabase = getSupabaseAdminClient();
  const [{ data: authUser }, { data: matchInfo }] = await Promise.all([
    supabase.auth.admin.getUserById(playerId),
    supabase.from("matches").select("venue_name, scheduled_at").eq("id", matchId).maybeSingle(),
  ]);

  if (authUser?.user?.email) {
    await sendPaymentStatusEmail({
      to: authUser.user.email,
      playerName:
        (authUser.user.user_metadata?.full_name as string | undefined) ??
        (authUser.user.user_metadata?.first_name as string | undefined) ??
        "Jugador",
      matchVenueName: matchInfo?.venue_name ?? "Tu partido de pádel",
      matchScheduledAt: matchInfo?.scheduled_at ?? null,
      amountCop,
      status,
    });
  }
}
