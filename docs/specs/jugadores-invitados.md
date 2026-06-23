# Spec — Jugadores invitados (no registrados)

> Estado: **DRAFT / pendiente de aprobación**
> Autor: equipo PadelYa · Fecha: 2026-06-22
> Metodología: Spec-Driven Development (SDD) + Gherkin (BDD)

---

## 1. Resumen ejecutivo

Hoy, para ocupar un cupo en un partido, una persona **debe** registrarse en PadelYa
(crear cuenta Supabase Auth + perfil) y pagar su propio cupo vía Wompi. Esto genera
fricción: si alguien arma un partido con amigos que aún no usan la app, esos amigos
no pueden entrar sin registrarse.

Este feature permite que **un jugador ya pago** agregue a **uno o varios jugadores
no registrados** (solo nombre + teléfono) y **pague su parte** en un **único checkout
combinado**. El invitado no necesita cuenta, recibe un **WhatsApp** con los datos del
partido, y **puede reclamar su cupo más adelante** si decide registrarse con ese mismo
teléfono.

### Decisiones de producto fijadas (input del dueño)

| # | Decisión | Elegido |
|---|----------|---------|
| D1 | ¿Quién invita y cuándo? | **Cualquier jugador ya pago**, mientras haya cupo y antes del `join_deadline` |
| D2 | ¿Cómo se paga? | **Un solo checkout combinado** (cupo propio opcional + N invitados, en una transacción Wompi) |
| D3 | ¿Reclamar cupo? | **Sí** — el invitado puede vincular el cupo a su cuenta real al registrarse con el mismo teléfono |
| D4 | ¿Notificar al invitado? | **Sí** — WhatsApp al teléfono del invitado al confirmarse el pago |

---

## 2. Glosario

- **Invitado (guest):** persona ocupando un cupo sin cuenta de PadelYa. Identificada por
  `guest_name` + `guest_phone`. No tiene `auth.users` ni, inicialmente, `profiles`.
- **Anfitrión de cupo / pagador (payer):** jugador registrado y **pago** que agrega al
  invitado y cubre su `org_fee_cop`. Puede o no ser el host del partido.
- **Reclamo de cupo (claim):** proceso por el cual un invitado que se registra con el
  mismo teléfono "hereda" el cupo y su historial, convirtiéndose en jugador registrado.
- **Checkout combinado:** una única transacción Wompi que cubre varios cupos
  (`amount = N × org_fee_cop`).

---

## 3. Estado actual (lo que el código asume hoy)

Estos son los **bloqueadores reales** que el feature debe levantar. Referencias a archivos:

1. `match_players.player_id uuid NOT NULL REFERENCES profiles(id)` — FK dura, no admite
   invitados sin perfil. (`supabase/migrations/20260514153000_init_mvp.sql:54`)
2. `payments.player_id uuid NOT NULL REFERENCES profiles(id)` y la relación **1:1** entre
   `payments` y `match_players` (`payments.match_player_id`) — impide que **un** pago
   cubra **varios** cupos. (`init_mvp.sql`)
3. `payments.wompi_reference` es **UNIQUE** y es lo que se envía a Wompi: una referencia
   debe poder mapear a varios cupos para el checkout combinado.
   (`services/payments/service.ts:243-280`)
4. Reglas RLS escritas alrededor de `auth.uid()` — un invitado no tiene sesión.
5. `getActivePlayerPhones()` y `notifyMatchFull()` hacen join
   `match_players → profiles → phone`; un invitado no tendría perfil.
   (`services/notifications/whatsapp.ts`)
6. `PlayerSlots` ya tolera `profiles` nulo (`player.profiles?.full_name`), así que la UI
   degrada con gracia. (`components/match/PlayerSlots.tsx:18`)
7. El checkout actual asume **el pagador == el ocupante del cupo**
   (`reserveMatchPlayerForCheckout(... user.id ...)`, `service.ts:233`).

---

## 4. Modelo de datos propuesto (recomendación de ingeniería)

> Hay dos caminos para representar al invitado: **(A) perfil-sombra** (crear un
> `profiles`/`auth.users` fantasma) o **(B) columnas guest nullables**. Dado que
> `profiles.id` tiene FK dura a `auth.users(id)`, el camino A obliga a crear usuarios
> Auth fantasma (pesado y con riesgo de colisión en el claim). **Se recomienda (B).**

