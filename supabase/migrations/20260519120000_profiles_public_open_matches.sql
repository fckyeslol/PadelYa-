-- Allow anyone browsing open matches to see player names/avatars on cards
create policy "profiles_read_public_open_matches"
  on public.profiles for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.matches m
      where m.host_player_id = profiles.id
        and m.status in ('open', 'full', 'confirmed')
        and m.scheduled_at > now()
    )
    or exists (
      select 1
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      where mp.player_id = profiles.id
        and m.status in ('open', 'full', 'confirmed')
        and m.scheduled_at > now()
        and mp.status in ('pending_payment', 'paid')
    )
  );
