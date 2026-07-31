/**
 * Endurecimiento del acceso al portal: freno de fuerza bruta en el login y cambio de
 * contraseña por la propia sede.
 *
 * El portal pasó a tener usuarios externos reales (los clubes), así que el login dejó de
 * ser ilimitado. El contador vive en la DB (`venue_login_attempts`) y no en memoria:
 * cada request serverless es un proceso distinto, un Map en memoria no frena nada.
 */
import { hashVenuePassword, verifyVenuePassword } from "@/lib/auth/venue-password";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/** Intentos fallidos tolerados dentro de la ventana antes de bloquear. */
export const MAX_FAILED_ATTEMPTS = 5;
export const WINDOW_MINUTES = 15;
const MIN_PASSWORD_LENGTH = 10;

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterMinutes: number };

function windowStartIso(): string {
  return new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
}

/**
 * ¿Puede este usuario intentar entrar?
 * Cuenta solo los fallos posteriores al último acierto: si acertó, el contador se reinicia
 * sin tener que borrar filas.
 */
export async function checkLoginRateLimit(username: string): Promise<RateLimitVerdict> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_login_attempts")
    .select("succeeded, attempted_at")
    .eq("username", username.trim())
    .gte("attempted_at", windowStartIso())
    .order("attempted_at", { ascending: false })
    .limit(50);

  if (error) {
    // Fail-open a propósito: un problema leyendo la tabla del freno no puede dejar
    // afuera a una sede legítima. Queda logueado para que se note.
    console.error("[venue-portal] no se pudo leer venue_login_attempts", { error });
    return { allowed: true };
  }

  const rows = data ?? [];
  const failuresSinceLastSuccess: { attempted_at: string }[] = [];
  for (const row of rows) {
    if (row.succeeded) break;
    failuresSinceLastSuccess.push({ attempted_at: row.attempted_at as string });
  }

  if (failuresSinceLastSuccess.length < MAX_FAILED_ATTEMPTS) return { allowed: true };

  const oldest = failuresSinceLastSuccess[failuresSinceLastSuccess.length - 1];
  const unlocksAt = new Date(oldest.attempted_at).getTime() + WINDOW_MINUTES * 60_000;
  const retryAfterMinutes = Math.max(1, Math.ceil((unlocksAt - Date.now()) / 60_000));
  return { allowed: false, retryAfterMinutes };
}

export async function recordLoginAttempt(username: string, succeeded: boolean): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("venue_login_attempts")
    .insert({ username: username.trim(), succeeded });

  if (error) {
    // No rompe el login, pero si esto falla el freno no cuenta: hay que verlo en los logs.
    console.error("[venue-portal] no se pudo registrar el intento de login", { error });
  }
}

/** Reglas de contraseña. Devuelve el problema en texto, o null si está bien. */
export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > 200) {
    return "La contraseña no puede superar los 200 caracteres.";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "La contraseña debe combinar letras y números.";
  }
  return null;
}

export type PasswordChangeResult = { ok: true } | { ok: false; error: string };

export async function changeVenuePassword(params: {
  accountId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<PasswordChangeResult> {
  const { accountId, currentPassword, newPassword } = params;

  const problem = validateNewPassword(newPassword);
  if (problem) return { ok: false, error: problem };

  if (currentPassword === newPassword) {
    return { ok: false, error: "La contraseña nueva tiene que ser distinta de la actual." };
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_accounts")
    .select("password_hash")
    .eq("id", accountId)
    .maybeSingle();

  if (error || !data) {
    console.error("[venue-portal] no se pudo leer la cuenta para cambiar contraseña", { error });
    return { ok: false, error: "No se pudo verificar tu cuenta. Intentá de nuevo." };
  }

  if (!verifyVenuePassword(currentPassword, data.password_hash as string)) {
    return { ok: false, error: "La contraseña actual no coincide." };
  }

  const { error: updateError } = await admin
    .from("venue_accounts")
    .update({
      password_hash: hashVenuePassword(newPassword),
      password_updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (updateError) {
    console.error("[venue-portal] no se pudo actualizar la contraseña", { updateError });
    return { ok: false, error: "No se pudo guardar la contraseña. Intentá de nuevo." };
  }

  return { ok: true };
}

/** true si la sede sigue con la contraseña que le sembramos a mano y nunca la cambió. */
export async function hasSeededPassword(accountId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("venue_accounts")
    .select("password_updated_at")
    .eq("id", accountId)
    .maybeSingle();
  return data ? data.password_updated_at == null : false;
}
