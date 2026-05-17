-- Create profile automatically when a new auth user signs up (any email).
-- This does not depend on the auth callback or service role key.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  v_last text := nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), '');
  v_full_name text;
begin
  v_full_name := trim(concat_ws(' ', v_first, v_last));

  if v_full_name is null or v_full_name = '' then
    v_full_name := coalesce(
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Jugador'
    );
  end if;

  insert into public.profiles (id, full_name, phone, skill_level, role)
  values (new.id, v_full_name, '', 'beginner', 'player')
  on conflict (id) do update
  set
    full_name = case
      when profiles.full_name is null
        or trim(profiles.full_name) = ''
        or profiles.full_name like '%@%'
      then excluded.full_name
      else profiles.full_name
    end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
