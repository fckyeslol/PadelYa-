-- Reemplazo atomico de la grilla de precios de una sede para un dia + duracion.
--
-- El portal siempre manda la grilla COMPLETA de esa combinacion. Sin transaccion habria
-- que borrar y volver a insertar en dos viajes desde la app: si el insert falla despues
-- del delete, la sede se queda SIN tarifario y sus partidos pasan a cobrarse con el
-- fallback estatico sin que nadie se entere. Por eso vive en una funcion.
create or replace function public.replace_venue_price_rules(
  p_venue_id text,
  p_day_type text,
  p_duration_minutes integer,
  p_rules jsonb
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inserted integer;
begin
  if p_day_type not in ('weekday', 'friday', 'saturday', 'sunday') then
    raise exception 'day_type invalido: %', p_day_type;
  end if;
  if p_duration_minutes not in (60, 90, 120) then
    raise exception 'duration_minutes invalido: %', p_duration_minutes;
  end if;

  delete from public.venue_price_rules
  where venue_id = p_venue_id
    and day_type = p_day_type
    and duration_minutes = p_duration_minutes;

  insert into public.venue_price_rules
    (venue_id, day_type, duration_minutes, start_time, end_time, court_price_cop)
  select
    p_venue_id,
    p_day_type,
    p_duration_minutes,
    (r->>'startTime')::time,
    (r->>'endTime')::time,
    (r->>'courtPriceCop')::integer
  from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) as r;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- Solo service_role, igual que el resto de RPCs del proyecto. Revocar a PUBLIC es lo que
-- realmente cierra el acceso de anon (ver 20260731000027).
revoke execute on function public.replace_venue_price_rules(text, text, integer, jsonb)
  from public, anon, authenticated;
