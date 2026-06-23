# Features (unidades de trabajo AIDLC)

Una carpeta por feature/unidad: `docs/aidlc/features/<slug>/`.

Dentro, copia desde [`../templates/`](../templates/) solo los artefactos que apliquen y llénalos
fase por fase, cruzando cada **gate** con aprobación del dueño:

```
features/<slug>/
├── 00-intent.md          # Inception
├── 01-requirements.md    # Inception
├── 02-design.md          # Construction
├── 03-tasks.md           # Construction (vivo)
├── 04-ops-readiness.md   # Operations
└── decision-log.md       # transversal (acciones irreversibles)
```

Convenciones:
- `<slug>` en kebab-case, en español, descriptivo (p. ej. `jugadores-invitados`).
- Specs SDD existentes en `docs/specs/` pueden **enlazarse** desde `01`/`02` en vez de duplicarse.
- Al cerrar la feature, registra lo no-obvio en la memoria del proyecto (no lo que el repo ya
  documenta).

> Ejemplo real de referencia: el rigor de [`docs/specs/jugadores-invitados.md`](../../specs/jugadores-invitados.md)
> (intent + requirements + Gherkin + design + plan) es el estándar que AIDLC vuelve repetible.
