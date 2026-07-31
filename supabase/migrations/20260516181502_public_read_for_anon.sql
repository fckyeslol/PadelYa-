-- BACKFILL (2026-07-30): esta migracion se habia aplicado en prod SIN quedar
-- versionada en el repo. Se reconstruye desde
-- supabase_migrations.schema_migrations (version 20260516181502) para que la DB
-- se pueda recrear desde cero. Ya esta registrada en prod: `db push` la salta.

-- Allow anon users to see open/full/confirmed matches
create policy "matches_select_public"
  on public.matches for select
  to anon
  using (
    status in ('open', 'full', 'confirmed', 'completed')
  );

-- Allow anon to see players of open matches (for social proof / player count)
create policy "match_players_select_public"
  on public.match_players for select
  to anon
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_players.match_id
        and m.status in ('open', 'full', 'confirmed', 'completed')
    )
  );

-- Allow anon to read basic public profile fields (name + avatar)
create policy "profiles_select_public"
  on public.profiles for select
  to anon
  using (true);
