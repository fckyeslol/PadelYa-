/**
 * Integration tests for processWompiWebhook — the async confirmation that
 * settles a combined payment_intent: it must approve ALL funded slots atomically
 * (INV-5), fill the match, notify guests (D4), and on decline free the slots.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { createStore, createFakeSupabase, type FakeStore, type Row } from "../helpers/fake-supabase";

const h = vi.hoisted(() => ({ client: null as ReturnType<typeof createFakeSupabase> | null }));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => h.client }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("@/utils/env", () => ({
  getWompiPublicKey: () => "pub_test_key",
  getWompiIntegritySecret: () => "integrity_secret",
  getWompiEventsSecret: () => EVENTS_SECRET,
  getWompiPrivateKey: () => "prv_test_key",
}));
vi.mock("@/utils/auth-url", () => ({ getAppUrl: () => "http://localhost:3000" }));
vi.mock("@/services/notifications/email", () => ({
  sendPaymentStatusEmail: vi.fn(),
  sendMatchFilledEmail: vi.fn(),
}));
vi.mock("@/services/notifications/whatsapp", () => ({
  notifyOnPlayerJoined: vi.fn(),
  notifyMatchFull: vi.fn(),
  notifyGuestAdded: vi.fn(),
}));
vi.mock("@/services/easycancha/booking-alert", () => ({ sendCourtBookingHandoff: vi.fn() }));

import { processWompiWebhook } from "@/services/payments/service";
import * as whatsapp from "@/services/notifications/whatsapp";
import { sendCourtBookingHandoff } from "@/services/easycancha/booking-alert";

const EVENTS_SECRET = "events_secret";
const PAYER = "11111111-1111-1111-1111-111111111111";
const MATCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const REF = "ref-combined-001";
const FEE = 25_000;

let store: FakeStore;

/** Build a Wompi webhook event with a valid signature for our events secret. */
function signedEvent(status: "APPROVED" | "DECLINED" | "PENDING", amountCop: number): Row {
  const tx = {
    id: "tx-123",
    reference: REF,
    amount_in_cents: amountCop * 100,
    currency: "COP",
    status,
    payment_method_type: "CARD",
    created_at: "2026-07-01T18:05:00Z",
  };
  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const values = properties.map((p) => String((tx as Row)[p.replace("transaction.", "")] ?? ""));
  const checksum = createHash("sha256")
    .update([...values, "1700000000", EVENTS_SECRET].join(""))
    .digest("hex");
  return {
    event: "transaction.updated",
    data: { transaction: tx },
    timestamp: 1700000000,
    signature: { properties, checksum },
  };
}

/** Seed a pending combined intent funding the given slots. */
function seedPendingIntent(
  slots: Array<{ id: string; guest?: { name: string; phone: string }; playerId?: string; isHost?: boolean }>,
  matchExtra: Partial<Row> = {},
) {
  store.matches.push({
    id: MATCH,
    status: "open",
    org_fee_cop: FEE,
    venue_name: "Pádel Park",
    scheduled_at: "2026-07-10T18:00:00Z",
    host_player_id: PAYER,
    max_players: 4,
    ...matchExtra,
  });
  store.profiles.push({ id: PAYER, full_name: "Mateo", phone: "+573000000000" });
  store.authUsers[PAYER] = { email: "mateo@example.com", user_metadata: { full_name: "Mateo" } };

  const intentId = "intent-1";
  store.payment_intents.push({
    id: intentId,
    match_id: MATCH,
    paid_by_player_id: PAYER,
    amount_cop: FEE * slots.length,
    status: "pending",
    wompi_reference: REF,
    idempotency_key: "idem-1",
    provider: "wompi",
  });
  for (const s of slots) {
    store.match_players.push({
      id: s.id,
      match_id: MATCH,
      player_id: s.playerId ?? null,
      is_host: s.isHost ?? false,
      guest_name: s.guest?.name ?? null,
      guest_phone: s.guest?.phone ?? null,
      invited_by_player_id: s.guest ? PAYER : null,
      status: "pending_payment",
    });
    store.payments.push({
      id: `pay-${s.id}`,
      payment_intent_id: intentId,
      match_player_id: s.id,
      match_id: MATCH,
      player_id: s.playerId ?? null,
      amount_cop: FEE,
      status: "pending",
      provider: "wompi",
    });
  }
}

