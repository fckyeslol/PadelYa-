-- Quita los grants de tabla que `anon` y `authenticated` todavía tenían sobre
-- las 6 tablas del portal de sedes. Mismo patrón que 20260730235235 aplicó a
-- easycancha_ops_state.
--
-- Estado antes de esta migración (leído del ACL en prod, 2026-08-04):
--   anon=arwdDxtm/postgres  y  authenticated=arwdDxtm/postgres
-- o sea SELECT + INSERT + UPDATE + DELETE + TRUNCATE sobre las seis, entre ellas
-- venue_accounts, que guarda `password_hash` de cada sede.
--
-- Hoy lo único que lo frena es RLS: las seis tienen RLS habilitada y CERO
-- policies, así que anon y authenticated quedan denegados por defecto.
-- Verificado con la anon key: las cuatro tablas probadas devuelven 0 filas.
--
-- Eso funciona, pero deja la seguridad colgando de una sola condición. Si en el
-- futuro alguien agrega una policy permisiva pensando en un caso puntual, o hace
-- `disable row level security` para depurar, `anon` — cuya key viaja en el bundle
-- del browser — recupera escritura completa sobre los hashes de contraseña.
-- Revocar el grant hace que RLS y los privilegios tengan que fallar los dos.
--
-- Por qué es seguro revocar: los 8 accessors de estas tablas usan
-- getSupabaseAdminClient() (service_role, que conserva sus grants):
--   services/pricing/resolver.ts, services/venue-portal/{accounts,availability,
--   courts,pricing,schedule,security,slot-detail}.ts
-- La única función que las toca es replace_venue_price_rules(), SECURITY DEFINER
-- y sin EXECUTE para anon, así que corre como `postgres` y no depende de estos
-- grants.
--
-- No se agregan policies: sin policies el acceso queda denegado, que es
-- exactamente lo buscado — el portal entra por rutas de servidor, nunca desde el
-- cliente.
revoke all on table public.venue_accounts from anon, authenticated;
revoke all on table public.venue_courts from anon, authenticated;
revoke all on table public.venue_hours from anon, authenticated;
revoke all on table public.venue_login_attempts from anon, authenticated;
revoke all on table public.venue_price_rules from anon, authenticated;
revoke all on table public.venue_slot_blocks from anon, authenticated;
