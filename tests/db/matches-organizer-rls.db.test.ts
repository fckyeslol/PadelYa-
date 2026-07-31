/**
 * Database-level test for the matches SELECT RLS (organizer visibility).
 * Bug: an organizer could not open a match in a non-public status (e.g.
 * cancelled_unfilled / "Sin llenar") because the RLS policies only exposed
 * open/full/confirmed/completed or the host's own rows → getMatchById returned
 * null → notFound. The migration lets organizers read ANY match.
 *
 * Gated on TEST_DATABASE_URL (see .github/workflows/ci.yml).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { createIsolatedDb } from "../helpers/pg-db";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

// Renombrada de 20260629030000 el 2026-07-30, al aplicarla por fin en prod.
const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260731031051_matches_organizer_select.sql",
);

const ORGANIZER = "00000000-0000-0000-0000-000000000000";
const STRANGER = "99999999-9999-9999-9999-999999999999";
const HOST = "11111111-1111-1111-1111-111111111111";

d("matches SELECT RLS — organizer visibility (real SQL)", () => {
  let db: Client;
  let dropDb: () => Promise<void>;

  async function countAs(uid: string): Promise<number> {
    try {
      await db.query("set role authenticated");
      // SET is a utility statement and can't bind params → use set_config().
      await db.query("select set_config('test.uid', $1, false)", [uid]);
      const { rows } = await db.query("select count(*)::int as n from matches");
      return rows[0].n;
    } finally {
      await db.query("reset role");
    }
  }

  beforeAll(async () => {
    ({ client: db, drop: dropDb } = await createIsolatedDb("matches_rls"));
    await db.query("create schema if not exists auth");
    await db.query(
      "create or replace function auth.uid() returns uuid language sql stable as $$ select current_setting('test.uid', true)::uuid $$",
    );
    for (const r of ["authenticated"]) {
      await db.query(
        `do $$ begin if not exists (select 1 from pg_roles where rolname='${r}') then create role ${r}; end if; end $$;`,
      );
    }
    await db.query(`
      drop table if exists matches, profiles cascade;
      create table profiles (id uuid primary key, role text);
      create table matches (id uuid primary key, host_player_id uuid, status text);
      alter table matches enable row level security;
      -- Pre-migration state: the two overlapping policies that ship today.
      drop policy if exists "matches_read_open_flow" on public.matches;
      drop policy if exists "matches_select_open" on public.matches;
      create policy "matches_read_open_flow" on public.matches for select to authenticated
        using (status in ('open','full','confirmed','completed'));
      create policy "matches_select_open" on public.matches for select to authenticated
        using (status in ('open','full','confirmed','completed') or host_player_id = auth.uid());
      grant usage on schema auth, public to authenticated;
      grant select on profiles, matches to authenticated;
      insert into profiles(id, role) values ('${ORGANIZER}','organizer'), ('${STRANGER}','player');
      insert into matches(id, host_player_id, status) values
        ('cccccccc-cccc-cccc-cccc-cccccccccccc','${HOST}','cancelled_unfilled'),
        ('dddddddd-dddd-dddd-dddd-dddddddddddd','${HOST}','open');
    `);
  });

  afterAll(async () => {
    await dropDb?.();
  });

  it("before the migration, an organizer cannot see a cancelled match", async () => {
    // Only the 'open' one is visible (1 of 2).
    expect(await countAs(ORGANIZER)).toBe(1);
  });

  it("after the migration, an organizer sees ALL matches", async () => {
    await db.query(readFileSync(MIGRATION, "utf8"));
    expect(await countAs(ORGANIZER)).toBe(2);
  });

  it("a non-host, non-organizer player still cannot see the cancelled match", async () => {
    // Migration already applied by the previous test; stranger sees only 'open'.
    expect(await countAs(STRANGER)).toBe(1);
  });
});
