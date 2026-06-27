/**
 * Database-level tests for the guest CLAIM flow (INV-7, Fase 4) — the one piece
 * of the guest system that is pure SQL (a plpgsql function + a trigger on
 * profiles), with no TypeScript surface, so it cannot be exercised by the
 * in-memory fake. These tests load the REAL migration file and run it against a
 * real Postgres.
 *
 * Gated on TEST_DATABASE_URL: when it is absent (the default `npm test` run),
 * the whole suite is skipped so the rest stays green without a database. CI
 * provides a Postgres service and sets the variable (see .github/workflows).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260622130000_claim_guest_slots.sql",
);

const PLAYER = "22222222-2222-2222-2222-222222222222";
const OTHER = "33333333-3333-3333-3333-333333333333";
const MATCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MATCH2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

d("claim_guest_slots (real SQL against Postgres)", () => {
  let db: Client;

  beforeAll(async () => {
    db = new Client({ connectionString: url });
    await db.connect();
    // Supabase-only roles referenced by the migration's REVOKE (no IF NOT EXISTS
    // for CREATE ROLE in Postgres → create them defensively).
    for (const r of ["anon", "authenticated"]) {
      await db.query(
        `do $$ begin if not exists (select 1 from pg_roles where rolname='${r}') then create role ${r}; end if; end $$;`,
      );
    }
    // Minimal schema the claim function + trigger touch (idempotent for re-runs).
    await db.query(`
      create extension if not exists pgcrypto;
      drop table if exists match_players, profiles cascade;
      create table profiles (
        id uuid primary key,
        phone text,
        whatsapp_phone text
      );
      create table match_players (
        id uuid primary key default gen_random_uuid(),
        match_id uuid not null,
        player_id uuid references profiles(id),
        guest_name text,
        guest_phone text,
        status text not null,
        claimed_at timestamptz
      );
    `);
    // Load and apply the REAL migration (function + trigger + revoke).
    await db.query(readFileSync(MIGRATION, "utf8"));
  });

  afterAll(async () => {
    await db?.end();
  });

  beforeEach(async () => {
    await db.query("truncate match_players; delete from profiles;");
    await db.query("insert into profiles (id, phone) values ($1, $2), ($3, $4)", [
      PLAYER,
      "+573009998877",
      OTHER,
      "+573005554433",
    ]);
  });

  async function addGuest(phone: string, status = "paid", matchId = MATCH) {
    const { rows } = await db.query(
      `insert into match_players (match_id, player_id, guest_name, guest_phone, status)
       values ($1, null, 'Carlos', $2, $3) returning id`,
      [matchId, phone, status],
    );
    return rows[0].id as string;
  }

  async function slot(id: string) {
    const { rows } = await db.query("select * from match_players where id=$1", [id]);
    return rows[0];
  }

  it("links a matching guest slot and clears the guest identity (last-10-digit match)", async () => {
    // Stored E.164 with spaces; claim called with bare local number → same last 10 digits.
    const id = await addGuest("+57 300 111 2233");
    const { rows } = await db.query("select claim_guest_slots($1,$2) as n", [PLAYER, "3001112233"]);
    expect(rows[0].n).toBe(1);

    const s = await slot(id);
    expect(s.player_id).toBe(PLAYER);
    expect(s.guest_name).toBeNull();
    expect(s.guest_phone).toBeNull();
    expect(s.claimed_at).not.toBeNull();
  });

  it("does not claim when the phone does not match", async () => {
    const id = await addGuest("+573001112233");
    const { rows } = await db.query("select claim_guest_slots($1,$2) as n", [PLAYER, "3009998877"]);
    expect(rows[0].n).toBe(0);
    expect((await slot(id)).player_id).toBeNull();
  });

  it("ignores cancelled / inactive guest slots", async () => {
    await addGuest("+573001112233", "cancelled");
    const { rows } = await db.query("select claim_guest_slots($1,$2) as n", [PLAYER, "3001112233"]);
    expect(rows[0].n).toBe(0);
  });

  it("returns 0 for a phone with fewer than 10 digits", async () => {
    await addGuest("+573001112233");
    const { rows } = await db.query("select claim_guest_slots($1,$2) as n", [PLAYER, "12345"]);
    expect(rows[0].n).toBe(0);
  });

  it("skips a match where the player already holds an active slot (no unique-index violation)", async () => {
    // Player already has a paid slot in MATCH; a guest with the player's phone is
    // also in MATCH → must NOT be claimed there. A guest in MATCH2 IS claimed.
    await db.query(
      "insert into match_players (match_id, player_id, status) values ($1,$2,'paid')",
      [MATCH, PLAYER],
    );
    const inSame = await addGuest("+573001112233", "paid", MATCH);
    const inOther = await addGuest("+573001112233", "paid", MATCH2);

    const { rows } = await db.query("select claim_guest_slots($1,$2) as n", [PLAYER, "3001112233"]);
    expect(rows[0].n).toBe(1); // only the MATCH2 slot
    expect((await slot(inSame)).player_id).toBeNull();
    expect((await slot(inOther)).player_id).toBe(PLAYER);
  });

  it("claims multiple matching guest slots across different matches at once", async () => {
    const a = await addGuest("+573001112233", "paid", MATCH);
    const b = await addGuest("3001112233", "pending_payment", MATCH2);
    const { rows } = await db.query("select claim_guest_slots($1,$2) as n", [PLAYER, "+57 300 111 2233"]);
    expect(rows[0].n).toBe(2);
    expect((await slot(a)).player_id).toBe(PLAYER);
    expect((await slot(b)).player_id).toBe(PLAYER);
  });

  it("the profiles trigger auto-claims on signup (insert with a matching phone)", async () => {
    const id = await addGuest("+573001112233");
    const NEW = "44444444-4444-4444-4444-444444444444";
    await db.query("insert into profiles (id, phone) values ($1,$2)", [NEW, "300 111 2233"]);
    // Trigger fired claim_guest_slots(NEW, '300 111 2233').
    expect((await slot(id)).player_id).toBe(NEW);
  });
});