### 4.1 `match_players` — admitir cupos de invitado

```sql
ALTER TABLE public.match_players
  ALTER COLUMN player_id DROP NOT NULL,          -- ahora nullable: un guest no tiene perfil
  ADD COLUMN guest_name           text,
  ADD COLUMN guest_phone          text,          -- E.164, p.ej. +573001234567
  ADD COLUMN invited_by_player_id uuid REFERENCES public.profiles(id),
  ADD COLUMN claimed_at           timestamptz;   -- set cuando el guest reclama el cupo

-- Exactamente uno: o es jugador registrado, o es invitado con quién lo invitó.
ALTER TABLE public.match_players
  ADD CONSTRAINT match_players_player_or_guest_chk CHECK (
    (player_id IS NOT NULL AND guest_name IS NULL AND guest_phone IS NULL)
    OR
    (player_id IS NULL AND guest_name IS NOT NULL AND guest_phone IS NOT NULL
       AND invited_by_player_id IS NOT NULL)
  );

-- Evitar el mismo invitado dos veces en el mismo partido (entre cupos activos).
CREATE UNIQUE INDEX match_players_unique_active_guest
  ON public.match_players (match_id, guest_phone)
  WHERE player_id IS NULL AND status IN ('pending_payment', 'paid');
```

> El índice único parcial existente sobre `(match_id, player_id)` sigue válido para
> jugadores registrados (los guests tienen `player_id NULL` y no entran ahí).

### 4.2 Agrupar pagos: `payment_intents` (checkout combinado)

Para que **una** transacción Wompi cubra **varios** cupos, se introduce una tabla padre.
`payments` pasa a ser hijo (un row por cupo financiado).

```sql
CREATE TABLE public.payment_intents (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id             uuid NOT NULL REFERENCES public.matches(id),
  paid_by_player_id    uuid NOT NULL REFERENCES public.profiles(id),  -- quién paga
  amount_cop           integer NOT NULL,            -- total = N × org_fee_cop
  currency             text NOT NULL DEFAULT 'COP',
  provider             text NOT NULL DEFAULT 'wompi',
  wompi_reference      text UNIQUE,                 -- lo que se envía a Wompi
  wompi_transaction_id text UNIQUE,
  payment_method       text,
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','declined','voided','refunded')),
  idempotency_key      text NOT NULL UNIQUE,
  approved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments
  ADD COLUMN payment_intent_id uuid REFERENCES public.payment_intents(id),
  ALTER COLUMN player_id DROP NOT NULL;            -- el cupo de un guest no tiene player_id
```

- `payments` queda como **asignación** (allocation): un row por cupo financiado, con su
  `match_player_id` y `amount_cop = org_fee_cop`.
- El webhook ahora resuelve por `payment_intents.wompi_reference`, y al aprobar marca
  **todos** los `payments` hijos + sus `match_players` como pagos.

> **Migración de compatibilidad:** los pagos individuales actuales (un cupo) se modelan
> como un `payment_intent` con un solo `payments` hijo. El flujo de "unirse y pagar"
> existente se reescribe sobre `payment_intents` con `N = 1`.

### 4.3 Tipos de dominio (TypeScript)

```ts
// types/domain.ts
export interface MatchPlayer {
  id: string;
  matchId: string;
  playerId: string | null;          // null si es invitado
  isHost: boolean;
  status: MatchPlayerStatus;
  joinedAt: string;
  // nuevos
  guestName?: string | null;
  guestPhone?: string | null;
  invitedByPlayerId?: string | null;
  claimedAt?: string | null;
}

export interface PaymentIntent {
  id: string;
  matchId: string;
  paidByPlayerId: string;
  amountCop: number;
  currency: "COP";
  provider: "wompi";
  status: "pending" | "approved" | "declined" | "voided" | "refunded";
  wompiReference?: string | null;
  wompiTransactionId?: string | null;
  idempotencyKey: string;
  createdAt: string;
  approvedAt?: string | null;
}
```

---

## 5. Contratos de API (Zod)

