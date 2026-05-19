import { MatchForm } from "@/components/match/MatchForm";
import { CancellationPolicyNotice } from "@/components/match/CancellationPolicyNotice";
import { ProfileForm } from "@/components/ProfileForm";
import Link from "next/link";

export default function NewMatchPage() {
  return (
    <div className="app-page-shell">
      {/* Page header */}
      <div className="app-top-section px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/matches"
            style={{
              color: "var(--text-2)",
              fontSize: "0.82rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontFamily: "var(--font-dm-sans)",
              marginBottom: "0.875rem",
            }}
            className="hover:text-[var(--text)]"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Volver a partidos
          </Link>
          <p
            style={{
              color: "var(--primary)",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontFamily: "var(--font-syne)",
              marginBottom: "0.35rem",
            }}
          >
            Nuevo partido
          </p>
          <h1
            style={{
              fontFamily: "var(--font-syne)",
              fontWeight: 800,
              fontSize: "clamp(1.5rem, 3.5vw, 2rem)",
              letterSpacing: "-0.025em",
              color: "var(--text)",
            }}
          >
            Crear partido
          </h1>
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
        <ProfileForm />
      </div>
    </div>
  );
}
