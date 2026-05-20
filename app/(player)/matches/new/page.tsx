import { MatchForm } from "@/components/match/MatchForm";
import { CancellationPolicyNotice } from "@/components/match/CancellationPolicyNotice";
import Link from "next/link";

export default function NewMatchPage() {
  return (
    <div className="app-page-shell">
      {/* Page header */}
      <div
        className="px-6 py-7"
        style={{
          background: "#ffffff",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto max-w-3xl">
          <Link
            href="/matches"
            style={{
              color: "var(--text-3)",
              fontSize: "0.82rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontFamily: "var(--font-dm-sans)",
              marginBottom: "1rem",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            className="hover:text-[var(--text-2)]"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Volver a partidos
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "3px",
                height: "2rem",
                borderRadius: "2px",
                background: "var(--primary)",
                flexShrink: 0,
              }}
            />
            <div>
              <p
                style={{
                  color: "var(--primary)",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-montserrat)",
                  marginBottom: "0.15rem",
                }}
              >
                Nuevo partido
              </p>
              <h1
                style={{
                  fontFamily: "var(--font-montserrat)",
                  fontWeight: 800,
                  fontSize: "clamp(1.35rem, 3vw, 1.75rem)",
                  letterSpacing: "-0.025em",
                  color: "var(--text)",
                  lineHeight: 1.15,
                }}
              >
                Crear partido
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="mx-auto max-w-3xl px-6 py-8"
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
        <div className="app-content-frame p-2 sm:p-3">
          <MatchForm />
        </div>
        <CancellationPolicyNotice />
      </div>
    </div>
  );
}
