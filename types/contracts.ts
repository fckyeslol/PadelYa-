import { z } from "zod";

export const createMatchSchema = z.object({
  venueName: z.string().min(3),
  scheduledAt: z.string().datetime(),
  joinDeadline: z.string().datetime(),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
  notes: z.string().max(500).optional(),
  orgFeeCop: z.number().int().positive().optional(),
  durationMinutes: z.union([z.literal(60), z.literal(90)]).default(90),
}).refine(
  (value) => new Date(value.joinDeadline).getTime() < new Date(value.scheduledAt).getTime(),
  { message: "joinDeadline must be before scheduledAt", path: ["joinDeadline"] },
);

export const checkoutSchema = z.object({
  matchId: z.string().uuid(),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
