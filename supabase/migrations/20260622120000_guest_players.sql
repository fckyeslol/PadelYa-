-- Guest players (non-registered) + combined payment intents
-- Spec: docs/specs/jugadores-invitados.md
--
-- Phase 0 — ADDITIVE ONLY. The existing individual "join & pay" flow keeps
-- working unchanged: legacy `payments` rows keep their own `wompi_reference`
-- and `player_id`, and the legacy RLS policies stay in place. Phase 1 rewrites
-- checkout/webhook to use `payment_intents`.

-- ── 1. match_players: allow guest occupants ──────────────────────────────
-- A guest slot has player_id = NULL and is identified by name + phone, plus
-- the registered player who invited (and pays for) them.
alter table public.match_players
  alter column player_id drop not null,
  add column if not exists guest_name           text,
  add column if not exists guest_phone          text,        -- E.164, e.g. +573001234567
  add column if not exists invited_by_player_id uuid references public.profiles(id),
  add column if not exists claimed_at           timestamptz; -- set when a guest claims the slot

-- Exactly one identity: either a registered player, or a guest with an inviter.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'match_players_player_or_guest_chk'
  ) then
    alter table public.match_players
      add constraint match_players_player_or_guest_chk check (
        (player_id is not null and guest_name is null and guest_phone is null)
        or
        (player_id is null and guest_name is not null and guest_phone is not null
           and invited_by_player_id is not null)
      );
  end if;
end $$;

-- Prevent inviting the same phone twice into one match (among active slots).
-- The legacy unique index on (match_id, player_id) still guards registered
-- players; NULL player_id values are distinct in btree, so guests never collide
-- there. This index guards guests by phone.
create unique index if not exists match_players_unique_active_guest
  on public.match_players (match_id, guest_phone)
  where player_id is null and status in ('pending_payment', 'paid');

-- ── 2. payment_intents: group multiple slots under one Wompi transaction ──
create table if not exists public.payment_intents (
  id                   uuid primary key default gen_random_uuid(),
  match_id             uuid not null references public.matches(id),
  paid_by_player_id    uuid not null references public.profiles(id),  -- who pays
  amount_cop           integer not null check (amount_cop > 0),       -- total = N * org_fee_cop
  currency             text not null default 'COP',
  provider             text not null default 'wompi',
  wompi_reference      text unique,
  wompi_transaction_id text unique,
  payment_method       text,
  status               text not null default 'pending' check (
    status in ('pending', 'approved', 'declined', 'voided', 'refunded')
  ),
  idempotency_key      text not null unique,
  approved_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists payment_intents_match_idx on public.payment_intents (match_id);
create index if not exists payment_intents_payer_idx on public.payment_intents (paid_by_player_id);

-- ── 3. payments: become per-slot allocations under an intent ──────────────
-- Each payment row still maps to exactly one match_player (slot it funds), but
-- now it is grouped under a payment_intent and its player_id may be NULL when
-- the funded slot belongs to a guest.
alter table public.payments
  add column if not exists payment_intent_id uuid references public.payment_intents(id),
  alter column player_id drop not null;

create index if not exists payments_intent_idx on public.payments (payment_intent_id);

-- ── 4. RLS ────────────────────────────────────────────────────────────────
alter table public.payment_intents enable row level security;

create policy "payment_intents_select_own"
  on public.payment_intents for select
  to authenticated
  using (paid_by_player_id = auth.uid());

create policy "payment_intents_insert_own"
  on public.payment_intents for insert
  to authenticated
  with check (paid_by_player_id = auth.uid());

create policy "payment_intents_update_own"
  on public.payment_intents for update
  to authenticated
  using (paid_by_player_id = auth.uid())
  with check (paid_by_player_id = auth.uid());

-- match_players: the inviter creates the guest slot (player_id NULL).
-- The legacy "insert_own" policy (player_id = auth.uid()) does not cover this,
-- so add a guest-specific insert policy. Reads already work via the existing
-- "select_participant_or_open_match" policy (open/full/confirmed/completed
-- matches are visible to all authenticated users).
create policy "match_players_insert_guest"
  on public.match_players for insert
  to authenticated
  with check (
    player_id is null
    and invited_by_player_id = auth.uid()
    and guest_name is not null
    and guest_phone is not null
  );

-- The inviter can update (e.g. cancel) the guest slots they created.
create policy "match_players_update_inviter"
  on public.match_players for update
  to authenticated
  using (invited_by_player_id = auth.uid())
  with check (invited_by_player_id = auth.uid());

-- payments: the payer must see/insert allocation rows even when the funded
-- slot is a guest (player_id NULL). Tie visibility to the parent intent.
-- These are additive (OR'd with the legacy player_id-based policies).
create policy "payments_select_via_intent"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.payment_intents pi
      where pi.id = payments.payment_intent_id
        and pi.paid_by_player_id = auth.uid()
    )
  );

create policy "payments_insert_via_intent"
  on public.payments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.payment_intents pi
      where pi.id = payments.payment_intent_id
        and pi.paid_by_player_id = auth.uid()
    )
  );

-- refunds: the payer should see refunds for slots they paid, including guests.
create policy "refunds_select_via_intent"
  on public.refunds for select
  to authenticated
  using (
    exists (
      select 1
      from public.payments p
      join public.payment_intents pi on pi.id = p.payment_intent_id
      where p.id = refunds.payment_id
        and pi.paid_by_player_id = auth.uid()
    )
  );

-- NOTE on privacy (INV-8): RLS is row-level, not column-level. The
-- "select_participant_or_open_match" policy exposes guest rows (incl.
-- guest_phone) to any authenticated user viewing an open match. The service
-- layer MUST NOT select guest_phone into public payloads — only guest_name is
-- exposed in rosters. Enforced in the read queries (Phase 1/2), not here.
