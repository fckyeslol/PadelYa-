import Link from "next/link";

export function CancellationPolicyNotice() {
  return (
    <div
      style={{
        background: "rgba(251,191,36,0.06)",
        border: "1px solid rgba(251,191,36,0.18)",
        borderRadius: "14px",
        padding: "1rem 1.25rem",
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: "20px",
          height: "20px",
          flexShrink: 0,
          color: "var(--warning)",
          marginTop: "1px",
        }}
      >
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <div>
        <p
          style={{
            color: "var(--warning)",
            fontSize: "0.82rem",
            fontWeight: 600,
            marginBottom: "0.25rem",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Politica de cancelacion
        </p>
        <p
          style={{
            color: "rgba(251,191,36,0.75)",
            fontSize: "0.82rem",
            lineHeight: 1.55,
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Reembolso total solo si el partido no esta completo y cancelas con mas de 3 horas de anticipacion. Si no se llena el grupo, el organizador procesa el reembolso en 24-72 horas.
        </p>
        <Link
          href="/refund-policy"
          style={{
            color: "var(--warning)",
            fontSize: "0.78rem",
            textDecoration: "underline",
            display: "inline-block",
            marginTop: "0.45rem",
          }}
        >
          Ver política completa de reembolsos
        </Link>
      </div>
    </div>
  );
}
