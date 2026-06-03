import { MatchForm } from "@/components/match/MatchForm";
import { CancellationPolicyNotice } from "@/components/match/CancellationPolicyNotice";
import Link from "next/link";

export default function NewMatchPage() {
  return (
    <div className="app-page-shell">
      {/* Page header — editorial, bold */}
      <div
        className="px-6 pt-7 pb-6"
        style={{
          position: "relative",
          overflow: "hidden",
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Court grid texture */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(233,255,71,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(233,255,71,0.025) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            pointerEvents: "none",
          }}
        />
        {/* Lime accent hairline at top */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(233,255,71,0.55) 30%, rgba(233,255,71,0.55) 70%, transparent 100%)",
          }}
        />

        <div className="mx-auto max-w-3xl" style={{ position: "relative", zIndex: 1 }}>
          <Link
            href="/matches"
            style={{
              color: "var(--text-3)",
              fontSize: "0.7rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: "1.1rem",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            className="hover:text-[var(--text-2)]"
          >
            <svg
              width="11"
              height="11"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Partidos
          </Link>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontSize: "clamp(3rem, 9vw, 5.25rem)",
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
              color: "var(--text)",
              lineHeight: 0.9,
              marginBottom: "1.25rem",
            }}
          >
            Crear{" "}
            <em style={{ color: "var(--primary)", fontStyle: "normal" }}>Partido</em>
          </h1>

          {/* Inline meta — no fake-stats bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem 1.25rem",
              alignItems: "center",
            }}
          >
            <MetaDot color="var(--primary)" glow="rgba(233,255,71,0.5)">
              Publicar es gratis
            </MetaDot>
            <MetaDot color="var(--gold)" glow="rgba(255,90,31,0.5)">
              3 clubes disponibles
            </MetaDot>
            <MetaDot color="var(--text-3)" glow="transparent">
              Se llena en 18h promedio
            </MetaDot>
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

/* ── Sub-components ──────────────────────────────────────────── */

function MetaDot({
  color,
  glow,
  children,
}: {
  color: string;
  glow: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        fontSize: "0.75rem",
        color: "var(--text-3)",
        fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 5px ${glow}`,
          flexShrink: 0,
        }}
      />
      {children}
    </span>
  );
}
