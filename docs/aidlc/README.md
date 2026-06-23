# AIDLC — AI-Driven Development Lifecycle (PadelYa)

Adaptación del **AWS AI-Driven Development Lifecycle (AI-DLC)** a este repo y a Claude Code.
Define **cómo** pasamos de una idea a software en producción: la IA hace el trabajo pesado,
el humano **dirige en las compuertas** (gates), y trabajamos en **unidades chicas y verificables**.

> Esto NO es la metodología en abstracto: está aterrizada en nuestro stack (Next.js 16,
> Supabase + RLS, Wompi, WhatsApp/Resend, scraping EasyCancha) y en nuestras convenciones
> (specs en `docs/specs/`, agentes ECC, TDD 80%, ramas + PR porque `main` está protegida).

---

## Principios

1. **El humano dirige en las compuertas.** La IA propone; en cada gate el dueño aprueba,
   ajusta o rechaza. Nunca se cruza un gate sin aprobación explícita.
2. **Intent primero.** Todo arranca de una intención de negocio clara, no de una tarea técnica.
3. **Unidades chicas (bolts).** Se entrega en incrementos pequeños y verificables, no en un
   big-bang. Cada unidad pasa por su propio mini-ciclo design→code→verify.
4. **Preguntar antes de actuar.** Ante ambigüedad que cambia el resultado, se pregunta
   (clarifying questions / mob elaboration), no se adivina.
5. **Verificación continua.** `tsc`, tests, `next build`, advisors de Supabase y revisión por
   agentes son parte del flujo, no un paso final opcional.
6. **Reversibilidad y trazabilidad.** Cambios difíciles de revertir (migraciones a prod, deploys,
   rotación de secretos) se confirman y se registran en el `decision-log`.

---

## Las tres fases

Cada fase produce **artefactos** (plantillas en [`templates/`](templates/)), usa **agentes**
específicos, y termina en una **compuerta** con criterios de salida.

### 1. Inception — de la intención al plan
**Objetivo:** convertir una intención de negocio en requisitos acordados y un plan de unidades.

- **Actividades:** clarificar el intent; *mob elaboration* de requisitos y escenarios (Gherkin);
  identificar riesgos, supuestos e invariantes; descomponer en unidades de trabajo.
- **Artefactos:** `00-intent.md`, `01-requirements.md`, `03-tasks.md` (borrador inicial).
- **Agentes:** `planner` (descomposición), `architect` (viabilidad técnica temprana).
- **⛒ Gate de Inception (el dueño aprueba):**
  - [ ] El intent y el problema están claros y acotados.
  - [ ] Requisitos con criterios de aceptación (idealmente Gherkin) e invariantes explícitas.
  - [ ] Riesgos/supuestos listados; preguntas abiertas resueltas o marcadas.
  - [ ] Lista de unidades (bolts) con orden y dependencias.

### 2. Construction — del plan al software
**Objetivo:** convertir cada unidad en software funcionando y verificado.

- **Actividades:** diseño lógico (datos, contratos, RLS, flujos); por unidad: tests primero (TDD),
  implementación mínima, refactor; verificación.
- **Artefactos:** `02-design.md`, `03-tasks.md` (vivo), `decision-log.md`.
- **Agentes:** `architect` (diseño), `tdd-guide` (tests-first), `code-reviewer` +
  `security-reviewer` (revisión), `build-error-resolver` (build verde).
- **⛒ Gate de Construction (por unidad, antes de mergear):**
  - [ ] `npx tsc --noEmit` limpio · tests verdes · cobertura ≥ 80% en la lógica nueva.
  - [ ] `next build` verde (si tocó rutas/componentes).
  - [ ] Revisión de `code-reviewer` y, si toca auth/pagos/datos/inputs, `security-reviewer`.
  - [ ] Migraciones: validadas; RLS revisada; `get_advisors` sin hallazgos nuevos.
  - [ ] Sin secretos hardcodeados; errores manejados (no silent-catch — ver Lecciones).

### 3. Operations — a producción y operación
**Objetivo:** desplegar, observar y operar de forma segura y reversible.