```ts
// types/contracts.ts

const e164 = z.string().regex(/^\+?[1-9]\d{7,14}$/, "Teléfono inválido");

export const guestInviteSchema = z.object({
  name:  z.string().min(2).max(80),
  phone: e164,
});

// Checkout combinado: cupo propio (si aún no pagué) + invitados.
export const combinedCheckoutSchema = z.object({
  matchId:       z.string().uuid(),
  includeSelf:   z.boolean().default(false),     // pago también mi propio cupo
  guests:        z.array(guestInviteSchema).max(3).default([]),
}).refine(
  (v) => v.includeSelf || v.guests.length > 0,
  { message: "Debes pagar al menos un cupo" },
);

export type GuestInvite = z.infer<typeof guestInviteSchema>;
export type CombinedCheckoutInput = z.infer<typeof combinedCheckoutSchema>;
```

> Tope `max(3)` invitados porque `max_players = 4` y al menos un cupo lo ocupa el pagador
> o ya hay otros jugadores. La validación real de cupos disponibles ocurre en el server.

Endpoints:

- `POST /api/payments/checkout` — extendido para aceptar `CombinedCheckoutInput`
  (retro-compatible: `{ matchId, includeSelf: true, guests: [] }` == flujo actual).
- `POST /api/matches/:id/guests` _(opcional)_ — pre-reservar invitados sin pagar aún.
  **No requerido para MVP**: el invitado se crea dentro del checkout combinado.

---

## 6. Reglas de negocio e invariantes

1. **INV-1 (Pagador autorizado):** **el cupo se confirma (`paid`) únicamente cuando Wompi
   aprueba el pago** — antes de eso un cupo está `pending_payment`. Tres vías para poder
   agregar invitados (detalle en §6.1): **(a)** ser jugador `paid` en el partido;
   **(b)** incluir el cupo propio (`includeSelf=true`) en el mismo checkout combinado;
   **(c)** ser el **host** del partido (rol `player` u `organizer`), aun sin ocupar cupo.
   Un host jugador llega a `open` como `pending_payment`, así que su primera invitación
   típicamente usa (b); un host `organizer` invita por (c) sin ocupar cupo.
2. **INV-2 (Cupo disponible):** `paidCount + cuposEnEsteCheckout ≤ max_players` evaluado
   **en el servidor** al crear el intent. El conteo de "ocupados" incluye
   `pending_payment` recientes para evitar sobreventa.
3. **INV-3 (Ventana):** `now() < join_deadline` y `match.status = 'open'`.
4. **INV-4 (Sin duplicados):** no se puede invitar un `guest_phone` ya presente
   (activo) en el partido, ni invitar el teléfono de un jugador ya registrado en el match.
5. **INV-5 (Atomicidad de pago):** un `payment_intent` aprueba **todo o nada**. Si Wompi
   declina, ningún cupo del intent queda `paid`.
6. **INV-6 (Titularidad del reembolso):** el reembolso de un cupo de invitado va a quien
   pagó (`paid_by_player_id`), nunca al invitado.
7. **INV-7 (Claim por teléfono):** al registrarse, un usuario reclama cupos de invitado
   cuyo `guest_phone` coincida (normalizado E.164) y que no estén `cancelled`. Se setea
   `player_id = nuevo perfil`, `claimed_at = now()`, se limpian campos guest.
8. **INV-8 (Privacidad):** `guest_phone` no se expone en respuestas públicas; el roster
   solo muestra `guest_name` + "invitado por {nombre del pagador}".

### 6.1 Caso host con rol `organizer`

En `app/api/matches/[matchId]/open/route.ts:123-131`, un host con rol `organizer` **no
toma cupo de jugador y no paga el suyo** (`createCheckoutForMatch` se omite).

**Decisión fijada (input del dueño):** un host `organizer` **sí puede** agregar y pagar
invitados aunque él no ocupe cupo — actúa como **pagador puro**
(`payment_intents.paid_by_player_id` = su id) con `includeSelf=false`. INV-1 admite
entonces tres vías de autorización para invitar:

- **(a)** ser jugador con `status = 'paid'` en el partido;
- **(b)** incluir el cupo propio (`includeSelf=true`) en el mismo checkout combinado;
- **(c)** ser el **host** del partido (rol `player` u `organizer`), aun sin ocupar cupo.

