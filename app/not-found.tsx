import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center court-grid"
      style={{ background: "var(--bg)" }}
    >
      <p
        style={{
          fontFamily: "var(--font-montserrat)",
          fontWeight: 900,
          fontSize: "clamp(4rem, 12vw, 7rem)",
          color: "var(--primary)",
          lineHeight: 1,
          letterSpacing: "-0.05em",
          opacity: 0.15,
        }}
      >
        404
      </p>
      <h1
        style={{
          fontFamily: "var(--font-montserrat)",
          fontWeight: 800,
          fontSize: "clamp(1.4rem, 3vw, 1.9rem)",
          letterSpacing: "-0.025em",
          color: "var(--text)",
          marginTop: "-1rem",
          marginBottom: "0.75rem",
        }}
      >
        Página no encontrada
      </h1>
      <p style={{ color: "var(--text-2)", fontSize: "0.95rem", marginBottom: "2rem", maxWidth: "28rem" }}>
        Esta página no existe o el enlace ya no es válido.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/matches"
          style={{
            background: "var(--primary)",
            color: "#ffffff",
            borderRadius: "10px",
            padding: "0.65rem 1.5rem",
            fontWeight: 700,
            fontSize: "0.9rem",
            fontFamily: "var(--font-dm-sans)",
            textDecoration: "none",
          }}
        >
          Ver partidos
        </Link>
        <Link
          href="/"
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
          Inicio
        </Link>
      </div>
    </div>
  );
}
