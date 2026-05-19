import { ZodError } from "zod";

/** Normalizes unknown thrown values into a user-facing message. */
export function getErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado"): string {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    if (first) return first.message;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}
