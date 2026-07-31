/**
 * Utilidades compartidas para persistir authtokens de EasyCancha en la tabla
 * easycancha_accounts. Usa SUPABASE_SERVICE_ROLE_KEY (no depende del MCP).
 *
 * Lo consumen:
 *   - scripts/easycancha-set-token.ts    (guardar un token pegado a mano)
 *   - scripts/easycancha-manual-login.ts (captura interactiva vía navegador)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

export type Account = { id: number; email: string; password: string };

/** Carga .env.local sin pisar variables ya presentes en el entorno. */
export function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.slice(0, i);
      if (!process.env[key]) process.env[key] = t.slice(i + 1);
    }
  } catch {
    /* .env.local es opcional si las vars ya están en el entorno */
  }
}

/** exp del JWT en milisegundos, o null si no se puede decodificar. */
export function decodeJwtExpMs(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Lee las cuentas (email/password) desde EASYCANCHA_ACCOUNTS (JSON) o el fallback. */
export function loadAccounts(): Account[] {
  const json = process.env.EASYCANCHA_ACCOUNTS?.trim();
  if (json) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("EASYCANCHA_ACCOUNTS no es JSON válido.");
    }
    if (!Array.isArray(parsed)) throw new Error("EASYCANCHA_ACCOUNTS debe ser un array.");
    return parsed.map((a, idx) => {
      const obj = a as Record<string, unknown>;
      const id = Number(obj.id ?? idx + 1);
      const email = String(obj.email ?? "").trim();
      const password = String(obj.password ?? "").trim();
      if (!id || !email || !password) {
        throw new Error(`Cuenta inválida en EASYCANCHA_ACCOUNTS (índice ${idx}).`);
      }
      return { id, email, password };
    });
  }
  const email = process.env.EASYCANCHA_EMAIL?.trim();
  const password = process.env.EASYCANCHA_PASSWORD?.trim();
  if (email && password) return [{ id: 1, email, password }];
  throw new Error("Faltan credenciales: definí EASYCANCHA_ACCOUNTS (JSON) o EASYCANCHA_EMAIL/PASSWORD.");
}

/** Upsert de token + awsalb + expires_at (decodificado del JWT). Devuelve expMs. */
export async function upsertToken(
  supabase: SupabaseClient,
  id: number,
  token: string,
  awsalb: string | null,
): Promise<number | null> {
  const expMs = decodeJwtExpMs(token);
  const row: Record<string, unknown> = {
    id,
    token,
    expires_at: expMs ? new Date(expMs).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (awsalb) row.awsalb = awsalb;
  const { error } = await supabase.from("easycancha_accounts").upsert(row);
  if (error) throw new Error(`upsert cuenta ${id} falló: ${error.message}`);
  return expMs;
}
