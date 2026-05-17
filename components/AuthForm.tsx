"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  }
  if (lower.includes("signup") && lower.includes("disabled")) {
    return "El registro está deshabilitado en el servidor. Contacta al administrador.";
  }
  if (lower.includes("redirect") || lower.includes("url")) {
    return "La URL de retorno no está autorizada. Revisa la configuración de Supabase.";
  }
  if (lower.includes("invalid") && lower.includes("email")) {
    return "Correo no válido. Revisa que esté bien escrito.";
  }
  if (lower.includes("confirmation email") || lower.includes("sending email")) {
    return "No pudimos enviar el correo de acceso. Reintenta en unos minutos o contacta soporte si persiste.";
  }
  return message;
}

async function requestMagicLink(input: {
  email: string;
  firstName: string;
  lastName: string;
  next?: string;
}): Promise<{ ok: true } | { ok: false; error: string; fallback?: boolean }> {
  const response = await fetch("/api/auth/magic-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    fallback?: boolean;
  };

  if (response.ok) {
    return { ok: true };
  }

  if (response.status === 503 && payload.fallback) {
    return { ok: false, error: "", fallback: true };
  }

  return {
    ok: false,
    error: payload.error ?? "No pudimos enviar el correo. Intenta de nuevo.",
  };
}

export function AuthForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string | null;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(initialError ?? null);
  const [sent, setSent] = useState(false);

  const canSubmit = email && firstName && lastName && !pending;

  function signInWithMagicLink() {
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const callbackUrl = typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`
        : undefined;

      const normalizedEmail = email.trim().toLowerCase();
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();

      const viaResend = await requestMagicLink({
        email: normalizedEmail,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        next,
      });

      if (viaResend.ok) {
        setEmail(normalizedEmail);
        setSent(true);
        setMessage(null);
        return;
      }

      if (!viaResend.fallback) {
        setMessage(mapAuthError(viaResend.error));
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: callbackUrl,
          data: {
            first_name: trimmedFirst,
            last_name: trimmedLast,
          },
        },
      });

      if (error) {
        setMessage(mapAuthError(error.message));
        return;
      }

      setEmail(normalizedEmail);

      setSent(true);
      setMessage(null);
    });
  }

  if (sent) {
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
            background: "var(--primary-muted)",
            border: "1px solid rgba(30,58,110,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary)",
            margin: "0 auto 1.25rem",
          }}
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h2
          style={{
            fontFamily: "var(--font-syne)",
            fontWeight: 700,
            fontSize: "1.25rem",
            color: "var(--text)",
            marginBottom: "0.5rem",
          }}
        >
          Revisa tu correo
        </h2>
        <p style={{ color: "var(--text-2)", fontSize: "0.9rem", lineHeight: 1.6 }}>
          Hola <strong style={{ color: "var(--text)" }}>{firstName}</strong>, te enviamos un
          link a <strong style={{ color: "var(--text)" }}>{email}</strong>.
          Haz clic en él para ingresar a PadelYa!
        </p>
        <button
          onClick={() => { setSent(false); setEmail(""); setFirstName(""); setLastName(""); }}
          style={{
            marginTop: "1.5rem",
            color: "var(--text-3)",
            fontSize: "0.82rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-dm-sans)",
          }}
          className="hover:text-[var(--text-2)]"
        >
          Usar otro correo
        </button>
      </div>
    );
  }

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
      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "var(--primary-muted)",
            border: "1px solid rgba(30,58,110,0.2)",
            borderRadius: "999px",
            padding: "0.25rem 0.75rem",
            marginBottom: "1rem",
          }}
        >
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--primary)", flexShrink: 0, display: "block" }} />
          <span style={{ color: "var(--primary)", fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>
            Sin contraseña
          </span>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-syne)",
            fontWeight: 800,
            fontSize: "1.75rem",
            letterSpacing: "-0.025em",
            color: "var(--text)",
            marginBottom: "0.5rem",
          }}
        >
          Entrar a PadelYa!
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: "0.9rem", lineHeight: 1.5 }}>
          Ingresa tu nombre y correo. Te enviamos un link mágico.
        </p>
      </div>

      {/* Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {/* Name row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
          <div>
            <label
              htmlFor="auth-first-name"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "var(--text-2)",
                marginBottom: "0.4rem",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
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
            <label
              htmlFor="auth-last-name"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "var(--text-2)",
                marginBottom: "0.4rem",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
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

        <div>
          <label
            htmlFor="auth-email"
            style={{
              display: "block",
              fontSize: "0.8rem",
              fontWeight: 500,
              color: "var(--text-2)",
              marginBottom: "0.4rem",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
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
              if (e.key === "Enter" && canSubmit) signInWithMagicLink();
            }}
            autoComplete="email"
          />
        </div>

        <Button
          disabled={!canSubmit}
          onClick={signInWithMagicLink}
          size="lg"
          style={{ width: "100%", marginTop: "0.25rem" }}
        >
          {pending ? (
            <>
              <SpinnerIcon />
              Enviando...
            </>
          ) : (
            "Ingresar con link →"
          )}
        </Button>

        {message && (
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
            {message}
          </p>
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
