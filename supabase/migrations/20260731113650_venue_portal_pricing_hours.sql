-- Portal de sedes: que cada club administre su propio tarifario y horario.
--
-- Reemplaza lo que hacia el scraping de EasyCancha (eliminado el 2026-07-30): en vez de
-- espiar los precios del club, el club los carga. El tarifario estatico de
-- config/venue-pricing-rules.ts queda como FALLBACK: si una sede nunca carga precios,
-- todo sigue funcionando igual que hoy.

-- ── Tarifario administrado por la sede ────────────────────────────────────────
-- court_price_cop = lo que el CLUB cobra por la cancha, SIN nuestra comision.
-- La tarifa por jugador se calcula (court_price_cop + COURT_MARKUP_COP) / 4, igual que
-- con las reglas estaticas.
create table if not exists public.venue_price_rules (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null,
  day_type text not null check (day_type in ('weekday', 'friday', 'saturday', 'sunday')),
  duration_minutes integer not null check (duration_minutes in (60, 90, 120)),
  start_time time not null,
  end_time time not null,
  court_price_cop integer not null check (court_price_cop > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_price_rules_range check (end_time > start_time),
  -- backstop contra franjas duplicadas; el solape parcial se valida en la app
  unique (venue_id, day_type, duration_minutes, start_time)
);

create index if not exists venue_price_rules_lookup
  on public.venue_price_rules (venue_id, day_type, duration_minutes, start_time);

-- ── Horario de apertura por sede y tipo de dia ────────────────────────────────
create table if not exists public.venue_hours (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null,
  day_type text not null check (day_type in ('weekday', 'friday', 'saturday', 'sunday')),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (venue_id, day_type),
  constraint venue_hours_range check (
    is_closed or (opens_at is not null and closes_at is not null and closes_at > opens_at)
  )
);

-- ── Rate limiting del login del portal ────────────────────────────────────────
-- El portal pasa a tener usuarios externos reales (las sedes), asi que el login deja de
-- ser ilimitado. En serverless no sirve un contador en memoria: vive en la DB.
create table if not exists public.venue_login_attempts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists venue_login_attempts_recent
  on public.venue_login_attempts (username, attempted_at desc);

-- Para saber si la sede sigue con la contraseña sembrada a mano en 20260520120000.
alter table public.venue_accounts
  add column if not exists password_updated_at timestamptz;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Igual que el resto de tablas del portal: solo service_role. El portal no usa Supabase
-- Auth — entra con su propia cookie de sesion y todo pasa por rutas del servidor.
alter table public.venue_price_rules enable row level security;
alter table public.venue_hours enable row level security;
alter table public.venue_login_attempts enable row level security;