---

## 7. Escenarios Gherkin

```gherkin
# language: es
Característica: Agregar jugadores no registrados a un partido y pagar su cupo
  Como jugador ya pago de un partido
  Quiero invitar a personas sin cuenta y pagar su parte
  Para llenar el partido sin obligarlas a registrarse

  Antecedentes:
    Dado un partido "P1" en "Pádel Park" con estado "open"
    Y la tarifa por cupo es 25000 COP
    Y el partido tiene 4 cupos y 1 cupo pago (el host "Mateo")
    Y "Mateo" es un jugador registrado con cupo "paid" en "P1"

  # ── D1 + D2: invitar y pagar (camino feliz) ──────────────────────────────
  Escenario: Un jugador pago agrega un invitado y paga su parte
    Dado que "Mateo" abre el detalle de "P1"
    Cuando agrega un invitado con nombre "Carlos" y teléfono "+573001112233"
    Y confirma el checkout combinado por 1 cupo
    Entonces se crea un payment_intent por 25000 COP a nombre de "Mateo"
    Y se crea un cupo de invitado "Carlos" con estado "pending_payment"
    Y el cupo de invitado tiene invited_by_player_id = "Mateo"
    Cuando Wompi confirma el pago como aprobado
    Entonces el cupo de "Carlos" pasa a "paid"
    Y "P1" tiene 2 cupos pagos

  Escenario: Pagar mi propio cupo y dos invitados en un solo checkout
    Dado un partido "P2" en estado "open" con 0 cupos pagos
    Y "Ana" es una jugadora registrada sin cupo en "P2"
    Cuando "Ana" agrega invitados "Beto (+573001112233)" y "Cira (+573004445566)"
    Y marca incluir su propio cupo
    Y confirma el checkout combinado
    Entonces el payment_intent es por 75000 COP (3 × 25000)
    Y se crean 3 cupos en "pending_payment": "Ana", "Beto", "Cira"
    Cuando Wompi confirma el pago como aprobado
    Entonces los 3 cupos pasan a "paid"
    Y "P2" tiene 3 cupos pagos

  # ── INV-1: autorización del pagador ──────────────────────────────────────
  Escenario: Un jugador sin cupo pago no puede invitar sin pagar el suyo
    Dado "Luis" es un jugador registrado sin cupo en "P1"
    Cuando "Luis" intenta agregar un invitado sin incluir su propio cupo
    Entonces el sistema rechaza la acción
    Y muestra "Primero debes unirte y pagar tu cupo"

  Escenario: Un host organizador paga invitados sin ocupar cupo propio
    Dado un partido "P3" en estado "open" con 0 cupos pagos
    Y "Sofía" es la host de "P3" con rol "organizer"
    Y "Sofía" no ocupa cupo de jugador en "P3"
    Cuando "Sofía" agrega invitados "Beto (+573001112233)" y "Cira (+573004445566)"
    Y NO marca incluir su propio cupo
    Y confirma el checkout combinado
    Entonces el payment_intent es por 50000 COP (2 × 25000) a nombre de "Sofía"
    Y se crean 2 cupos de invitado en "pending_payment": "Beto", "Cira"
    Y "Sofía" no aparece como jugador en el roster
    Cuando Wompi confirma el pago como aprobado
    Entonces "P3" tiene 2 cupos pagos

  # ── INV-2: cupos disponibles ─────────────────────────────────────────────
  Escenario: No se puede invitar si no hay cupos suficientes
    Dado "P1" ya tiene 3 cupos pagos
    Cuando "Mateo" intenta agregar 2 invitados
    Entonces el sistema rechaza la acción
    Y muestra "Solo queda 1 cupo disponible"

  # ── INV-4: duplicados ────────────────────────────────────────────────────
  Escenario: No se puede invitar dos veces el mismo teléfono
    Dado "P1" ya tiene un invitado "Carlos (+573001112233)" en estado "paid"
    Cuando "Mateo" intenta agregar otro invitado con teléfono "+573001112233"
    Entonces el sistema rechaza la acción
    Y muestra "Esa persona ya está en el partido"

  # ── INV-3: ventana de tiempo ─────────────────────────────────────────────
  Escenario: No se puede invitar después del cierre de inscripciones
    Dado que ya pasó el join_deadline de "P1"
    Cuando "Mateo" intenta agregar un invitado
    Entonces el sistema rechaza la acción
    Y muestra "Las inscripciones para este partido ya cerraron"

  # ── INV-5: atomicidad del pago combinado ─────────────────────────────────
  Escenario: Pago combinado declinado no confirma ningún cupo
    Dado "Mateo" creó un checkout combinado con invitados "Beto" y "Cira"
    Cuando Wompi reporta el pago como "declined"
    Entonces el payment_intent queda "declined"
    Y los cupos de "Beto" y "Cira" NO quedan "paid"
    Y esos cupos quedan liberados para otros jugadores

  # ── Llenar el partido con un invitado ────────────────────────────────────
  Escenario: El partido se llena al pagar el cupo de un invitado
    Dado "P1" tiene 3 cupos pagos
    Cuando "Mateo" agrega y paga 1 invitado "Carlos"
    Y Wompi confirma el pago
    Entonces "P1" pasa a estado "full"
    Y se dispara la notificación "partido_lleno"

  # ── D4: notificación al invitado ─────────────────────────────────────────
  Escenario: El invitado recibe WhatsApp al confirmarse su cupo
    Cuando se confirma el pago del cupo de invitado "Carlos (+573001112233)"
    Entonces se envía una plantilla de WhatsApp al "+573001112233"
    Y el mensaje incluye sede, fecha y quién lo invitó ("Mateo")

  # ── INV-6: reembolso ─────────────────────────────────────────────────────
  Escenario: Cancelar el cupo de un invitado reembolsa a quien pagó
    Dado "Mateo" pagó el cupo del invitado "Carlos" en "P1"
    Y aún no se alcanzó el join_deadline
    Cuando "Mateo" cancela el cupo de "Carlos"
    Entonces el cupo de "Carlos" pasa a "cancelled"
    Y el reembolso se emite a "Mateo", no a "Carlos"

  # ── D3: reclamar cupo ────────────────────────────────────────────────────
  Escenario: El invitado reclama su cupo al registrarse con el mismo teléfono
    Dado existe un cupo de invitado "Carlos (+573001112233)" en estado "paid"
    Cuando una persona se registra en PadelYa con el teléfono "+573001112233"
    Entonces el cupo de invitado se vincula a su nuevo perfil
    Y player_id deja de ser nulo y guest_name/guest_phone se limpian
    Y claimed_at queda registrado
    Y el partido aparece en su historial

  Escenario: Registro con teléfono que no coincide no reclama ningún cupo
    Dado existe un cupo de invitado "Carlos (+573001112233)"
    Cuando una persona se registra con el teléfono "+573009998877"
    Entonces no se vincula ningún cupo de invitado a su perfil

  # ── INV-8: privacidad / roster ───────────────────────────────────────────
  Escenario: El roster muestra al invitado sin exponer su teléfono
    Dado "Carlos (+573001112233)" es un invitado pago en "P1"
    Cuando cualquier usuario ve el detalle de "P1"
    Entonces ve "Carlos · invitado por Mateo"
    Y NO ve el teléfono del invitado
```

