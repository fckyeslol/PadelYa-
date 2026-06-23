# Decision Log — <feature>

> Registro append-only de decisiones que son **difíciles de revertir** o que el dueño debe
> conocer: elecciones de diseño con trade-offs, acciones irreversibles (migración a prod, deploy,
> rotación de secretos, merge a `main`), y desvíos del plan.

| Fecha | Decisión | Alternativas descartadas | Por qué | Reversible? | Aprobó |
|-------|----------|--------------------------|---------|-------------|--------|
| YYYY-MM-DD | … | … | … | sí/no | … |

## Notas
- Una entrada por decisión, en orden cronológico.
- Para acciones irreversibles, anota el estado **antes** y **después** (p. ej. "migración X aplicada
  en prod 2026-06-22; commit abc123").
