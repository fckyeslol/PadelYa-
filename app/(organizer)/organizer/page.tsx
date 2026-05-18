import { AnalyticsKpiCards } from "@/components/organizer/AnalyticsKpiCards";
import { OrganizerMatchTable } from "@/components/organizer/OrganizerMatchTable";
import { OrganizerRefundTable } from "@/components/organizer/OrganizerRefundTable";
import { redirect } from "next/navigation";
import { requireOrganizerUser } from "@/lib/auth/organizer";
import { getOrganizerKpis } from "@/services/analytics/service";
import { listOpenMatches } from "@/services/matches/service";
import { listAllRefunds } from "@/services/refunds/service";

export const dynamic = "force-dynamic";

export default async function OrganizerPage() {
  let setupError: string | null = null;
  try {
    await requireOrganizerUser();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing required env var")) {
      setupError = error.message;
    } else {
      redirect("/login");
    }
  }

  if (setupError) {
    return (
      <div
        className="mx-auto w-full max-w-3xl px-6 py-10"
        style={{ background: "var(--bg)", minHeight: "100vh" }}
      >
        <div
          style={{
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.25)",
            borderRadius: "12px",
            padding: "1.25rem",
            color: "var(--warning)",
            fontSize: "0.9rem",
          }}
        >
          <strong>Configuración pendiente:</strong> {setupError}. Completa{" "}
          <code className="opacity-80">.env.local</code> con las variables de Supabase.
        </div>
      </div>
    );
  }

  const [matches, analytics, refunds] = await Promise.all([
    listOpenMatches(),
    getOrganizerKpis(),
    listAllRefunds().catch(() => []),
  ]);
  const latestFunnel = analytics.funnel[0];
  const completedMatches = Number(latestFunnel?.matches_completed ?? 0);
  const createdMatches = Number(latestFunnel?.matches_created ?? 0);
  const filledMatches = Number(latestFunnel?.matches_filled ?? 0);
  const fillRate = createdMatches > 0 ? filledMatches / createdMatches : 0;

  const repeatPlayers = Number(analytics.repeatPlayers?.repeat_players ?? 0);
  const totalPlayers = Number(analytics.repeatPlayers?.total_paying_players ?? 0);
  const repeatRate = totalPlayers > 0 ? repeatPlayers / totalPlayers : 0;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
        className="px-6 py-8"
      >
        <div className="mx-auto max-w-5xl flex items-end justify-between gap-4">
          <div>
            <p
              style={{
                color: "var(--primary)",
                fontSize: "0.72rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: "var(--font-syne)",
                marginBottom: "0.4rem",
              }}
            >
              Panel exclusivo
            </p>
            <h1
              style={{
                fontFamily: "var(--font-syne)",
                fontWeight: 800,
                fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
                letterSpacing: "-0.025em",
                color: "var(--text)",
              }}
            >
              Organizador
            </h1>
            <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              Operación diaria de PadelYa!
            </p>
          </div>

          <a
            href="/api/organizer/export"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: "10px",
              padding: "0.55rem 1rem",
              fontWeight: 500,
              fontSize: "0.85rem",
              fontFamily: "var(--font-dm-sans)",
              transition: "border-color 0.15s ease",
              whiteSpace: "nowrap",
            }}
          >
            <DownloadIcon />
            Exportar CSV
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <AnalyticsKpiCards
          completedMatches={completedMatches}
          fillRate={fillRate}
          repeatRate={repeatRate}
        />

        <section>
          <h2
            style={{
              fontFamily: "var(--font-syne)",
              fontWeight: 700,
              fontSize: "1.1rem",
              color: "var(--text)",
              marginBottom: "1rem",
              letterSpacing: "-0.01em",
            }}
          >
            Partidos activos
          </h2>
          <OrganizerMatchTable matches={matches} />
        </section>

        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2
              style={{
                fontFamily: "var(--font-syne)",
                fontWeight: 700,
                fontSize: "1.1rem",
                color: "var(--text)",
                letterSpacing: "-0.01em",
              }}
            >
              Reembolsos
            </h2>
            {refunds.filter((r) => r.status === "pending_manual").length > 0 && (
              <span
                style={{
                  background: "rgba(251,191,36,0.15)",
                  color: "var(--gold)",
                  border: "1px solid rgba(251,191,36,0.3)",
                  borderRadius: "999px",
                  padding: "0.2rem 0.65rem",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                {refunds.filter((r) => r.status === "pending_manual").length} pendiente{refunds.filter((r) => r.status === "pending_manual").length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "1.25rem",
            }}
          >
            <OrganizerRefundTable refunds={refunds} />
          </div>
        </section>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
