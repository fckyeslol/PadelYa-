-- Allow organizers (admins) to read and post in any match chat.
--
-- The match detail page already shows the chat to organizers (`canChat`), but
-- the RLS policies only covered the host + enrolled players, so an organizer who
-- is neither could not SELECT messages (no live/initial history) nor INSERT.
-- The POST /messages route writes via the service-role client, but we keep the
-- INSERT policy coherent so the rule is the same wherever it is evaluated.

drop policy if exists "messages_select_participant" on public.match_messages;
drop policy if exists "messages_insert_participant" on public.match_messages;

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
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'organizer'
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
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'organizer'
      )
    )
  );