---

## 8. Flujos afectados (mapa de implementación)

| Capa | Archivo | Cambio |
|------|---------|--------|
| Migración | `supabase/migrations/<ts>_guest_players.sql` | columnas guest, `payment_intents`, índices, RLS, backfill compat |
| RLS | misma migración | políticas: insertar/cancelar cupo de invitado solo por pagador autorizado; lectura pública sin teléfono |
| Contratos | `types/contracts.ts` | `guestInviteSchema`, `combinedCheckoutSchema` |
| Dominio | `types/domain.ts` | `MatchPlayer` (campos guest), `PaymentIntent` |
| Pagos | `services/payments/service.ts` | `createCombinedCheckout()`; reescribir `reserveMatchPlayerForCheckout` para crear cupos guest; agrupar en `payment_intents` |
| Webhook | `app/api/webhooks/wompi/route.ts` + service | resolver por `payment_intents.wompi_reference`; aprobar N cupos atómicamente; `try_fill_match` |
| Checkout API | `app/api/payments/checkout/route.ts` | aceptar payload combinado (retro-compatible) |
| Claim | `supabase/migrations` trigger `handle_new_user` **o** server action post-registro | vincular cupos por `guest_phone` normalizado |
| Notif. | `services/notifications/whatsapp.ts` | nueva plantilla `invitado_agregado` (a aprobar en Meta); enviar a `guest_phone` directo |
| UI | `components/match/` (nuevo `AddGuestDialog.tsx`, ajustes en `PlayerSlots.tsx`, checkout) | formulario nombre+teléfono, resumen del total, etiqueta "invitado por X" |
| Cancelación | `services/matches/operations.ts` | `cancelGuestSpot()` con reembolso a `paid_by_player_id` |

