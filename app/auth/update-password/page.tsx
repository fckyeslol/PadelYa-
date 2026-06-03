"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const canSubmit = password.length >= 8 && password === confirmPassword && !pending;

  function handleUpdate() {
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const { error: authError } = await getSupabaseBrowserClient().auth.updateUser({ password });
      if (authError) {
        setError(authError.message);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/matches"), 2000);
    });
  }

  if (done) {
    return (
      <div
        className="flex flex-1 items-center justify-center px-6 py-16"
        style={{ background: "var(--bg)" }}
      >
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            padding: "2.5rem",
            maxWidth: "420px",
            width: "100%",
            textAlign: "center",
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
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
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
            Contraseña actualizada
          </h2>
          <p style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 items-center justify-center px-6 py-16 court-grid"
      style={{ background: "var(--bg)" }}
    >
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
            Nueva contraseña
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.88rem", lineHeight: 1.5 }}>
            Elige una contraseña segura para tu cuenta.
          </p>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {/* Password */}
          <div>
            <label htmlFor="new-password" style={labelStyle}>
              Contraseña
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                className="input-base"
                style={{ paddingRight: "2.75rem" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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
            {password.length > 0 && password.length < 8 && (
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

          {/* Confirm password */}
          <div>
            <label htmlFor="confirm-password" style={labelStyle}>
              Confirmar contraseña
            </label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              placeholder="Repite tu contraseña"
              className="input-base"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) handleUpdate();
              }}
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p
                style={{
                  color: "var(--danger)",
                  fontSize: "0.75rem",
                  marginTop: "0.35rem",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                Las contraseñas no coinciden.
              </p>
            )}
          </div>

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

          <Button
            disabled={!canSubmit}
            onClick={handleUpdate}
            size="lg"
            style={{ width: "100%", marginTop: "0.25rem" }}
          >
            {pending ? (
              <>
                <SpinnerIcon /> Actualizando...
              </>
            ) : (
              "Guardar contraseña →"
            )}
          </Button>
        </div>

        <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <Link
            href="/login"
            style={{
              color: "var(--text-3)",
              fontSize: "0.78rem",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 500,
  color: "var(--text-2)",
  marginBottom: "0.4rem",
  fontFamily: "var(--font-dm-sans)",
};

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
