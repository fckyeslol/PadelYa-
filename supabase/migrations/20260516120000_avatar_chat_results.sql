-- Add avatar_url to profiles
alter table public.profiles
  add column if not exists avatar_url text null;

-- Match messages (chat por partido)
create table if not exists public.match_messages (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  player_id   uuid not null references auth.users(id),
  content     text not null check (length(content) > 0 and length(content) <= 500),
  created_at  timestamptz not null default now()
);

alter table public.match_messages enable row level security;

create policy "messages_select_participant" on public.match_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.match_players mp
      where mp.match_id = match_messages.match_id
        and mp.player_id = auth.uid()
        and mp.status in ('paid', 'pending_payment')
    )
    or exists (
      select 1 from public.matches m
      where m.id = match_messages.match_id
        and m.host_player_id = auth.uid()
    )
  );

create policy "messages_insert_participant" on public.match_messages
  for insert to authenticated
  with check (
    player_id = auth.uid()
    and (
      exists (
        select 1 from public.match_players mp
        where mp.match_id = match_messages.match_id
          and mp.player_id = auth.uid()
          and mp.status in ('paid', 'pending_payment')
      )
      or exists (
        select 1 from public.matches m
        where m.id = match_messages.match_id
          and m.host_player_id = auth.uid()
      )
    )
  );

-- Match results (registro post-partido)
create table if not exists public.match_results (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null unique references public.matches(id) on delete cascade,
  set1_team1    smallint not null,
  set1_team2    smallint not null,
  set2_team1    smallint not null,
  set2_team2    smallint not null,
  set3_team1    smallint null,
  set3_team2    smallint null,
  winner_team   smallint not null check (winner_team in (1, 2)),
  recorded_by   uuid not null references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table public.match_results enable row level security;

create policy "results_select_auth" on public.match_results
  for select to authenticated using (true);

create policy "results_insert_participant" on public.match_results
  for insert to authenticated
  with check (
    recorded_by = auth.uid()
    and (
      exists (
        select 1 from public.match_players mp
        where mp.match_id = match_results.match_id
          and mp.player_id = auth.uid()
          and mp.status = 'paid'
      )
      or exists (
        select 1 from public.matches m
        where m.id = match_results.match_id
          and m.host_player_id = auth.uid()
      )
    )
  );

-- Storage: avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_auth_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
