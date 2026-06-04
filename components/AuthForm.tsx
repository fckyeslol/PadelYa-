"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { getClientAuthCallbackUrl } from "@/utils/auth-url";

type Mode = "login" | "signup" | "forgot";

/** Normaliza un celular colombiano a E.164 sin "+": 573001234567. Null si inválido. */
function normalizeCoPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return digits;
  return null;
}

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirma tu correo primero. Revisa tu bandeja de entrada.";
  }
  if (lower.includes("user already registered")) {
    return "Ya existe una cuenta con ese correo. Intenta ingresar.";
  }
  if (lower.includes("password should be") || lower.includes("least 6") || lower.includes("least 8")) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Demasiados intentos. Espera unos minutos.";
  }
  if (lower.includes("invalid") && lower.includes("email")) {
    return "Correo no válido. Revisa que esté bien escrito.";
  }
  if (lower.includes("signup") && lower.includes("disabled")) {
    return "El registro está deshabilitado. Contacta al administrador.";
  }
  return message;
}

export function AuthForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [wantsNotifications, setWantsNotifications] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setError(null);
    setSuccessMsg(null);
    if (newMode !== mode) setPassword("");
  }

  function handleLogin() {
    startTransition(async () => {
      setError(null);
      const { error: authError } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) {
        setError(mapAuthError(authError.message));
        return;
      }
      router.push(next ?? "/matches");
      router.refresh();
    });
  }

  function handleSignup() {
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    const normalizedPhone = normalizeCoPhone(phone);
    if (!normalizedPhone) {
      setError("Ingresa un celular colombiano válido (10 dígitos, ej. 300 123 4567).");
      return;
    }
    startTransition(async () => {
      setError(null);
      const callbackUrl = getClientAuthCallbackUrl(next);
      const { error: authError } = await getSupabaseBrowserClient().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: callbackUrl,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: normalizedPhone,
            wants_match_notifications: wantsNotifications,
          },
        },
      });
      if (authError) {
        setError(mapAuthError(authError.message));
        return;
      }
      setSignupDone(true);
    });
  }

  function handleForgot() {
    startTransition(async () => {
      setError(null);
      setSuccessMsg(null);
      // Pass next=/auth/update-password so the callback knows this is a recovery flow.
      // PKCE doesn't include type=recovery in the redirect, so we rely on the next param.
      const callbackUrl = getClientAuthCallbackUrl("/auth/update-password");
      const redirectTo =
        callbackUrl ??
        (typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=%2Fauth%2Fupdate-password`
          : "/auth/callback?next=%2Fauth%2Fupdate-password");

      const { error: authError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo },
      );
      if (authError) {
        setError(mapAuthError(authError.message));
        return;
      }
      setSuccessMsg(
        "Si ese correo está registrado, recibirás un enlace para crear una nueva contraseña.",
      );
    });
  }

  // ── Post-signup: "check your email" state ───────────────────────────────────
  if (signupDone) {
    return (
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          padding: "2.5rem",
          textAlign: "center",
          maxWidth: "420px",
          width: "100%",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "rgba(233,255,71,0.08)",
            border: "1px solid rgba(233,255,71,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary)",
            margin: "0 auto 1.25rem",
          }}
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>

        <h2
          style={{
            fontFamily: "var(--font-montserrat)",
            fontWeight: 700,
            fontSize: "1.25rem",
            color: "var(--text)",
            marginBottom: "0.5rem",
          }}
        >
          Confirma tu correo
        </h2>
        <p style={{ color: "var(--text-2)", fontSize: "0.9rem", lineHeight: 1.6 }}>
          Hola{" "}
          <strong style={{ color: "var(--text)" }}>{firstName}</strong>, te enviamos un enlace de
          confirmación a{" "}
          <strong style={{ color: "var(--text)" }}>{email}</strong>. Haz clic en él para activar
          tu cuenta.
        </p>
        <p style={{ color: "var(--text-3)", fontSize: "0.8rem", marginTop: "0.6rem", lineHeight: 1.5 }}>
          ¿No lo ves? Revisa la carpeta de spam.
        </p>
        <button
          onClick={() => {
            setSignupDone(false);
            setPassword("");
          }}
          style={{
            marginTop: "1.5rem",
            color: "var(--text-3)",
            fontSize: "0.82rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Usar otro correo
        </button>
      </div>
    );
  }

  const canLogin = email.trim().length > 0 && password.length >= 1 && !pending;
  const canSignup =
    email.trim().length > 0 &&
    password.length >= 8 &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    normalizeCoPhone(phone) !== null &&
    !pending;
  const canForgot = email.trim().length > 0 && !pending;

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "20px",
        padding: "2.5rem",
        maxWidth: "420px",
        width: "100%",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "1.75rem" }}>
        {mode === "forgot" ? (
          <>
            <button
              onClick={() => switchMode("login")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                color: "var(--text-3)",
                fontSize: "0.82rem",
                background: "none",
                border: "none",
                cursor: "pointer",
                marginBottom: "1.25rem",
                padding: 0,
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              ← Volver
            </button>
            <h1
              style={{
                fontFamily: "var(--font-montserrat)",
                fontWeight: 800,
                fontSize: "1.75rem",
                letterSpacing: "-0.025em",
                color: "var(--text)",
                marginBottom: "0.5rem",
              }}
            >
              Restablecer contraseña
            </h1>
            <p style={{ color: "var(--text-2)", fontSize: "0.88rem", lineHeight: 1.5 }}>
              Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
            </p>
          </>
        ) : (
          <>
            <h1
              style={{
                fontFamily: "var(--font-montserrat)",
                fontWeight: 800,
                fontSize: "1.75rem",
                letterSpacing: "-0.025em",
                color: "var(--text)",
                marginBottom: "1.25rem",
              }}
            >
              PadelYa!
            </h1>
            {/* Mode tab switcher */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "rgba(255,255,255,0.04)",
                borderRadius: "12px",
                padding: "3px",
                gap: "3px",
              }}
            >
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "9px",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    transition: "background 0.15s, color 0.15s",
                    background:
                      mode === m ? "rgba(255,255,255,0.09)" : "transparent",
                    color: mode === m ? "var(--text)" : "var(--text-3)",
                  }}
                >
                  {m === "login" ? "Ingresar" : "Crear cuenta"}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Form fields ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {mode === "signup" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
            <div>
              <label htmlFor="auth-first-name" style={labelStyle}>
                Nombre
              </label>
              <input
                id="auth-first-name"
                type="text"
                placeholder="Mateo"
                className="input-base"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div>
              <label htmlFor="auth-last-name" style={labelStyle}>
                Apellido
              </label>
              <input
                id="auth-last-name"
                type="text"
                placeholder="Pirela"
                className="input-base"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="auth-email" style={labelStyle}>
            Correo electrónico
          </label>
          <input
            id="auth-email"
            type="email"
            placeholder="tu@correo.com"
            className="input-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && mode === "forgot" && canForgot) handleForgot();
            }}
            autoComplete="email"
          />
        </div>

        {mode === "signup" && (
          <div>
            <label htmlFor="auth-phone" style={labelStyle}>
              Celular (WhatsApp)
            </label>
            <input
              id="auth-phone"
              type="tel"
              inputMode="numeric"
              placeholder="300 123 4567"
              className="input-base"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-3)",
                marginTop: "0.3rem",
                fontFamily: "var(--font-dm-sans)",
                lineHeight: 1.4,
              }}
            >
              Te avisamos por WhatsApp cuando alguien se una y cuando tu partido se complete.
            </p>
          </div>
        )}

        {mode !== "forgot" && (
          <div>
            <label htmlFor="auth-password" style={labelStyle}>
              Contraseña
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "signup" ? "Mínimo 8 caracteres" : "Tu contraseña"}
                className="input-base"
                style={{ paddingRight: "2.75rem" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (mode === "login" && canLogin) handleLogin();
                    if (mode === "signup" && canSignup) handleSignup();
                  }
                }}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-3)",
                  display: "flex",
                  alignItems: "center",
                  padding: "0.25rem",
                }}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {mode === "signup" && password.length > 0 && password.length < 8 && (
              <p
                style={{
                  color: "var(--danger)",
                  fontSize: "0.75rem",
                  marginTop: "0.35rem",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                Mínimo 8 caracteres ({password.length}/8)
              </p>
            )}
          </div>
        )}

        {/* WhatsApp opt-in (signup only) */}
        {mode === "signup" && (
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.55rem",
              cursor: "pointer",
              marginTop: "0.1rem",
            }}
          >
            <input
              type="checkbox"
              checked={wantsNotifications}
              onChange={(e) => setWantsNotifications(e.target.checked)}
              style={{
                marginTop: "0.15rem",
                accentColor: "var(--primary)",
                width: "16px",
                height: "16px",
                flexShrink: 0,
                cursor: "pointer",
              }}
            />
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--text-2)",
                fontFamily: "var(--font-dm-sans)",
                lineHeight: 1.45,
              }}
            >
              Quiero recibir avisos de nuevos partidos por WhatsApp
            </span>
          </label>
        )}

        {/* Forgot password link (login mode only) */}
        {mode === "login" && !successMsg && (
          <div style={{ textAlign: "right", marginTop: "-0.25rem" }}>
            <button
              onClick={() => switchMode("forgot")}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-3)",
                fontSize: "0.78rem",
                cursor: "pointer",
                fontFamily: "var(--font-dm-sans)",
                padding: 0,
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        )}

        {/* Success message (forgot flow) */}
        {successMsg && (
          <p
            style={{
              background: "rgba(233,255,71,0.06)",
              border: "1px solid rgba(233,255,71,0.18)",
              borderRadius: "8px",
              padding: "0.6rem 0.875rem",
              color: "var(--primary)",
              fontSize: "0.82rem",
              lineHeight: 1.5,
            }}
          >
            {successMsg}
          </p>
        )}

        {/* Error message */}
        {error && (
          <p
            style={{
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: "8px",
              padding: "0.6rem 0.875rem",
              color: "var(--danger)",
              fontSize: "0.82rem",
            }}
          >
            {error}
          </p>
        )}

        {/* Submit button */}
        {!successMsg && (
          <Button
            disabled={
              mode === "login" ? !canLogin : mode === "signup" ? !canSignup : !canForgot
            }
            onClick={
              mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleForgot
            }
            size="lg"
            style={{ width: "100%", marginTop: "0.25rem" }}
          >
            {pending ? (
              <>
                <SpinnerIcon /> Procesando...
              </>
            ) : mode === "login" ? (
              "Ingresar →"
            ) : mode === "signup" ? (
              "Crear cuenta →"
            ) : (
              "Enviar enlace →"
            )}
          </Button>
        )}
      </div>

      <p
        style={{
          marginTop: "1.5rem",
          color: "var(--text-3)",
          fontSize: "0.78rem",
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        Al ingresar aceptas los{" "}
        <Link href="/terms" style={{ color: "var(--text-2)", textDecoration: "underline" }}>
          términos de servicio
        </Link>{" "}
        y la{" "}
        <Link href="/privacy" style={{ color: "var(--text-2)", textDecoration: "underline" }}>
          política de privacidad
        </Link>
        .
      </p>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 500,
  color: "var(--text-2)",
  marginBottom: "0.4rem",
  fontFamily: "var(--font-dm-sans)",
};

// ── Icons ──────────────────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
