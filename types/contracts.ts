import { z } from "zod";

export const createMatchSchema = z.object({
  venueName: z.string().min(3),
  scheduledAt: z.string().datetime(),
  joinDeadline: z.string().datetime(),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
  notes: z.string().max(500).optional(),
  orgFeeCop: z.number().int().positive().optional(),
  durationMinutes: z.union([z.literal(60), z.literal(90), z.literal(120)]).default(90),
}).refine(
  (value) => new Date(value.joinDeadline).getTime() < new Date(value.scheduledAt).getTime(),
  { message: "joinDeadline must be before scheduledAt", path: ["joinDeadline"] },
);

export const checkoutSchema = z.object({
  matchId: z.string().uuid(),
});

// ── Guest players (non-registered invitees) ───────────────────────────────
// See docs/specs/jugadores-invitados.md

/** E.164 phone, e.g. +573001234567. Normalized to E.164 before storing. */
const e164Phone = z.string().regex(/^\+?[1-9]\d{7,14}$/, "Teléfono inválido");

export const guestInviteSchema = z.object({
  name: z.string().min(2).max(80),
  phone: e164Phone,
});

/**
 * Combined checkout: optionally the payer's own slot + N guest slots, all
 * settled in a single Wompi transaction (amount = N * org_fee_cop).
 * Backward-compatible with the individual flow via { includeSelf: true, guests: [] }.
 */
export const combinedCheckoutSchema = z
  .object({
    matchId: z.string().uuid(),
    includeSelf: z.boolean().default(false),
    guests: z.array(guestInviteSchema).max(3).default([]),
  })
  .refine((value) => value.includeSelf || value.guests.length > 0, {
    message: "Debes pagar al menos un cupo",
    path: ["guests"],
  });

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type GuestInvite = z.infer<typeof guestInviteSchema>;
export type CombinedCheckoutInput = z.infer<typeof combinedCheckoutSchema>;