beforeEach(() => {
  store = createStore();
  h.client = createFakeSupabase(store);
  vi.clearAllMocks();
});

describe("processWompiWebhook — combined intent approval (INV-5 atomicity, D4 notify)", () => {
  it("APPROVED marks the intent, ALL child payments and ALL slots paid in one shot", async () => {
    seedPendingIntent([
      { id: "own", playerId: PAYER, isHost: true },
      { id: "g1", guest: { name: "Beto", phone: "+573001112233" } },
      { id: "g2", guest: { name: "Cira", phone: "+573004445566" } },
    ]);

    await processWompiWebhook(signedEvent("APPROVED", FEE * 3));

    expect(store.payment_intents[0].status).toBe("approved");
    expect(store.payment_intents[0].wompi_transaction_id).toBe("tx-123");
    expect(store.payments.every((p) => p.status === "approved")).toBe(true);
    expect(store.match_players.every((mp) => mp.status === "paid")).toBe(true);

    // D4: each guest is notified by WhatsApp; the registered slot is not.
    expect(whatsapp.notifyGuestAdded).toHaveBeenCalledTimes(2);
  });

  it("fills the match when the last slots are paid → status full + court handoff", async () => {
    // One player already paid; intent funds the remaining 3 → 4 total.
    seedPendingIntent([
      { id: "g1", guest: { name: "Beto", phone: "+573001112233" } },
      { id: "g2", guest: { name: "Cira", phone: "+573004445566" } },
      { id: "g3", guest: { name: "Dani", phone: "+573007778899" } },
    ]);
    store.match_players.push({ id: "pre", match_id: MATCH, player_id: "99", status: "paid" });

    await processWompiWebhook(signedEvent("APPROVED", FEE * 3));

    expect(store.matches[0].status).toBe("full");
    expect(whatsapp.notifyMatchFull).toHaveBeenCalledTimes(1);
    expect(sendCourtBookingHandoff).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: a second APPROVED webhook does not re-notify or change state", async () => {
    seedPendingIntent([
      { id: "g1", guest: { name: "Beto", phone: "+573001112233" } },
      { id: "g2", guest: { name: "Cira", phone: "+573004445566" } },
    ]);

    await processWompiWebhook(signedEvent("APPROVED", FEE * 2));
    await processWompiWebhook(signedEvent("APPROVED", FEE * 2));

    expect(store.payment_intents[0].status).toBe("approved");
    expect(store.match_players.every((mp) => mp.status === "paid")).toBe(true);
    // Notifications fired only on the first (real) approval.
    expect(whatsapp.notifyGuestAdded).toHaveBeenCalledTimes(2);
  });

  it("DECLINED leaves no slot paid and frees the pending slots", async () => {
    seedPendingIntent([
      { id: "g1", guest: { name: "Beto", phone: "+573001112233" } },
      { id: "g2", guest: { name: "Cira", phone: "+573004445566" } },
    ]);

    await processWompiWebhook(signedEvent("DECLINED", FEE * 2));

    expect(store.payment_intents[0].status).toBe("declined");
    expect(store.payments.every((p) => p.status === "declined")).toBe(true);
    expect(store.match_players.every((mp) => mp.status === "cancelled")).toBe(true);
    expect(whatsapp.notifyGuestAdded).not.toHaveBeenCalled();
  });

  it("rejects an event with an invalid signature", async () => {
    seedPendingIntent([{ id: "g1", guest: { name: "Beto", phone: "+573001112233" } }]);
    const bad = signedEvent("APPROVED", FEE);
    (bad.signature as Row).checksum = "deadbeef";

    await expect(processWompiWebhook(bad)).rejects.toThrow(/Invalid Wompi webhook signature/);
    expect(store.payment_intents[0].status).toBe("pending");
  });
});