- **Actividades:** aplicar migraciones, deploy, verificación en prod, observabilidad, runbooks.
- **Artefactos:** `04-ops-readiness.md`, `decision-log.md` (acciones irreversibles).
- **Agentes:** `e2e-runner` (flujos críticos), `doc-updater` (docs/codemaps).
- **⛒ Gate de Operations (el dueño aprueba el deploy):**
  - [ ] Migración **aplicada en prod Y commiteada** en el repo (la divergencia ya causó un
        outage — ver Lecciones).
  - [ ] PR mergeado a `main` (el merge a `main` lo hace el dueño; ver `git-workflow`).
  - [ ] Verificación post-deploy (la feature funciona en prod, no solo en tests).
  - [ ] Alertas/monitoreo donde aplique; `decision-log` actualizado.

---

## Mapa de agentes (reglas ECC globales)

| Fase | Agentes |
|------|---------|
| Inception | `planner`, `architect` |
| Construction | `architect`, `tdd-guide`, `code-reviewer`, `security-reviewer`, `build-error-resolver` |
| Operations | `e2e-runner`, `doc-updater`, `refactor-cleaner` |

Lanza agentes independientes en paralelo cuando el trabajo no tenga dependencias.

---

## Estructura y cómo arrancar una feature

```
docs/aidlc/
├── README.md            ← este archivo (el flujo)
├── templates/           ← plantillas por fase (copiar, no editar in situ)
│   ├── 00-intent.md
│   ├── 01-requirements.md
│   ├── 02-design.md
│   ├── 03-tasks.md
│   ├── 04-ops-readiness.md
│   └── decision-log.md
└── features/
    ├── README.md        ← convención: una carpeta por unidad de trabajo
    └── <slug>/          ← artefactos reales de cada feature
```

**Para iniciar una feature nueva:**
1. Crea `docs/aidlc/features/<slug>/` y copia ahí las plantillas que apliquen.
2. Llena `00-intent.md` → corre el **gate de Inception** con el dueño.
3. Avanza fase por fase, cruzando cada gate con aprobación explícita.

> El spec de **[jugadores invitados](../specs/jugadores-invitados.md)** es un ejemplo real de
> artefactos de Inception/Construction (requirements + design + Gherkin + plan) ya en el repo.
> AIDLC formaliza ese mismo rigor como proceso repetible.

---

## Relación con lo que ya existe

- **`docs/specs/`** sigue siendo válido para specs SDD; en AIDLC, esos contenidos viven como
  `01-requirements.md` + `02-design.md` de una feature (puedes enlazar en vez de duplicar).
- **Tests** (`tests/`, vitest) y la barra de 80% son el gate de Construction.
- **Git** (`git-workflow`): ramas + PR; `main` está protegida — el merge lo hace el dueño.
- **Migraciones**: se aplican a prod vía Supabase MCP **y** se commitean como archivo en
  `supabase/migrations/` (ver Lecciones).

---

## Lecciones operativas del proyecto (el flujo DEBE respetarlas)

Estos son fallos reales que ya nos costaron; los gates de arriba los previenen:

1. **Drift de migraciones = outage.** Una migración aplicada en prod pero NO commiteada (o al
   revés) ya tumbó el login. Regla: aplicar **y** commitear, siempre juntos.
2. **Silent-catch oculta la causa raíz.** Un `catch` genérico mostró "Supabase is not configured"
   cuando el error real era otro (los errores de PostgREST son objetos, no `Error`). No tragues
   errores; propaga o loguea con contexto.
3. **Embeds PostgREST ambiguos.** Agregar un 2º FK a la misma tabla rompe `tabla(...)` con HTTP
   300. Usa hints explícitos: `profiles!fkey_name(...)`.
4. **Secretos duplicados se desincronizan en silencio.** El secreto del cron vivía en Vercel y en
   el vault; uno cambió y el scraping cayó 3 días sin alerta. Cuando un secreto vive en 2 lados,
   agrega un watchdog independiente que detecte el síntoma.
5. **Acciones irreversibles se confirman.** Migraciones a prod, deploys, rotación de secretos y
   merges a `main` requieren aprobación del dueño y entran al `decision-log`.
