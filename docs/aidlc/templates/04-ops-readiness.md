# Ops Readiness — <feature>

> Fase: **Operations**. Checklist para desplegar de forma segura y reversible, y para operar.

## Pre-deploy
- [ ] Todas las unidades cerradas (gates de Construction ✅)
- [ ] Migraciones **aplicadas en prod Y commiteadas** (sin drift — ya causó un outage)
- [ ] `get_advisors` (security + performance) sin hallazgos nuevos por esta feature
- [ ] Variables de entorno / secretos necesarios presentes (Vercel **y** vault si aplica)
- [ ] Plantillas externas aprobadas si aplica (p. ej. WhatsApp/Meta)

## Deploy
- [ ] PR mergeado a `main` por el dueño (`main` está protegida)
- [ ] Deploy de Vercel verde

## Verificación post-deploy
- [ ] La feature funciona **en prod** (no solo en tests) — verificación manual del flujo clave
- [ ] Logs sin errores nuevos (Supabase API/postgres, app)

## Observabilidad / alertas
- [ ] ¿Hay un síntoma medible si esto se rompe en silencio? Si un secreto/credencial vive en 2
      lados, agrega un watchdog independiente (ver el de EasyCancha como patrón).
- [ ] Runbook: cómo detectar y recuperar.

## Rollback
- [ ] Plan de reversión (revert del PR, migración inversa, feature flag).

## Acciones irreversibles realizadas
Registrar en `decision-log.md` (migración a prod, rotación de secreto, etc.).
