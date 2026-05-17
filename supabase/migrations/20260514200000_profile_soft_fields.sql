-- Make phone optional so profiles can be created at magic-link time (before full onboarding)
alter table public.profiles
  alter column phone set default '',
  alter column phone drop not null;

-- Default skill_level so the trigger/callback can insert without it
alter table public.profiles
  alter column skill_level set default 'beginner';

-- Allow reading other players' names in match context (needed for match rosters)
create policy "profiles_read_match_participant"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.match_players mp
      where mp.player_id = profiles.id
        and exists (
          select 1 from public.match_players mp2
          where mp2.match_id = mp.match_id
            and mp2.player_id = auth.uid()
            and mp2.status in ('pending_payment', 'paid')
        )
    )
  );
