# Design — <feature>

> Fase: **Construction**. El diseño lógico antes de codear. Aterrizado en nuestro stack
> (Next.js 16, Supabase + RLS, Wompi, notificaciones, EasyCancha).

## Enfoque elegido
La opción de diseño y **por qué** sobre las alternativas (recomendación de ingeniería).

## Modelo de datos
Tablas/columnas nuevas o modificadas (SQL). Por cada FK nuevo, verifica que **no rompa embeds
PostgREST** (un 2º FK a la misma tabla → HTTP 300; usa `tabla!fkey(...)` explícito).

```sql
-- migración propuesta
```

## RLS / seguridad
Políticas nuevas. ¿Quién puede leer/escribir? ¿El service-role (admin client) vs sesión de
usuario? Nunca exponer datos sensibles vía RLS de fila — filtrar columnas en la capa de servicio.

## Contratos / API
Schemas Zod (`types/contracts.ts`), rutas (`app/api/...`), tipos de dominio (`types/domain.ts`).
Mantén retro-compatibilidad cuando una ruta ya esté en uso.

## Flujos
Paso a paso de los caminos clave (incl. webhooks/async). Atomicidad y manejo de fallo.

## Mapa de impacto (archivo por archivo)
| Capa | Archivo | Cambio |
|------|---------|--------|

## Decisiones de diseño
Enlaza a `decision-log.md` las que sean difíciles de revertir.

## ⛒ Gate
- [ ] Diseño revisado (`architect`); riesgos de RLS/embeds/atomicidad considerados
- [ ] Aprobado por: __________  Fecha: __________
