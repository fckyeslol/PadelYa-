-- EasyCancha multicuenta: 6 sesiones que rotan para extraer disponibilidad de forma
-- espaciada y aleatoria (cada cuenta entra a UN club por turno, en intervalos de
-- 30/45/60 min). Reemplaza el modelo de fila única (easycancha_session), que queda
-- sin uso pero NO se borra para no romper nada en caliente.
--
-- Backend-only: lo escribe/lee el service role (cron + scripts). RLS habilitado SIN
-- políticas = inaccesible con anon/auth.

create table if not exists public.easycancha_accounts (
  id smallint primary key check (id between 1 and 99),
  label text not null default '',
  active boolean not null default true,
  -- credenciales NO viven acá; van en la env var EASYCANCHA_ACCOUNTS (solo el script de
  -- refresh las usa). La DB guarda únicamente el token vigente + estado de scheduling.
  token text not null default '',
  awsalb text not null default '',
  expires_at timestamptz,
  -- scheduling: el heartbeat procesa cuentas con next_run_at <= now().
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_club_id integer,
  updated_at timestamptz not null default now()
);

alter table public.easycancha_accounts enable row level security;

-- Sembrar 6 cuentas (1..6) con arranque escalonado (cada una desfasada 5 min) para que
-- no disparen todas juntas en el primer tick.
insert into public.easycancha_accounts (id, label, next_run_at)
select g, 'cuenta ' || g, now() + make_interval(mins => (g - 1) * 5)
from generate_series(1, 6) as g
on conflict (id) do nothing;

-- Backward-compat: si easycancha_session tenía un token vigente, sembrar la cuenta 1 con
-- él para no quedar sin datos hasta el primer refresh multicuenta.
update public.easycancha_accounts a
set token = s.token,
    awsalb = s.awsalb,
    expires_at = s.expires_at,
    updated_at = now()
from public.easycancha_session s
where a.id = 1 and s.id = 1 and s.token <> '' and a.token = '';
