import Link from "next/link";
import { MatchList } from "@/components/match/MatchList";
import { getVenueInfo } from "@/config/venues";
import { listOpenMatches } from "@/services/matches/service";
import { getCurrentProfile } from "@/services/profiles/service";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    skillLevel?: "beginner" | "intermediate" | "advanced";
    date?: string;
    venue?: string;
  }>;
};

const SKILL_LABELS: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export default async function MatchesPage({ searchParams }: Props) {
  const params = await searchParams;
  let matches: Awaited<ReturnType<typeof listOpenMatches>> = [];
  let setupError: string | null = null;
  let isLoggedIn = false;

  try {
    [matches] = await Promise.all([
      listOpenMatches({ skillLevel: params.skillLevel, date: params.date }),
    ]);
    isLoggedIn = await getCurrentProfile().then((p) => p !== null).catch(() => false);

    if (params.venue?.trim()) {
      const filterVenue = getVenueInfo(params.venue);
      const venueQuery = params.venue.toLowerCase();
      matches = matches.filter((m) => {
        const matchVenue = getVenueInfo(m.venueName);
        if (filterVenue && matchVenue) return matchVenue.id === filterVenue.id;
        return m.venueName.toLowerCase().includes(venueQuery);
      });
    }
  } catch (error) {
    setupError =
      error instanceof Error ? error.message : "Supabase is not configured yet.";
  }

  return (
    <div className="app-page-shell">
      {/* Page header */}
      <div className="app-top-section px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
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
                Barranquilla · en vivo
              </p>
              <h1
                style={{
                  fontFamily: "var(--font-syne)",
                  fontWeight: 800,
                  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
                  letterSpacing: "-0.025em",
                  color: "var(--text)",
                }}
              >
                {params.venue ? `Partidos en ${params.venue}` : "Partidos abiertos"}
              </h1>
              {matches.length > 0 && (
                <p style={{ color: "var(--text-2)", marginTop: "0.25rem", fontSize: "0.9rem" }}>
                  {matches.length} partido{matches.length !== 1 ? "s" : ""} disponible{matches.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            <Link
              href="/matches/new"
              className="glow-primary self-start sm:self-auto"
              style={{
              background: "var(--primary)",
              color: "#ffffff",
              borderRadius: "10px",
              padding: "0.625rem 1.25rem",
              fontWeight: 700,
              fontSize: "0.875rem",
              fontFamily: "var(--font-dm-sans)",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              }}
            >
              <PlusIcon />
              Crear partido
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="app-filter-section px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <form className="flex flex-wrap items-center gap-3">
            {/* Skill level pills */}
            <div className="flex flex-wrap gap-2">
              <FilterPill name="skillLevel" value="" current={params.skillLevel ?? ""} label="Todos" />
              <FilterPill name="skillLevel" value="beginner" current={params.skillLevel ?? ""} label="Principiante" />
              <FilterPill name="skillLevel" value="intermediate" current={params.skillLevel ?? ""} label="Intermedio" />
              <FilterPill name="skillLevel" value="advanced" current={params.skillLevel ?? ""} label="Avanzado" />
            </div>

            <div
              style={{ width: "1px", height: "20px", background: "var(--border)", flexShrink: 0 }}
              className="hidden sm:block"
            />

            {/* Date input */}
            <input
              type="date"
              name="date"
              defaultValue={params.date ?? ""}
              className="input-base"
              style={{ width: "auto", minWidth: "160px" }}
            />

            <button
              type="submit"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: "8px",
                padding: "0.5rem 1rem",
                fontSize: "0.85rem",
                fontWeight: 500,
                fontFamily: "var(--font-dm-sans)",
                cursor: "pointer",
                transition: "background-color 0.15s ease",
              }}
            >
              Filtrar
            </button>

            {/* Active filter indicator */}
            {(params.skillLevel || params.date || params.venue) && (
              <Link
                href="/matches"
                style={{
                  color: "var(--text-2)",
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  transition: "color 0.15s ease",
                }}
                className="hover:text-[var(--danger)]"
              >
                <XIcon /> Limpiar filtros
              </Link>
            )}
          </form>
        </div>
      </div>

      {/* Onboarding banner for guests */}
      {!isLoggedIn && !setupError && (
        <div style={{ background: "var(--primary-muted)", borderBottom: "1px solid rgba(16,185,129,0.15)" }}>
          <div className="mx-auto max-w-5xl px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
            <p style={{ fontSize: "0.875rem", color: "var(--text-2)" }}>
              <span style={{ color: "var(--primary)", fontWeight: 600 }}>¿Primera vez?</span>
              {" "}Únete a un partido, paga tu cupo y juega en Barranquilla.
            </p>
            <Link
              href="/login"
              style={{
                background: "var(--primary)",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "0.35rem 1rem",
                fontWeight: 700,
                fontSize: "0.82rem",
                fontFamily: "var(--font-dm-sans)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Crear cuenta gratis →
            </Link>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {setupError ? (
          <div
            className="rounded-xl p-5 text-sm"
            style={{
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.25)",
              color: "var(--warning)",
            }}
          >
            <strong>Configuración pendiente:</strong> {setupError}.{" "}
            Completa <code className="opacity-80">.env.local</code> con las variables de Supabase.
          </div>
        ) : matches.length === 0 ? (
          <EmptyState skillLevel={params.skillLevel} />
        ) : (
          <div className="app-content-frame p-4 sm:p-5">
            <MatchList matches={matches} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function FilterPill({
  name,
  value,
  current,
  label,
}: {
  name: string;
  value: string;
  current: string;
  label: string;
}) {
  const isActive = current === value;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      style={{
        borderRadius: "999px",
        padding: "0.35rem 0.85rem",
        fontSize: "0.82rem",
        fontWeight: isActive ? 600 : 400,
        fontFamily: "var(--font-dm-sans)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
        background: isActive ? "var(--primary-muted)" : "transparent",
        color: isActive ? "var(--primary)" : "var(--text-2)",
      }}
    >
      {label}
    </button>
  );
}

function EmptyState({ skillLevel }: { skillLevel?: string }) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--primary)" }}
      >
        {/* Padel racket icon */}
        <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 14.5L3 21" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 9.5c2.5-2.5 2.5-6.5 0-9s-6.5-2.5-9 0-2.5 6.5 0 9 6.5 2.5 9 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h.01M11 5h.01M8 11h.01M11 8h.01" />
        </svg>
      </div>
      <h3
        style={{
          fontFamily: "var(--font-syne)",
          fontWeight: 700,
          fontSize: "1.15rem",
          color: "var(--text)",
          marginBottom: "0.5rem",
        }}
      >
        No hay partidos disponibles
      </h3>
      <p style={{ color: "var(--text-2)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
        {skillLevel
          ? `No hay partidos de nivel ${SKILL_LABELS[skillLevel] ?? skillLevel} en este momento.`
          : "No hay partidos abiertos. ¡Sé el primero en abrir uno!"}
      </p>
      <Link
        href="/matches/new"
        style={{
          background: "var(--primary)",
          color: "#ffffff",
          borderRadius: "10px",
          padding: "0.625rem 1.5rem",
          fontWeight: 700,
          fontSize: "0.875rem",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        Crear partido →
      </Link>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
