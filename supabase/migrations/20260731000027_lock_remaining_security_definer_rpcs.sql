-- Cierra el resto de RPCs SECURITY DEFINER que seguian expuestas a `anon`
-- por el grant que Postgres le da a PUBLIC por defecto (mismo patron que
-- 20260730235235: revocar solo a anon/authenticated no sirve, hay que
-- revocarle a PUBLIC).
--
-- Confirmado que estaban realmente expuestas: llamando
-- /rest/v1/rpc/try_fill_match con la anon key y la firma correcta, PostgREST
-- devolvia `P0001 match not found` — o sea la funcion se ejecutaba como anon.
--
-- Los 4 unicos llamadores legitimos usan getSupabaseAdminClient() (service_role),
-- que conserva EXECUTE:
--   cancel_unfilled_matches       -> services/matches/operations.ts:176
--   expire_pending_match_payments -> services/matches/operations.ts:319
--   try_fill_match                -> services/payments/service.ts:669,806
--                                    app/api/admin/sync-payments/route.ts:163
--   easycancha_watchdog           -> pg_cron (corre como postgres)
revoke execute on function public.cancel_unfilled_matches()
  from public, anon, authenticated;

revoke execute on function public.expire_pending_match_payments(integer)
  from public, anon, authenticated;

revoke execute on function public.try_fill_match(uuid)
  from public, anon, authenticated;

revoke execute on function public.easycancha_watchdog()
  from public, anon, authenticated;

-- NO se tocan handle_new_user() ni claim_guest_slots_on_profile(): retornan
-- `trigger`, y PostgREST no expone ese tipo de funciones — llamarlas con la
-- anon key devuelve PGRST202 ("no encontrada en el schema cache"), verificado.
-- No hay ganancia de seguridad y revocarlas tocaria el camino de signup.
