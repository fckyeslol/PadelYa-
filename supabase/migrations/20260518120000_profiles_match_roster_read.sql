-- Match roster: host and participants can read names/avatars of everyone on that match
drop policy if exists "profiles_read_match_participant" on public.profiles;

create policy "profiles_read_match_participant"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.matches m
      where (
        m.host_player_id = profiles.id
        or exists (
          select 1
          from public.match_players mp
          where mp.match_id = m.id
            and mp.player_id = profiles.id
        )
      )
      and (
        m.host_player_id = auth.uid()
        or exists (
          select 1
          from public.match_players mp2
          where mp2.match_id = m.id
            and mp2.player_id = auth.uid()
            and mp2.status in ('pending_payment', 'paid')
        )
      )
    )
  );
