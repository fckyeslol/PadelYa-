/**
 * Integration tests for createCombinedCheckout — the server flow that lets a
 * host/payer add guests and pay every slot in ONE Wompi transaction.
 * Spec: docs/specs/jugadores-invitados.md (INV-1..INV-4, combined intent).
 *
 * Supabase (admin + session) and all side-effects (Wompi env, email, WhatsApp,
 * EasyCancha handoff) are mocked; the business logic + the payment_intent /
 * child-payments wiring run for real against an in-memory store.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStore, createFakeSupabase, type FakeStore, type Row } from "../helpers/fake-supabase";

const h = vi.hoisted(() => ({
  client: null as ReturnType<typeof createFakeSupabase> | null,
  user: null as { id: string } | null,
}));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => h.client }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
  }),
}));
vi.mock("@/utils/env", () => ({
  getWompiPublicKey: () => "pub_test_key",
  getWompiIntegritySecret: () => "integrity_secret",
  getWompiEventsSecret: () => "events_secret",
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
vi.mock("@/services/matches/court-booking-handoff", () => ({ sendCourtBookingHandoff: vi.fn() }));

import { createCombinedCheckout } from "@/services/payments/service";

const HOST = "11111111-1111-1111-1111-111111111111";
const PLAYER = "22222222-2222-2222-2222-222222222222";
const MATCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FEE = 25_000;

let store: FakeStore;

function seedMatch(extra: Partial<Row> = {}) {
  store.matches.push({
    id: MATCH,
    status: "open",
    org_fee_cop: FEE,
    venue_name: "Pádel Park",
    scheduled_at: "2026-07-01T18:00:00Z",
    host_player_id: HOST,
    max_players: 4,
    ...extra,
  });
}

function activeSlots() {
  return store.match_players.filter((mp) => mp.status === "pending_payment" || mp.status === "paid");
}

beforeEach(() => {
  store = createStore();
  h.client = createFakeSupabase(store);
  h.user = { id: HOST };
});

describe("createCombinedCheckout — host pays own slot + guests in one intent", () => {
  it("creates ONE payment_intent for the full amount and N child slots/payments", async () => {
    seedMatch();

    const result = await createCombinedCheckout({
      matchId: MATCH,
      includeSelf: true,
      guests: [
        { name: "Beto", phone: "3001112233" },
        { name: "Cira", phone: "3004445566" },
      ],
    });

    // 3 slots × 25k = 75k → cents to Wompi.
    expect(result.amountInCents).toBe(75_000 * 100);
    expect(result.publicKey).toBe("pub_test_key");
    expect(result.redirectUrl).toBe(`http://localhost:3000/matches/${MATCH}`);

    // Exactly one intent, total amount, owned by the payer, pending, matching reference.
    expect(store.payment_intents).toHaveLength(1);
    const intent = store.payment_intents[0];
    expect(intent.amount_cop).toBe(75_000);
    expect(intent.paid_by_player_id).toBe(HOST);
    expect(intent.status).toBe("pending");
    expect(intent.wompi_reference).toBe(result.reference);

    // 3 slots: the host's own + 2 guests, all pending_payment.
    expect(activeSlots()).toHaveLength(3);
    const own = store.match_players.find((mp) => mp.player_id === HOST)!;
    expect(own.status).toBe("pending_payment");
    const guests = store.match_players.filter((mp) => mp.player_id === null);
    expect(guests).toHaveLength(2);
    expect(guests.map((g) => g.guest_name).sort()).toEqual(["Beto", "Cira"]);
    // Guests carry who invited/pays for them and an E.164 phone.
    expect(guests.every((g) => g.invited_by_player_id === HOST)).toBe(true);
    expect(guests.map((g) => g.guest_phone).sort()).toEqual(["+573001112233", "+573004445566"]);

    // 3 child payments, each one fee, all under the single intent.
    expect(store.payments).toHaveLength(3);
    expect(store.payments.every((p) => p.payment_intent_id === intent.id)).toBe(true);
    expect(store.payments.every((p) => p.amount_cop === FEE)).toBe(true);
    expect(store.payments.every((p) => p.status === "pending")).toBe(true);
  });

  it("organizer host can pay only guests (includeSelf=false) without taking a slot", async () => {
    seedMatch();
    h.user = { id: HOST }; // host, no own slot

    const result = await createCombinedCheckout({
      matchId: MATCH,
      includeSelf: false,
      guests: [
        { name: "Beto", phone: "3001112233" },
        { name: "Cira", phone: "3004445566" },
      ],
    });

    expect(result.amountInCents).toBe(50_000 * 100);
    expect(store.payment_intents[0].amount_cop).toBe(50_000);
    // Only the 2 guest slots; the host does not appear as a player.
    expect(activeSlots()).toHaveLength(2);
    expect(store.match_players.some((mp) => mp.player_id === HOST)).toBe(false);
    expect(store.payments).toHaveLength(2);
  });

  it("legacy individual checkout (own slot only) creates a 1-slot intent", async () => {
    seedMatch();
    const result = await createCombinedCheckout({ matchId: MATCH, includeSelf: true, guests: [] });
    expect(result.amountInCents).toBe(FEE * 100);
    expect(store.payment_intents[0].amount_cop).toBe(FEE);
    expect(store.payments).toHaveLength(1);
  });
});

describe("createCombinedCheckout — authorization & capacity (INV-1, INV-2, INV-4)", () => {
  it("INV-1: a non-host, non-paid player cannot invite without paying their own slot", async () => {
    seedMatch();
    h.user = { id: PLAYER }; // not the host, has no paid slot

    await expect(
      createCombinedCheckout({
        matchId: MATCH,
        includeSelf: false,
        guests: [{ name: "Beto", phone: "3001112233" }],
      }),
    ).rejects.toThrow(/Primero debes unirte y pagar tu cupo/);
    expect(store.payment_intents).toHaveLength(0);
    expect(store.match_players).toHaveLength(0);
  });

  it("INV-2: rejects when new slots exceed remaining capacity", async () => {
    seedMatch();
    // 3 slots already paid → only 1 left.
    store.match_players.push(
      { id: "s1", match_id: MATCH, player_id: PLAYER, status: "paid" },
      { id: "s2", match_id: MATCH, player_id: "p3", status: "paid" },
      { id: "s3", match_id: MATCH, player_id: "p4", status: "paid" },
    );
    h.user = { id: HOST };

    await expect(
      createCombinedCheckout({
        matchId: MATCH,
        includeSelf: true, // host's own (1 new) + 1 guest (1 new) = 2 > 1 available
        guests: [{ name: "Beto", phone: "3001112233" }],
      }),
    ).rejects.toThrow(/Solo queda 1 cupo disponible/);
  });

  it("INV-4: rejects a guest whose phone belongs to a registered player in the match", async () => {
    seedMatch();
    store.match_players.push({ id: "s1", match_id: MATCH, player_id: PLAYER, status: "paid" });
    store.profiles.push({ id: PLAYER, phone: "+573001112233", whatsapp_phone: null });
    h.user = { id: HOST };

    await expect(
      createCombinedCheckout({
        matchId: MATCH,
        includeSelf: true,
        guests: [{ name: "Beto", phone: "3001112233" }], // same number as PLAYER
      }),
    ).rejects.toThrow(/ya está registrado en PadelYa/);
  });

  it("rejects a closed match", async () => {
    seedMatch({ status: "full" });
    await expect(
      createCombinedCheckout({ matchId: MATCH, includeSelf: true, guests: [] }),
    ).rejects.toThrow(/ya no acepta jugadores/);
  });
});
