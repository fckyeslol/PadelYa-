import Link from "next/link";

export function CancellationPolicyNotice() {
  return (
    <div
      style={{
        background: "var(--gold-muted)",
        border: "1px solid rgba(212,137,26,0.22)",
        borderRadius: "14px",
        padding: "1rem 1.25rem",
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: "var(--gold)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: "1px",
        }}
      >
        <span style={{ color: "#ffffff", fontSize: "0.8rem", fontWeight: 700, lineHeight: 1 }}>!</span>
      </div>
      <div>
        <p
          style={{
            color: "var(--warning)",
            fontSize: "0.82rem",
            fontWeight: 700,
            marginBottom: "0.3rem",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Política de cancelación
        </p>
        <p
          style={{
            color: "var(--text-2)",
            fontSize: "0.82rem",
            lineHeight: 1.55,
            fontFamily: "var(--font-dm-sans)",
            marginBottom: "0.45rem",
          }}
        >
          Reembolso total solo si el partido no está completo y cancelas con más de 3 horas de anticipación.
          Si no se llena el grupo, el organizador procesa el reembolso en 24-72 horas.
        </p>
        <Link
          href="/refund-policy"
          style={{
            color: "var(--warning)",
            fontSize: "0.78rem",
            fontWeight: 500,
            textDecoration: "underline",
            display: "inline-block",
          }}
        >
          Ver política completa de reembolsos
        </Link>
      </div>
    </div>
  );
}
