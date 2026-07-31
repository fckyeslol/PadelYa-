# Tarifario EasyCancha — último snapshot antes de eliminar el scraping

**Capturado:** 2026-07-30, desde `easycancha_slots` (18.932 filas, última captura viva **2026-07-15 01:20 UTC**).
**Por qué existe este archivo:** el scraping se eliminó (8 cuentas baneadas). Los precios pasaron a ser
estáticos en `config/venue-pricing-rules.ts`. Este es el último dato real observado y sirve de **línea base
para actualizar las reglas a mano**.

Los precios de abajo son **cancha cruda, sin comisión**. La tarifa por jugador es:

```
jugador = (cancha + COURT_MARKUP_COP) / 4      # COURT_MARKUP_COP = 22.500
```

Cada valor es el más reciente observado para ese club + tipo de día + hora. `weekday` = lunes a jueves.
La duración es el *timespan* nativo del club (90 min salvo Padel Park, que es 60).

> ⚠️ Estos números envejecen. Si un club cambia tarifas, `venue-pricing-rules.ts` queda desactualizado en
> silencio — no hay nada que lo detecte. Conviene revisarlo cada trimestre, o mover el precio al portal de
> sedes para que el club lo cargue.

---

## Padel Zenter del Río (club 1125 · 90 min)

| Día | Curva (hora=cancha COP) |
|---|---|
| weekday | 06:00–11:30=60.000 · 12:00=52.500 · 12:30=45.000 · 13:00–15:30=37.500 · 16:00–16:30=51.000 · 17:00=90.000 · 17:30–18:00=51.000 · 18:30–20:00=140.000 · 21:30=100.000 |
| friday | 06:00–11:30=60.000 · 12:00=52.500 · 12:30=45.000 · 13:00–15:30=37.500 · 17:00=90.000 · 18:30–20:00=140.000 · 21:30=100.000 |
| saturday | 06:00–10:30=81.000 · 11:00=66.500 · 11:30=52.000 · 12:00–15:30=37.500 · 16:00=42.000 · 16:30=46.500 · 17:00–20:00=51.000 |
| sunday | 08:00–10:30=75.000 · 11:00=70.000 · 11:30=65.000 · 12:00–15:30=60.000 · 16:00=65.000 · 16:30=70.000 · 17:00–19:00=51.000 · 19:30=65.000 · 20:00=60.000 |

## Padel Zenter La Arenosa (club 1475 · 90 min)

| Día | Curva |
|---|---|
| weekday | 06:00–07:30=72.000 · 08:00=70.000 · 08:30=68.000 · 09:00–11:30=66.000 · 12:00=56.500 · 12:30=47.000 · 13:00–15:30=37.500 · 16:00–16:30=51.000 · 17:00=100.000 · 17:30–18:00=51.000 · 18:30–20:00=140.000 · 21:30=100.000 |
| friday | igual a weekday |
| saturday | 06:00–10:30=81.000 · 11:00=66.500 · 11:30=52.000 · 12:00–15:30=37.500 · 16:00=50.000 · 16:30=46.500 · 17:00–17:30=75.000 · 18:00–20:00=51.000 |
| sunday | 08:00–10:30=81.000 · 11:00=74.000 · 11:30=67.000 · 12:00–15:30=60.000 · 16:00=57.000 · 16:30=54.000 · 17:00–20:00=51.000 |

## Pádel Park (club 1442 · **60 min**)

Esta es la curva que se congeló en `venue-pricing-rules.ts` — antes solo existía en vivo.

| Día | Curva |
|---|---|
| weekday | 05:00–15:00=50.000 · 15:30=67.000 · 16:00=84.000 · 16:30=97.000 · 17:00–20:30=110.000 · 21:00=95.000 · 21:30–22:00=80.000 |
| friday | 05:00–15:00=50.000 · 15:30=73.500 · 16:00–16:30=97.000 · 17:00–20:30=110.000 · 21:00=95.000 · 21:30–22:00=80.000 |
| saturday | 05:00=50.000 · 05:30=60.000 · 06:00–08:00=70.000 · 08:30=60.000 · 09:00–14:00=50.000 · 14:30=60.000 · 15:00=70.000 · 15:30=77.000 · 16:00=84.000 · 16:30=82.000 · 17:00–22:00=80.000 |
| sunday | 07:00–16:00=60.000 · 16:30=70.000 · 17:00–21:00=80.000 |

## La Jaula (club 1526 · 90 min)

| Día | Curva |
|---|---|
| weekday | 05:00–06:00=81.000 · 06:30–07:30=60.000 · 08:00–09:30=81.000 · 10:00=53.300 · 10:30=46.600 · 11:00–14:00=50.000 · 14:30=60.000 · 15:00=51.000 · 15:30=61.000 · 16:00=71.000 · 16:30–17:00=81.000 · 17:30=125.000 · 18:00–18:30=81.000 · 19:00=154.000 · 19:30=81.000 · 20:30=120.000 · 22:00=88.000 |
| friday | 05:00=50.000 · 05:30=53.000 · 06:00=56.000 · 06:30–09:30=60.000 · 10:00=53.300 · 10:30=46.600 · 14:00=57.000 · 14:30=54.000 · 15:00=51.000 · 15:30=61.000 · 16:00=71.000 · 16:30–17:00=81.000 · 17:30=125.000 · 19:00=154.000 · 20:30=120.000 · 22:00=88.000 |
| saturday | 05:00=50.000 · 05:30=60.000 · 06:00=70.000 · 06:30–09:30=81.000 · 11:00–14:00=50.000 · 14:30=60.000 · 15:00=70.000 · 15:30–19:30=81.000 |
| sunday | igual a saturday |

## X3 Pádel Club (club 1675 · 90 min)

| Día | Curva |
|---|---|
| weekday | 05:30=76.000 · 06:00–15:30=69.000 · 16:30=163.000 · 17:00–20:00=165.000 · 21:30=110.000 |
| friday | igual a weekday |
| saturday | 05:30–15:30=70.000 · 17:00–21:30=100.000 |
| sunday | 08:00–15:30=70.000 · 17:00–18:30=100.000 |

## Ace Padel Club (club 1866 · 90 min)

| Día | Curva |
|---|---|
| weekday | 05:00–05:30=50.000 · 06:00–11:30=75.000 · 12:00–14:30=50.000 · 15:00–15:30=75.000 · 16:00=125.000 · 16:30=145.000 · 17:00–20:00=165.000 · 20:30=150.000 · 21:00=135.000 · 21:30=120.000 |
| friday | igual a weekday |
| saturday | 05:00–05:30=50.000 · 06:00–06:30=70.000 · 07:00–12:00=80.000 · 12:30–16:30=75.000 · 17:00–21:30=120.000 |
| sunday | 07:00–11:30=80.000 · 12:00–16:30=75.000 · 17:00–20:30=120.000 |

---

**Casa Padel** no está acá: nunca se scrapeó (se reserva por ReservaDeportes) y tiene tarifa fija
en `config/pricing.ts` (`CASA_PADEL_COURT_COP` = 92.500).
