-- Allow organizers (admins) to read ANY match, regardless of status.
--
-- The organizer dashboard surfaces matches in every status — including
-- cancelled_unfilled ("Sin llenar"), cancelled_by_organizer and pending_court —
-- and links each card to /matches/<id>. But the matches SELECT policies only
-- exposed open/full/confirmed/completed (or the host's own rows), so opening a
-- cancelled/pending match as a non-host organizer returned null → notFound, and
-- the organizer "couldn't see the match".
--
-- We consolidate the two overlapping SELECT policies (init's
-- "matches_read_open_flow" + "matches_select_open") into one that also grants
-- organizers full read access. The match page already loads the roster via the
-- service-role client, so this single policy unblocks the detail view.

drop policy if exists "matches_read_open_flow" on public.matches;
drop policy if exists "matches_select_open" on public.matches;

create policy "matches_select_open" on public.matches
  for select to authenticated
  using (
    status in ('open', 'full', 'confirmed', 'completed')
    or host_player_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'organizer'
    )
  );
