-- Add pending_court status to matches
-- Matches start in this state until the organizer confirms the court booking
alter table public.matches
  drop constraint if exists matches_status_check;

alter table public.matches
  add constraint matches_status_check check (
    status in (
      'pending_court',
      'open',
      'full',
      'confirmed',
      'completed',
      'cancelled_unfilled',
      'cancelled_by_organizer'
    )
  );

-- Update RLS policy so pending_court matches are only visible to the host
drop policy if exists "matches_select_open" on public.matches;

create policy "matches_select_open"
  on public.matches for select
  to authenticated
  using (
    status in ('open', 'full', 'confirmed', 'completed')
    or host_player_id = auth.uid()
  );
