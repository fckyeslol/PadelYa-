-- Opt-in flag for the "new match" WhatsApp broadcast + capture phone and
-- notification preference at signup time (from auth metadata).

alter table public.profiles
  add column if not exists wants_match_notifications boolean not null default true;

-- Extend the signup trigger to persist phone + whatsapp_phone + opt-in flag
-- coming from raw_user_meta_data (set by the signup form).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  v_last text := nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), '');
  v_phone text := nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '');
  v_wants boolean := coalesce(
    (new.raw_user_meta_data->>'wants_match_notifications')::boolean,
    true
  );
  v_full_name text;
begin
  v_full_name := trim(concat_ws(' ', v_first, v_last));

  if v_full_name is null or v_full_name = '' then
    v_full_name := coalesce(
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Jugador'
    );
  end if;

  insert into public.profiles (
    id, full_name, phone, whatsapp_phone, skill_level, role, wants_match_notifications
  )
  values (
    new.id, v_full_name, coalesce(v_phone, ''), v_phone, 'beginner', 'player', v_wants
  )
  on conflict (id) do update
  set
    full_name = case
      when profiles.full_name is null
        or trim(profiles.full_name) = ''
        or profiles.full_name like '%@%'
      then excluded.full_name
      else profiles.full_name
    end,
    phone = case
      when profiles.phone is null or trim(profiles.phone) = ''
      then excluded.phone
      else profiles.phone
    end,
    whatsapp_phone = case
      when profiles.whatsapp_phone is null or trim(profiles.whatsapp_phone) = ''
      then excluded.whatsapp_phone
      else profiles.whatsapp_phone
    end,
    wants_match_notifications = excluded.wants_match_notifications;

  return new;
end;
$$;
