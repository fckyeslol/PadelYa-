-- BACKFILL (2026-07-30): esta migracion se habia aplicado en prod SIN quedar
-- versionada en el repo. El repo solo tenia la version original de
-- `init_mvp`, asi que la definicion VIGENTE de la funcion core que llena los
-- partidos no existia en ningun archivo. Se reconstruye desde
-- pg_get_functiondef() en prod (version 20260521045925) para que la DB se pueda
-- recrear desde cero. Ya esta registrada en prod: `db push` la salta.
--
-- Diferencia con init_mvp: ahora RETURNS text ('filled' cuando el partido pasa
-- a full, si no el status actual) en vez de void, para que el caller sepa si
-- este pago fue el que cerro el cupo.
--
-- Nota de orden: 20260731000027 revoca EXECUTE a public/anon/authenticated
-- sobre esta funcion. Corre despues, asi que en un rebuild el resultado final
-- es el mismo que en prod hoy.
CREATE OR REPLACE FUNCTION public.try_fill_match(p_match_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  paid_count integer;
  current_status text;
begin
  select count(*)
  into paid_count
  from public.match_players mp
  where mp.match_id = p_match_id
    and mp.status = 'paid';

  select status into current_status from public.matches where id = p_match_id for update;

  if current_status is null then
    raise exception 'match not found';
  end if;

  if paid_count >= 4 and current_status = 'open' then
    update public.matches
    set status = 'full',
        filled_at = now()
    where id = p_match_id;

    insert into public.match_operations (match_id, operation, status)
    values (p_match_id, 'court_booking_pending', 'pending');

    insert into public.analytics_events (event_name, match_id, properties)
    values ('match_filled', p_match_id, jsonb_build_object('paid_count', paid_count));

    return 'filled';
  end if;

  return current_status;
end;
$function$;
