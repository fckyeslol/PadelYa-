-- EasyCancha: token de sesión + snapshots de disponibilidad + watches para alertas.
-- Todo es backend-only (lo escribe/lee el service role desde el cron y los scripts);
-- RLS habilitado SIN políticas públicas = inaccesible con anon/auth.

-- 1) Token de sesión (una sola fila). Lo refresca scripts/easycancha-refresh-token.ts
--    y lo lee el cron de sync.
create table if not exists public.easycancha_session (
  id smallint primary key default 1 check (id = 1),
  token text not null,
  awsalb text not null default '',
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.easycancha_session enable row level security;

-- 2) Snapshot de disponibilidad por turno. Upsert en cada corrida del sync.
create table if not exists public.easycancha_slots (
  club_id integer not null,
  court_id integer not null,
  slot_date date not null,
  start_time time not null,
  end_time time,
  court_name text,
  price_cop integer,
  is_free boolean not null,
  available_for_waitlist boolean not null default false,
  captured_at timestamptz not null default now(),
  primary key (club_id, court_id, slot_date, start_time)
);

alter table public.easycancha_slots enable row level security;

-- Para listar cupos libres por club/fecha rápido.
create index if not exists easycancha_slots_free_idx
  on public.easycancha_slots (slot_date, club_id)
  where is_free;

-- 3) Qué vigilar para avisar por email cuando un turno pasa de ocupado -> libre.
--    Sin filas activas, el sync solo agrega datos y no manda emails.
--    Campos null = comodín (cualquier club / día / hora).
create table if not exists public.easycancha_slot_watches (
  id uuid primary key default gen_random_uuid(),
  club_id integer,
  weekday smallint check (weekday between 0 and 6),  -- 0=domingo (extract(dow))
  time_from time,
  time_to time,
  notify_email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.easycancha_slot_watches enable row level security;
