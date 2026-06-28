/**
 * Regression test for the match-chat send permission (POST /api/matches/:id/messages).
 * Bug: an organizer (admin) who is neither the host nor an enrolled player got
 * 403 "No tienes permiso para escribir en este chat", even though the UI shows
 * them the chat. canSendMessage must allow role = 'organizer'.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStore, createFakeSupabase, type FakeStore, type Row } from "../helpers/fake-supabase";

const h = vi.hoisted(() => ({
  store: null as FakeStore | null,
  user: null as { id: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    ...createFakeSupabase(h.store!),
    auth: { getUser: async () => ({ data: { user: h.user } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => createFakeSupabase(h.store!) }));

import { POST } from "@/app/api/matches/[matchId]/messages/route";

const MATCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const HOST = "11111111-1111-1111-1111-111111111111";
const ORGANIZER = "22222222-2222-2222-2222-222222222222";
const PAID_PLAYER = "33333333-3333-3333-3333-333333333333";
const STRANGER = "44444444-4444-4444-4444-444444444444";

let store: FakeStore;

function callPost(content = "Hola chicos! Cancha 3 a nombre de Mateo") {
  const request = new Request("http://localhost/api/matches/x/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return POST(request, { params: Promise.resolve({ matchId: MATCH }) });
}

beforeEach(() => {
  store = createStore();
  store.matches.push({ id: MATCH, host_player_id: HOST });
  store.profiles.push(
    { id: HOST, role: "player", full_name: "Anfitrión", avatar_url: null },
    { id: ORGANIZER, role: "organizer", full_name: "Mateopirela", avatar_url: null },
    { id: PAID_PLAYER, role: "player", full_name: "Jugador", avatar_url: null },
    { id: STRANGER, role: "player", full_name: "Ajeno", avatar_url: null },
  );
  store.match_players.push({ id: "mp1", match_id: MATCH, player_id: PAID_PLAYER, status: "paid" });
  h.store = store;
});

describe("POST match messages — send permission", () => {
  it("allows an ORGANIZER who is neither host nor enrolled (the reported bug)", async () => {
    h.user = { id: ORGANIZER };
    const res = await callPost();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { message?: { content: string; playerName: string } };
    expect(json.message?.content).toContain("Cancha 3");
    expect(json.message?.playerName).toBe("Mateopirela");
    expect(store.match_messages as Row[]).toHaveLength(1);
    expect((store.match_messages as Row[])[0].player_id).toBe(ORGANIZER);
  });

  it("allows the host", async () => {
    h.user = { id: HOST };
    expect((await callPost()).status).toBe(200);
  });

  it("allows an enrolled paid player", async () => {
    h.user = { id: PAID_PLAYER };
    expect((await callPost()).status).toBe(200);
  });

  it("rejects a stranger (player role, not host, not enrolled) with 403", async () => {
    h.user = { id: STRANGER };
    const res = await callPost();
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/No tienes permiso/);
    expect((store.match_messages as Row[]) ?? []).toHaveLength(0);
  });

  it("rejects an unauthenticated request with 401", async () => {
    h.user = null;
    expect((await callPost()).status).toBe(401);
  });
});
