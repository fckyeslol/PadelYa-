"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ConfirmCourtForm({ matchId }: { matchId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function publish() {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/matches/${matchId}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string; payUrl?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo publicar el partido");
        return;
      }

      router.push(data.payUrl ?? `/matches/${matchId}?pay=1`);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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

      <button
        onClick={publish}
        disabled={pending}
        style={{
          background: "var(--primary)",
          color: "#0C0B08",
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
          <svg
            width="18"
            height="18"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
        {pending ? "Publicando..." : "Publicar partido →"}
      </button>

      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--text-3)",
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        Al publicar, el partido será visible para otros jugadores.
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
