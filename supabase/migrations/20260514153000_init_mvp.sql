create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  whatsapp_phone text,
  skill_level text not null check (skill_level in ('beginner', 'intermediate', 'advanced')),
  role text not null default 'player' check (role in ('player', 'organizer')),
  strike_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default 'Barranquilla',
  address text,
  maps_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  host_player_id uuid not null references public.profiles(id),
  venue_id uuid references public.venues(id),
  venue_name text not null,
  scheduled_at timestamptz not null,
  join_deadline timestamptz not null,
  skill_level text not null check (skill_level in ('beginner', 'intermediate', 'advanced')),
  max_players integer not null default 4 check (max_players = 4),
  org_fee_cop integer not null default 6000,
  status text not null default 'open' check (
    status in (
      'open',
      'full',
      'confirmed',
      'completed',
      'cancelled_unfilled',
      'cancelled_by_organizer'
    )
  ),
  notes text,
  filled_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  court_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  is_host boolean not null default false,
  status text not null default 'pending_payment' check (
    status in ('pending_payment', 'paid', 'cancelled', 'cancelled_late', 'no_show')
  ),
  joined_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (match_id, player_id)
);

create unique index if not exists match_players_one_pending_or_paid_per_user
  on public.match_players (match_id, player_id)
  where status in ('pending_payment', 'paid');

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  match_player_id uuid not null references public.match_players(id) on delete cascade,
  match_id uuid not null references public.matches(id),
  player_id uuid not null references public.profiles(id),
  amount_cop integer not null,
  currency text not null default 'COP',
  provider text not null default 'wompi',
  wompi_reference text unique,
  wompi_transaction_id text unique,
  payment_method text,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'declined', 'voided', 'refunded')
  ),
  idempotency_key text not null unique,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount_cop integer not null,
  status text not null default 'pending_manual' check (
    status in ('pending_manual', 'processed', 'rejected')
  ),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.match_operations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  operation text not null check (
    operation in ('court_booking_pending', 'court_booking_confirmed')
  ),
  status text not null default 'pending' check (status in ('pending', 'done')),
  note text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  user_id uuid references public.profiles(id),
  match_id uuid references public.matches(id),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.try_fill_match(p_match_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  paid_count integer;
  current_status text;
begin
  select count(*)
  into paid_count
  from public.match_players mp
  where mp.match_id = p_match_id
    and mp.status = 'paid';

  select status into current_status from public.matches where id = p_match_id for update;

  if current_status is null then
    raise exception 'match not found';
  end if;

  if paid_count >= 4 and current_status = 'open' then
    update public.matches
    set status = 'full',
        filled_at = now()
    where id = p_match_id;

    insert into public.match_operations (match_id, operation, status)
    values (p_match_id, 'court_booking_pending', 'pending');

    insert into public.analytics_events (event_name, match_id, properties)
    values ('match_filled', p_match_id, jsonb_build_object('paid_count', paid_count));

    return 'full';
  end if;

  return current_status;
end;
$$;

create or replace function public.cancel_unfilled_matches()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.matches
  set status = 'cancelled_unfilled',
      cancelled_at = now()
  where status = 'open'
    and join_deadline <= now()
    and (
      select count(*)
      from public.match_players mp
      where mp.match_id = matches.id
        and mp.status = 'paid'
    ) < 4;

  get diagnostics v_count = row_count;

  insert into public.refunds (payment_id, amount_cop, reason)
  select p.id, p.amount_cop, 'match_cancelled_unfilled'
  from public.payments p
  join public.matches m on m.id = p.match_id
  where m.status = 'cancelled_unfilled'
    and p.status = 'approved'
    and not exists (
      select 1 from public.refunds r where r.payment_id = p.id
    );

  return v_count;
end;
$$;

create or replace function public.expire_pending_match_payments(p_minutes integer default 15)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with expired_rows as (
    update public.match_players mp
    set status = 'cancelled',
        cancelled_at = now()
    where mp.status = 'pending_payment'
      and mp.joined_at <= now() - make_interval(mins => p_minutes)
    returning mp.id
  )
  update public.payments p
  set status = 'voided'
  where p.match_player_id in (select id from expired_rows)
    and p.status = 'pending';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.match_operations enable row level security;
alter table public.analytics_events enable row level security;

create policy "profiles_read_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "venues_public_read"
  on public.venues for select
  to authenticated
  using (is_active = true);

create policy "matches_read_open_flow"
  on public.matches for select
  to authenticated
  using (status in ('open', 'full', 'confirmed', 'completed'));

create policy "matches_create_authenticated"
  on public.matches for insert
  to authenticated
  with check (host_player_id = auth.uid());

create policy "matches_update_host_before_full"
  on public.matches for update
  to authenticated
  using (host_player_id = auth.uid() and status = 'open')
  with check (host_player_id = auth.uid());

create policy "match_players_select_participant_or_open_match"
  on public.match_players for select
  to authenticated
  using (
    player_id = auth.uid()
    or exists (
      select 1 from public.matches m
      where m.id = match_players.match_id
        and m.status in ('open', 'full', 'confirmed', 'completed')
    )
  );

create policy "match_players_insert_own"
  on public.match_players for insert
  to authenticated
  with check (player_id = auth.uid());

create policy "match_players_update_own"
  on public.match_players for update
  to authenticated
  using (player_id = auth.uid())
  with check (player_id = auth.uid());

create policy "payments_select_own"
  on public.payments for select
  to authenticated
  using (player_id = auth.uid());

create policy "payments_insert_own"
  on public.payments for insert
  to authenticated
  with check (player_id = auth.uid());

create policy "refunds_select_own"
  on public.refunds for select
  to authenticated
  using (
    exists (
      select 1 from public.payments p
      where p.id = refunds.payment_id
        and p.player_id = auth.uid()
    )
  );

create policy "analytics_insert_authenticated"
  on public.analytics_events for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

create policy "analytics_select_organizer"
  on public.analytics_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'organizer'
    )
  );

