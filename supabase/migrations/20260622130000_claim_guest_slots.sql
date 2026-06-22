-- Claim guest slots when a person registers (or sets a phone) that matches a
-- guest_phone. Links the guest slot to the new profile, preserving history.
-- Spec: docs/specs/jugadores-invitados.md (INV-7, Fase 4).

-- Links any guest slots whose phone matches p_phone to p_player_id. Compares the
-- last 10 digits (Colombian local number) so formatting differences don't matter.
-- Skips matches where the player already holds an active slot (avoids violating
-- the (match_id, player_id) active-slot unique index).
create or replace function public.claim_guest_slots(p_player_id uuid, p_phone text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  v_count integer := 0;
begin
  if v_local is null or length(v_local) < 10 then
    return 0;
  end if;

  update public.match_players mp
  set player_id = p_player_id,
      guest_name = null,
      guest_phone = null,
      claimed_at = now()
  where mp.player_id is null
    and mp.guest_phone is not null
    and right(regexp_replace(mp.guest_phone, '\D', '', 'g'), 10) = v_local
    and mp.status in ('pending_payment', 'paid')
    and not exists (
      select 1
      from public.match_players existing
      where existing.match_id = mp.match_id
        and existing.player_id = p_player_id
        and existing.status in ('pending_payment', 'paid')
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Fire the claim whenever a profile is created or its phone columns change.
-- handle_new_user inserts the profile at signup, which fires this on INSERT.
create or replace function public.claim_guest_slots_on_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.claim_guest_slots(
    new.id,
    coalesce(nullif(trim(new.phone), ''), new.whatsapp_phone)
  );
  return new;
end;
$$;

drop trigger if exists trg_claim_guest_on_profile on public.profiles;
create trigger trg_claim_guest_on_profile
  after insert or update of phone, whatsapp_phone on public.profiles
  for each row
  execute function public.claim_guest_slots_on_profile();

-- Server-only: not meant to be called directly via PostgREST.
revoke execute on function public.claim_guest_slots(uuid, text) from anon, authenticated;
