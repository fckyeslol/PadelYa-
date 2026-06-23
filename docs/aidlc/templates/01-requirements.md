# Requirements — <feature>

> Fase: **Inception**. Qué debe hacer el sistema, con criterios verificables.
> Producto de la *mob elaboration* (la IA propone, el equipo converge).

## Resumen
1–2 frases enlazando con `00-intent.md`.

## Decisiones de producto fijadas
| # | Decisión | Elegido |
|---|----------|---------|
| D1 | … | … |

## Requisitos funcionales
- RF-1: …
- RF-2: …

## Invariantes / reglas de negocio
Condiciones que SIEMPRE deben cumplirse (numerar como INV-1…). Son la base de los tests.

- **INV-1:** …

## Escenarios (Gherkin)
```gherkin
# language: es
Característica: <…>
  Escenario: <camino feliz>
    Dado …
    Cuando …
    Entonces …
```
Cubre: camino feliz, autorización, límites, errores/atomicidad, privacidad, concurrencia.

## Requisitos no funcionales
Seguridad (RLS, validación de inputs), rendimiento, accesibilidad, observabilidad, costo.

## Riesgos y supuestos
- Riesgo: … → mitigación: …
- Supuesto: … (validar antes/durante)

## Fuera de alcance
Lista explícita.

## ⛒ Gate
- [ ] Criterios de aceptación verificables (Gherkin) e invariantes explícitas
- [ ] Riesgos/supuestos listados · preguntas abiertas cerradas
- [ ] Aprobado por: __________  Fecha: __________
