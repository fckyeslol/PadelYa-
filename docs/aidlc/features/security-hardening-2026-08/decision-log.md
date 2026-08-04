# Decision Log — security hardening (advisors, agosto 2026)

> Registro append-only de decisiones que son **difíciles de revertir** o que el dueño debe
> conocer: elecciones de diseño con trade-offs, acciones irreversibles (migración a prod, deploy,
> rotación de secretos, merge a `main`), y desvíos del plan.

| Fecha | Decisión | Alternativas descartadas | Por qué | Reversible? | Aprobó |
|-------|----------|--------------------------|---------|-------------|--------|
| 2026-08-04 | Revocar `all` a `anon` y `authenticated` en las 6 tablas `venue_*` (migración `20260804110224`) | Dejarlo como estaba, confiando sólo en RLS; agregar policies restrictivas explícitas | `anon` tenía `arwdDxtm` (CRUD completo) sobre `venue_accounts`, que guarda `password_hash`. Sólo RLS lo frenaba: una policy permisiva futura o un `disable row level security` para depurar le devolvía escritura. Los 8 accessors usan `service_role`, así que revocar no rompe nada. No se agregan policies porque el portal entra sólo por rutas de servidor | sí (`grant`) | dueño (2026-08-04) |
| 2026-08-04 | **No** mover `pg_net` fuera de `public` pese al WARN del advisor | Aplicar `alter extension pg_net set schema extensions` | Sus funciones ya viven en el schema `net`, no en `public`, así que PostgREST no las expone — el warning es de registro, no de exposición. Mover la extensión arrastraría sus objetos y rompería los `net.http_post()` de `20260605030000_easycancha_cron` y `20260623010000_easycancha_watchdog`, que están activos | n/a (no se hizo) | — |
| 2026-08-04 | **No** revocar `EXECUTE` en `handle_new_user()` ni `claim_guest_slots_on_profile()` | Revocar a `public, anon, authenticated` como hizo `20260731000027` con las otras | Falsos positivos, confirmados con la anon key: ambas retornan `trigger` y PostgREST no expone ese tipo — el RPC devuelve `PGRST202`. Ya estaba documentado en `20260731000027`; esta pasada lo reverificó en vez de asumirlo. Revocar tocaría el camino de signup sin ganancia | n/a (no se hizo) | — |

## Notas

- Estado **antes** de `20260804110224` (ACL leído en prod): las seis tablas con
  `anon=arwdDxtm/postgres` y `authenticated=arwdDxtm/postgres`, RLS habilitada, cero policies.
- Estado **después**, verificado con las dos keys: `service_role` lee normal
  (`venue_accounts` 7, `venue_courts` 27, `venue_slot_blocks` 92); `anon` pasa de devolver
  0 filas en silencio a `42501 insufficient_privilege`. Dos capas independientes en vez de una.
- Migración aplicada vía Supabase MCP y commiteada en el mismo paso (lección #1: drift = outage).

## Pendiente, requiere acción en el dashboard

- **Leaked password protection** sigue desactivada (WARN del advisor). Es un toggle de Auth, no
  SQL, así que no se puede aplicar por migración:
  Dashboard → Authentication → Policies → *Leaked password protection*.
- Los 6 INFO de `rls_enabled_no_policy` van a seguir apareciendo: son el estado buscado para
  tablas server-only. No confundirlos con hallazgos nuevos al revisar el gate de Operations.