---

## 9. Casos borde y preguntas abiertas

- **Normalización de teléfono:** definir util `normalizePhoneCO()` (asumir `+57` si faltan
  dígitos de país). El claim depende de comparación consistente. → _decisión: E.164 estricto
  en el input; normalizar al guardar._
- **Doble claim / carrera:** dos personas registrándose con el mismo teléfono. → el primero
  gana; `guest_phone` único activo por match lo limita a un cupo por partido.
- **Reembolso parcial de un intent combinado:** cancelar 1 de 3 cupos. Wompi no permite
  refund parcial trivial; → registrar refund a nivel `payments` hijo y manejar refund
  parcial con el proveedor (puede requerir fase 2).
- **Invitado que también es jugador activo en otro partido:** permitido; el claim solo
  vincula cupos por teléfono, no bloquea.
- **Plantilla Meta `invitado_agregado`:** requiere aprobación previa (ver
  `whatsapp-setup-state` en memoria del proyecto). Bloquea D4 hasta aprobación.
- **Host y estado `paid` — RESUELTO:** el host jugador queda `pending_payment` al pasar a
  `open` y solo es `paid` tras aprobar Wompi (`open/route.ts:127`). Su primera invitación
  va por `includeSelf=true`. El host `organizer` no paga cupo propio (ver §6.1). El cupo
  se confirma cuando se paga.

---

## 10. Fuera de alcance (MVP)

- Reembolsos parciales automáticos de un intent combinado (manejo manual en fase 1).
- Que un invitado invite a otros invitados (solo jugadores registrados y pagos invitan).
- Edición de datos del invitado después de creado (cancelar + recrear).
- Notificación de "te agregaron" antes de confirmar el pago (solo al aprobar).

---

## 11. Plan de implementación por fases (TDD)

**Fase 0 — Migración + tipos.** Schema, RLS, backfill de compat, `domain.ts`,
`contracts.ts`. Tests de migración (cupo guest válido/ inválido por CHECK).

**Fase 1 — Checkout combinado (sin UI).** `createCombinedCheckout()` + webhook que
aprueba N cupos. Tests unitarios: INV-1..INV-5, atomicidad, idempotencia.

**Fase 2 — UI invitar.** `AddGuestDialog`, resumen de total, `PlayerSlots` con etiqueta.
Tests de componente + E2E del camino feliz (Playwright).

**Fase 3 — Notificación WhatsApp.** Plantilla `invitado_agregado` (tras aprobación Meta),
envío a `guest_phone`. Test del disparo en el webhook.

**Fase 4 — Reclamo de cupo.** Vinculación por teléfono en el registro. Tests: claim ok,
claim sin match, doble claim.

**Fase 5 — Cancelación + reembolso al pagador.** `cancelGuestSpot()` con reembolso a
`paid_by_player_id`. Tests INV-6.

---

## 12. Criterios de aceptación (Definition of Done)

- [ ] Todos los escenarios Gherkin de §7 pasan como tests automatizados.
- [ ] Migración aplicada en prod sin romper el flujo de pago individual existente.
- [ ] Cobertura ≥ 80% en `services/payments` y la lógica de claim.
- [ ] `guest_phone` nunca aparece en payloads públicos (test de regresión de privacidad).
- [ ] Plantilla WhatsApp aprobada por Meta y verificada en sandbox.
- [ ] Revisión de seguridad: RLS impide que un no-pagador cree/cancele cupos de invitado.
```
