# Tasks (unidades de trabajo) — <feature>

> Documento **vivo** a lo largo de Construction. Cada unidad ("bolt") es chica y verificable,
> y pasa su propio mini-ciclo: tests → implementar → verificar → revisar.

## Unidades

| # | Unidad | Depende de | Estado | Gate de Construction |
|---|--------|-----------|--------|----------------------|
| 1 | Migración + tipos | — | pending | tsc · tests · advisors |
| 2 | … | 1 | pending | tsc · tests · build · review |

Estados: `pending` → `in_progress` → `done`.

## Definition of Done (por unidad)
- [ ] `npx tsc --noEmit` limpio
- [ ] Tests verdes · cobertura ≥ 80% en la lógica nueva
- [ ] `next build` verde (si tocó rutas/componentes)
- [ ] `code-reviewer` (+ `security-reviewer` si toca auth/pagos/datos/inputs)
- [ ] Sin secretos hardcodeados · sin silent-catch · errores propagados
- [ ] Migración (si hay): aplicada en prod **y** commiteada · `get_advisors` limpio

## Notas / hallazgos
Bitácora breve de sorpresas durante la implementación (alimentan el `decision-log` y la memoria).
