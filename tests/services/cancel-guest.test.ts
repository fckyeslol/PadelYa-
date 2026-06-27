/**
 * Integration tests for cancelGuestSpot — cancelling a guest slot.
 * Spec: docs/specs/jugadores-invitados.md
 *   INV-6: a refund for a guest slot goes to WHOEVER PAID (the funding payment),
 *          never to the guest (who has no payment of their own).
 *   Refund window: < 3h before start, or a full match, is "late" → no refund.
 *   Authorization: only the inviter or the match host may cancel a guest.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStore, createFakeSupabase, type FakeStore, type Row } from "../helpers/fake-supabase";

const h = vi.hoisted(() => ({ client: null as ReturnType<typeof createFakeSupabase> | null }));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => h.client }));
// cancelGuestSpot imports voidWompiTransaction from the payments service; stub it
// so the heavy payments module (and its deps) never loads during this test.
vi.mock("@/services/payments/service", () => ({ voidWompiTransaction: vi.fn() }));

import { cancelGuestSpot } from "@/services/matches/operations";

const INVITER = "11111111-1111-1111-1111-111111111111";
const HOST = "22222222-2222-2222-2222-222222222222";
const STRANGER = "33333333-3333-3333-3333-333333333333";
const MATCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const GUEST_SLOT = "gggggggg-gggg-gggg-gggg-gggggggggggg";
const FEE = 25_000;

let store: FakeStore;

function hoursFromNow(hrs: number): string {
  return new Date(Date.now() + hrs * 60 * 60 * 1000).toISOString();
}

function seed({
  matchStatus = "open",
  scheduledAt = hoursFromNow(48),
  slotStatus = "paid",
  withApprovedPayment = true,
}: {
  matchStatus?: string;
  scheduledAt?: string;
  slotStatus?: string;
  withApprovedPayment?: boolean;
} = {}) {
  store.matches.push({
    id: MATCH,
    status: matchStatus,
    scheduled_at: scheduledAt,
    host_player_id: HOST,
    max_players: 4,
  });
  store.match_players.push({
    id: GUEST_SLOT,
    match_id: MATCH,
    player_id: null, // guest slot
    guest_name: "Carlos",
    guest_phone: "+573001112233",
    invited_by_player_id: INVITER,
    status: slotStatus,
  });
  if (withApprovedPayment) {
    // The payment that funded the guest slot — paid by the INVITER's intent,
    // not by the guest. player_id is null because the slot has no profile.
    store.payments.push({
      id: "pay-guest",
      match_player_id: GUEST_SLOT,
      match_id: MATCH,
      player_id: null,
      amount_cop: FEE,
      status: "approved",
    });
  }
}

beforeEach(() => {
  store = createStore();
  h.client = createFakeSupabase(store);
});

describe("cancelGuestSpot — INV-6 refund to the payer", () => {
  it("inviter cancels in time → slot cancelled and a refund is queued on the funding payment", async () => {
    seed();
    const { isLate } = await cancelGuestSpot(MATCH, GUEST_SLOT, INVITER);

    expect(isLate).toBe(false);
    expect(store.match_players[0].status).toBe("cancelled");

    // Refund is tied to the payment that funded the slot (the payer's money),
    // never to the guest — the guest never has a payment row of their own.
    expect(store.refunds).toHaveLength(1);
    const refund = store.refunds[0];
    expect(refund.payment_id).toBe("pay-guest");
    expect(refund.amount_cop).toBe(FEE);
    expect(refund.status).toBe("pending_manual");
    expect(refund.reason).toBe("guest_cancelled_by_inviter");
  });

  it("the host (not just the inviter) may cancel a guest", async () => {
    seed();
    const { isLate } = await cancelGuestSpot(MATCH, GUEST_SLOT, HOST);
    expect(isLate).toBe(false);
    expect(store.match_players[0].status).toBe("cancelled");
    expect(store.refunds).toHaveLength(1);
  });

  it("late cancel (< 3h before start) → cancelled_late and NO refund", async () => {
    seed({ scheduledAt: hoursFromNow(1) });
    const { isLate } = await cancelGuestSpot(MATCH, GUEST_SLOT, INVITER);

    expect(isLate).toBe(true);
    expect(store.match_players[0].status).toBe("cancelled_late");
    expect(store.refunds).toHaveLength(0);
  });

  it("cancelling on a full match re-opens it and is treated as late (no refund)", async () => {
    seed({ matchStatus: "full", scheduledAt: hoursFromNow(48) });
    // 4 paid slots including the guest.
    store.match_players.push(
      { id: "p1", match_id: MATCH, player_id: "u1", status: "paid" },
      { id: "p2", match_id: MATCH, player_id: "u2", status: "paid" },
      { id: "p3", match_id: MATCH, player_id: "u3", status: "paid" },
    );

    const { isLate } = await cancelGuestSpot(MATCH, GUEST_SLOT, INVITER);

    expect(isLate).toBe(true); // a full match counts as late
    expect(store.match_players[0].status).toBe("cancelled_late");
    expect(store.refunds).toHaveLength(0);
    // Slot freed → match returns to open.
    expect(store.matches[0].status).toBe("open");
    expect(store.matches[0].filled_at).toBeNull();
  });
});

describe("cancelGuestSpot — authorization & guards", () => {
  it("a stranger (not inviter nor host) cannot cancel", async () => {
    seed();
    await expect(cancelGuestSpot(MATCH, GUEST_SLOT, STRANGER)).rejects.toThrow(
      /Solo quien invitó o el organizador/,
    );
    expect(store.match_players[0].status).toBe("paid"); // unchanged
    expect(store.refunds).toHaveLength(0);
  });

  it("refuses to cancel a registered player's slot via the guest path", async () => {
    store.matches.push({ id: MATCH, status: "open", scheduled_at: hoursFromNow(48), host_player_id: HOST, max_players: 4 });
    store.match_players.push({
      id: GUEST_SLOT,
      match_id: MATCH,
      player_id: STRANGER, // a real player, not a guest
      status: "paid",
      invited_by_player_id: null,
    });
    await expect(cancelGuestSpot(MATCH, GUEST_SLOT, HOST)).rejects.toThrow(/no es de un invitado/);
  });

  it("refuses to cancel a slot that is no longer active", async () => {
    seed({ slotStatus: "cancelled" });
    await expect(cancelGuestSpot(MATCH, GUEST_SLOT, INVITER)).rejects.toThrow(/ya no está activo/);
  });

  it("rejects when the slot does not belong to the given match", async () => {
    seed();
    await expect(cancelGuestSpot("ffffffff-ffff-ffff-ffff-ffffffffffff", GUEST_SLOT, INVITER)).rejects.toThrow(
      /no pertenece a este partido/,
    );
  });
});
