"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ConfirmCourtForm({ matchId }: { matchId: string }) {
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function activate(withRef: boolean) {
    startTransition(async () => {
      setError(null);
      const body: Record<string, string> = {};
      if (withRef && ref.trim()) body.courtReference = ref.trim();

      const res = await fetch(`/api/matches/${matchId}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo publicar el partido");
        return;
      }

      router.push(`/matches/${matchId}`);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p
        style={{
          fontSize: "0.78rem",
          fontWeight: 600,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        Paso 2 — Confirma y publica
      </p>

      {/* Reference input */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <label
          htmlFor="court-ref"
          style={{ fontSize: "0.875rem", color: "var(--text)", fontWeight: 500 }}
        >
          Número de confirmación{" "}
          <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span>
        </label>
        <input
          id="court-ref"
          className="input-base"
          placeholder="Ej. RES-20481 o 3132689016"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          disabled={pending}
        />
        <p style={{ fontSize: "0.78rem", color: "var(--text-3)", lineHeight: 1.5 }}>
          Si la plataforma te dio un código de reserva, pégalo aquí para que
          quede registrado.
        </p>
      </div>

      {error && (
        <p
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.2)",
            borderRadius: "10px",
            padding: "0.75rem 1rem",
            color: "var(--danger)",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </p>
      )}

      {/* Primary CTA */}
      <button
        onClick={() => activate(true)}
        disabled={pending}
        style={{
          background: "var(--primary)",
          color: "#ffffff",
          border: "none",
          borderRadius: "12px",
          padding: "0.875rem",
          fontSize: "0.95rem",
          fontWeight: 700,
          fontFamily: "var(--font-dm-sans)",
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.6 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          width: "100%",
          transition: "opacity 0.15s",
        }}
      >
        {pending ? (
          <SpinnerIcon />
        ) : (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {pending ? "Publicando..." : "Ya reservé — publicar partido"}
      </button>

      {/* Skip option */}
      <button
        onClick={() => activate(false)}
        disabled={pending}
        style={{
          background: "transparent",
          color: "var(--text-3)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "0.75rem",
          fontSize: "0.85rem",
          fontWeight: 500,
          fontFamily: "var(--font-dm-sans)",
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.5 : 1,
          width: "100%",
          transition: "color 0.15s, border-color 0.15s",
        }}
        className="hover:border-[var(--text-2)] hover:text-[var(--text-2)]"
      >
        Publicar sin número de confirmación
      </button>

      <p style={{ fontSize: "0.75rem", color: "var(--text-3)", textAlign: "center", lineHeight: 1.5 }}>
        Al publicar, el partido será visible para otros jugadores.
        Asegúrate de tener la cancha reservada antes de continuar.
      </p>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <path strokeLinecap="round" d="M12 3a9 9 0 109 9" />
    </svg>
  );
}
