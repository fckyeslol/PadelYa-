-- Cierra dos huecos de autorización detectados en producción (2026-07-30).
--
-- 1) claim_guest_slots(uuid, text) era ejecutable por `anon`.
--
--    La migración 20260622130000 ya intentaba cerrarlo con:
--        revoke execute on function public.claim_guest_slots(uuid, text)
--          from anon, authenticated;
--    pero eso es un NO-OP: Postgres concede EXECUTE a PUBLIC por defecto en
--    toda función nueva, y revocarle a un rol concreto no elimina el grant de
--    PUBLIC — el rol lo sigue heredando. El ACL en prod lo mostraba como
--    `{=X/postgres,...}`, donde `=X` es justamente PUBLIC.
--
--    Impacto: la función es SECURITY DEFINER (salta RLS) y recibe player_id y
--    phone como argumentos sueltos, sin validar auth.uid(). Cualquiera con la
--    anon key (va en el bundle del browser) podía llamar
--    /rest/v1/rpc/claim_guest_slots y transferir el cupo pagado de un invitado
--    a una cuenta arbitraria.
--
--    La función es server-only: su único llamador legítimo es el trigger
--    claim_guest_slots_on_profile(), que es SECURITY DEFINER y propiedad de
--    `postgres`, así que corre como `postgres` y no depende de estos grants.
revoke execute on function public.claim_guest_slots(uuid, text)
  from public, anon, authenticated;

-- 2) easycancha_ops_state estaba sin RLS y con grants a anon (SELECT + UPDATE),
--    o sea legible y modificable por cualquiera con la anon key.
--
--    Su único accessor es easycancha_watchdog(), SECURITY DEFINER propiedad de
--    `postgres`; como la tabla no tiene FORCE ROW LEVEL SECURITY, el dueño
--    salta RLS. service_role también la salta. Por eso no hace falta ninguna
--    policy: sin policies, anon y authenticated quedan denegados por defecto,
--    que es exactamente lo que queremos.
alter table public.easycancha_ops_state enable row level security;
revoke all on table public.easycancha_ops_state from anon, authenticated;
