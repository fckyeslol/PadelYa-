-- match_messages.player_id referenced auth.users(id) instead of public.profiles(id).
-- PostgREST can only resolve joins through FKs in the public schema, so the
-- profiles(full_name, avatar_url) embed in every messages query returned a
-- 400 "relationship not found" error, making the initial chat history silently
-- empty and breaking the per-message profile enrichment on Realtime events.

alter table public.match_messages
  drop constraint if exists match_messages_player_id_fkey;

alter table public.match_messages
  add constraint match_messages_player_id_fkey
  foreign key (player_id) references public.profiles(id) on delete cascade;

-- Index so the Realtime filter (match_id=eq.<uuid>) and the initial
-- SELECT query both hit an index scan instead of a seq scan.
create index if not exists match_messages_match_id_idx
  on public.match_messages (match_id);

-- Recreate RLS policies idempotently in case a previous partial run left
-- them in an inconsistent state.
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