create policy "match_operations_select_organizer"
  on public.match_operations for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'organizer'
    )
  );

create policy "match_operations_select_participant"
  on public.match_operations for select
  to authenticated
  using (
    exists (
      select 1 from public.match_players mp
      where mp.match_id = match_operations.match_id
        and mp.player_id = auth.uid()
        and mp.status in ('pending_payment', 'paid')
    )
  );

-- These functions are server-only (cron jobs / payment webhooks).
-- Revoke public execute so they cannot be triggered via /rest/v1/rpc/.
revoke execute on function public.cancel_unfilled_matches() from anon, authenticated;
revoke execute on function public.expire_pending_match_payments(integer) from anon, authenticated;
revoke execute on function public.try_fill_match(uuid) from anon, authenticated;

create or replace view public.v_matches_funnel
with (security_invoker = true) as
select
  date_trunc('week', created_at) as week_start,
  count(*) as matches_created,
  count(*) filter (where status in ('full', 'confirmed', 'completed')) as matches_filled,
  count(*) filter (where status in ('confirmed', 'completed')) as matches_confirmed,
  count(*) filter (where status = 'completed') as matches_completed
from public.matches
group by 1;

create or replace view public.v_payment_conversion
with (security_invoker = true) as
select
  date_trunc('week', created_at) as week_start,
  count(*) filter (where event_name = 'checkout_started') as checkout_started,
  count(*) filter (where event_name = 'payment_approved') as payment_approved
from public.analytics_events
group by 1;

create or replace view public.v_organizer_revenue
with (security_invoker = true) as
select
  date_trunc('week', approved_at) as week_start,
  sum(amount_cop) as gross_revenue_cop
from public.payments
where status = 'approved'
group by 1;

create or replace view public.v_repeat_players
with (security_invoker = true) as
with paid_matches as (
  select player_id, count(*) as paid_match_count
  from public.match_players
  where status = 'paid'
  group by player_id
)
select
  count(*) filter (where paid_match_count >= 2) as repeat_players,
  count(*) as total_paying_players
from paid_matches;
