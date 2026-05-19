"use client";

import { useFormStatus } from "react-dom";

export function SaveProfileButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="glow-primary-sm"
      style={{
        background: "var(--primary)",
        color: "#ffffff",
        border: "none",
        borderRadius: "10px",
        padding: "0.7rem 1.5rem",
        fontWeight: 700,
        fontSize: "0.9rem",
        fontFamily: "var(--font-dm-sans)",
        cursor: pending ? "not-allowed" : "pointer",
        marginTop: "0.5rem",
        letterSpacing: "-0.01em",
        opacity: pending ? 0.7 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        width: "100%",
        transition: "opacity 0.15s",
      }}
    >
      {pending && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}
        >
          <path strokeLinecap="round" d="M12 3a9 9 0 109 9" />
        </svg>
      )}
      {pending ? "Guardando..." : "Guardar cambios"}
    </button>
  );
}
