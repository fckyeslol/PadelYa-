/**
 * Tests for getMatchContactsForOrganizer — the organizer-only roster with phone
 * numbers (registered players + guests) so the organizer can call/WhatsApp them.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStore, createFakeSupabase, type FakeStore } from "../helpers/fake-supabase";

const h = vi.hoisted(() => ({ store: null as FakeStore | null }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => createFakeSupabase(h.store!) }));

import { getMatchContactsForOrganizer } from "@/services/matches/organizer-contacts";

const MATCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const HOST = "11111111-1111-1111-1111-111111111111";
const PLAYER = "22222222-2222-2222-2222-222222222222";

let store: FakeStore;

beforeEach(() => {
  store = createStore();
  h.store = store;
});

describe("getMatchContactsForOrganizer", () => {
  it("returns registered players (whatsapp preferred) and guests with phones", async () => {
    store.profiles.push(
      { id: HOST, full_name: "Mateo", phone: "573000000001", whatsapp_phone: "573009998877" },
      { id: PLAYER, full_name: "Ana", phone: "573001234567", whatsapp_phone: null },
    );
    store.match_players.push(
      { id: "s1", match_id: MATCH, player_id: HOST, status: "paid", joined_at: "2026-06-01T10:00:00Z", guest_name: null, guest_phone: null, invited_by_player_id: null },
      { id: "s2", match_id: MATCH, player_id: PLAYER, status: "paid", joined_at: "2026-06-01T10:01:00Z", guest_name: null, guest_phone: null, invited_by_player_id: null },
      { id: "s3", match_id: MATCH, player_id: null, status: "pending_payment", joined_at: "2026-06-01T10:02:00Z", guest_name: "Carlos", guest_phone: "+57 300 111 2233", invited_by_player_id: PLAYER },
    );

    const contacts = await getMatchContactsForOrganizer(MATCH);
    expect(contacts).toHaveLength(3);

    // Registered: whatsapp_phone wins over phone; digits only.
    expect(contacts[0]).toMatchObject({ name: "Mateo", phone: "573009998877", isGuest: false });
    // Registered with no whatsapp → falls back to phone.
    expect(contacts[1]).toMatchObject({ name: "Ana", phone: "573001234567", isGuest: false });
    // Guest: phone normalized to digits, inviter name resolved, pending flagged.
    expect(contacts[2]).toMatchObject({
      name: "Carlos",
      phone: "573001112233",
      isGuest: true,
      invitedByName: "Ana",
      status: "pending_payment",
    });
  });

  it("excludes cancelled / inactive slots", async () => {
    store.profiles.push({ id: PLAYER, full_name: "Ana", phone: "573001234567", whatsapp_phone: null });
    store.match_players.push(
      { id: "s1", match_id: MATCH, player_id: PLAYER, status: "cancelled", joined_at: "2026-06-01T10:00:00Z", guest_name: null, guest_phone: null, invited_by_player_id: null },
      { id: "s2", match_id: MATCH, player_id: null, status: "cancelled_late", joined_at: "2026-06-01T10:01:00Z", guest_name: "X", guest_phone: "+573001112233", invited_by_player_id: PLAYER },
    );
    expect(await getMatchContactsForOrganizer(MATCH)).toHaveLength(0);
  });

  it("returns a null phone (not a crash) when contact data is missing", async () => {
    store.match_players.push(
      { id: "s1", match_id: MATCH, player_id: null, status: "paid", joined_at: "2026-06-01T10:00:00Z", guest_name: "Sin Tel", guest_phone: null, invited_by_player_id: null },
    );
    const contacts = await getMatchContactsForOrganizer(MATCH);
    expect(contacts[0]).toMatchObject({ name: "Sin Tel", phone: null, isGuest: true });
  });

  it("scopes to the requested match only", async () => {
    store.profiles.push({ id: PLAYER, full_name: "Ana", phone: "573001234567", whatsapp_phone: null });
    store.match_players.push(
      { id: "s1", match_id: MATCH, player_id: PLAYER, status: "paid", joined_at: "2026-06-01T10:00:00Z", guest_name: null, guest_phone: null, invited_by_player_id: null },
      { id: "s2", match_id: "other-match", player_id: PLAYER, status: "paid", joined_at: "2026-06-01T10:00:00Z", guest_name: null, guest_phone: null, invited_by_player_id: null },
    );
    const contacts = await getMatchContactsForOrganizer(MATCH);
    expect(contacts).toHaveLength(1);
  });
});
