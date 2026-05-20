-- Portal de administración para sedes (7 canchas de Barranquilla)

create table if not exists public.venue_accounts (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null,
  username text not null,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (username),
  unique (venue_id)
);

create table if not exists public.venue_courts (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists venue_courts_venue_id_idx on public.venue_courts (venue_id);

create table if not exists public.venue_slot_blocks (
  id uuid primary key default gen_random_uuid(),
  venue_court_id uuid not null references public.venue_courts(id) on delete cascade,
  slot_date date not null,
  slot_time text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (venue_court_id, slot_date, slot_time)
);

create index if not exists venue_slot_blocks_lookup_idx
  on public.venue_slot_blocks (venue_court_id, slot_date);

alter table public.matches
  add column if not exists venue_court_id uuid references public.venue_courts(id);

create index if not exists matches_venue_court_scheduled_idx
  on public.matches (venue_court_id, scheduled_at)
  where venue_court_id is not null;

-- RLS: sin acceso público; el portal usa service role
alter table public.venue_accounts enable row level security;
alter table public.venue_courts enable row level security;
alter table public.venue_slot_blocks enable row level security;

-- Contraseñas únicas por cancha (scrypt, generadas con lib/auth/venue-password.ts)
insert into public.venue_accounts (venue_id, username, password_hash)
values
  ('padel-zenter-del-rio',    'DelRio',    '2UI4v0A7tJ60ySChrH5UKg==:IKU1Cpg+fa444bjwzHEJ70MHFfH2SM97kLJuSo9f7r0axtGxo3yXrlmeZJtORPc2Dq8i3JIej2ijcvGucd7nXw=='),
  ('casa-padel',              'CasaPadel', 'YodhQbvh7cI01EuZ9bt5cg==:JNggSF9/7HRlTC9zDMEaKqGkyARnpUxMuRuvWTVx+jcyMlOFtUaaWgxl29lblrXMI/QFr87Pj2Sn2OMd5tmq6Q=='),
  ('padel-zenter-la-arenosa', 'LaArenosa', '1GUXuEjeW9QoUAkTqiE6Wg==:42iTD7XuCDgaW4dXxA9dg4inej1PUwP3CR3OXoH0l1nq55ssraCIK5ivyT6zxLOVtgHBWrb2rJLOey3y7Yer2g=='),
  ('la-jaula',                'LaJaula',   'aSBX7svRlOvl6wIYzOkXAQ==:j5u8FeLxm2al3e+lbVhcv8/AFUofs7DapRNGD67O72ArYZAhf5+UehPLkGr7YPID390XyTZv2JL2IogRsaxCAQ=='),
  ('padel-park',              'PadelPark', 'bJDRWae5KbdYMc0mjZAO9A==:ZRtvidhaRjGIQWdCWILbhWk95FfbzWDDqMxX2T2on1daJFgmB+El36zlMXJrNVIBeZBse6OljVJmBHCAUWfI9Q=='),
  ('ace-padel-club',          'AcePadel',  'ndcTCOU8JPVDFlF4Dmj63w==:SSR6SZ5lVosvy/JMbOyjY65Vf3W9Mjbrrq40y8I983hzQqV96qX8AouHUOMayDEVqqZtfJXii4nr2HIVjr/cfg=='),
  ('x3-padel-club',           'X3Padel',   'eHhWrNXkwilCarKNxIFUcw==:u161kXfCQNOmR3L+n5eaGHnXuFwR2YBJBVuyQswPZnDPRGKV1CgyQ7/Mqw5ijbxISptYPoAYUQn4aWqjTO1ojg==')
on conflict (venue_id) do nothing;

insert into public.venue_courts (venue_id, name, sort_order)
select v.venue_id, v.name, v.sort_order
from (
  values
    ('padel-zenter-del-rio', 'Cancha 1', 1),
    ('padel-zenter-del-rio', 'Cancha 2', 2),
    ('casa-padel', 'Cancha 1', 1),
    ('casa-padel', 'Cancha 2', 2),
    ('padel-zenter-la-arenosa', 'Cancha 1', 1),
    ('padel-zenter-la-arenosa', 'Cancha 2', 2),
    ('la-jaula', 'Cancha 1', 1),
    ('la-jaula', 'Cancha 2', 2),
    ('la-jaula', 'Cancha 3', 3),
    ('padel-park', 'Cancha 1', 1),
    ('padel-park', 'Cancha 2', 2),
    ('ace-padel-club', 'Cancha 1', 1),
    ('ace-padel-club', 'Cancha 2', 2),
    ('x3-padel-club', 'Cancha 1', 1),
    ('x3-padel-club', 'Cancha 2', 2)
) as v(venue_id, name, sort_order)
where not exists (
  select 1 from public.venue_courts c
  where c.venue_id = v.venue_id and c.name = v.name
);
