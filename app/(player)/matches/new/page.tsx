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
          background: "var(--surface)",
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
                height: "2.25rem",
                background: "var(--primary)",
                flexShrink: 0,
              }}
            />
            <div>
              <p
                style={{
                  color: "var(--primary)",
                  fontSize: "0.68rem",
                  fontWeight: 400,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)",
                  marginBottom: "0.2rem",
                }}
              >
                Nuevo partido
              </p>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 900,
                  fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  color: "var(--text)",
                  lineHeight: 0.95,
                }}
              >
                Crear partido
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Social proof bar */}
      <div
        className="px-6 py-3"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="mx-auto max-w-3xl"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "1.25rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              color: "var(--text-2)",
              fontSize: "0.82rem",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="var(--gold)" strokeWidth={2} style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.468 5.99 5.99 0 00-1.925 3.547 5.975 5.975 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
            </svg>
            <span>
              <span style={{ fontWeight: 700, color: "var(--gold)", fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)" }}>247</span>{" "}
              partidos creados esta semana
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              color: "var(--text-2)",
              fontSize: "0.82rem",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="var(--primary)" strokeWidth={2} style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <span>
              Se llenan en{" "}
              <span style={{ fontWeight: 700, color: "var(--primary)", fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)" }}>18h</span>{" "}
              promedio
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-6">
        <MatchForm />
        <div style={{ marginTop: "1.5rem" }}>
          <CancellationPolicyNotice />
        </div>
      </div>
    </div>
  );
}
