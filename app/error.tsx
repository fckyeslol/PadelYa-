"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center"
      style={{ background: "var(--bg)" }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          background: "rgba(153,27,27,0.07)",
          border: "1px solid rgba(153,27,27,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--danger)",
          marginBottom: "1.25rem",
        }}
      >
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h1
        style={{
          fontFamily: "var(--font-syne)",
          fontWeight: 800,
          fontSize: "clamp(1.3rem, 3vw, 1.75rem)",
          letterSpacing: "-0.025em",
          color: "var(--text)",
          marginBottom: "0.6rem",
        }}
      >
        Algo salió mal
      </h1>
      <p style={{ color: "var(--text-2)", fontSize: "0.9rem", marginBottom: "2rem", maxWidth: "30rem" }}>
        {error.message ?? "Ocurrió un error inesperado. Intenta de nuevo o vuelve a los partidos."}
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={reset}
          style={{
            background: "var(--primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            padding: "0.65rem 1.5rem",
            fontWeight: 700,
            fontSize: "0.9rem",
            fontFamily: "var(--font-dm-sans)",
            cursor: "pointer",
          }}
        >
          Intentar de nuevo
        </button>
        <Link
          href="/matches"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            borderRadius: "10px",
            padding: "0.65rem 1.5rem",
            fontWeight: 600,
            fontSize: "0.9rem",
            fontFamily: "var(--font-dm-sans)",
            textDecoration: "none",
          }}
        >
          Ver partidos
        </Link>
      </div>
    </div>
  );
}
