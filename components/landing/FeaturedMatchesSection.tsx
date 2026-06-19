import Link from "next/link";
import { VenuePhoto } from "@/components/venue/VenuePhoto";
import { listOpenMatches } from "@/services/matches/service";
import { formatDateTimeRange } from "@/utils/dates";
import { formatCop } from "@/utils/currency";
import { resolveDisplayFeeCop } from "@/config/pricing";

const SKILL_LABEL: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export async function FeaturedMatchesSection() {
  let matches: Awaited<ReturnType<typeof listOpenMatches>> = [];

  try {
    matches = await listOpenMatches();
  } catch {
    return null;
  }

  const featured = matches.slice(0, 3);
  if (featured.length === 0) return null;

  return (
    <section style={{ background: "var(--bg)" }} className="px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="landing-section-title">
            Partidos disponibles en Barranquilla
          </h2>
          <Link
            href="/matches"
            style={{
              color: "var(--primary)",
              fontWeight: 700,
              fontSize: "0.9rem",
            }}
          >
            Ver todos →
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {featured.map((match) => {
            const spotsLeft = (match.maxPlayers ?? 4) - match.paidCount;
            const fee =
              resolveDisplayFeeCop(match.venueName, match.scheduledAt, match.durationMinutes);

            return (
              <Link
                key={match.id}
                href={`/matches/${match.id}`}
                className="landing-match-card"
              >
                <VenuePhoto venueName={match.venueName} height={140} showLabel />

                <div>
                  <h3
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      letterSpacing: "0.01em",
                      textTransform: "uppercase",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {match.venueName}
                  </h3>
                  <p className="landing-match-meta">
                    {formatDateTimeRange(match.scheduledAt, match.durationMinutes)}
                  </p>
                  <p className="landing-match-tag" style={{ marginTop: "0.5rem" }}>
                    {SKILL_LABEL[match.skillLevel] ?? match.skillLevel} ·{" "}
                    {match.paidCount}/{match.maxPlayers ?? 4} jugadores
                    {spotsLeft > 0
                      ? ` · ${spotsLeft} cupo${spotsLeft > 1 ? "s" : ""} libre${spotsLeft > 1 ? "s" : ""}`
                      : ""}
                  </p>
                </div>

                <span
                  style={{
                    display: "inline-flex",
                    alignSelf: "flex-start",
                    background: "var(--primary)",
                    color: "var(--primary-fg)",
                    borderRadius: "4px",
                    padding: "0.6rem 1.25rem",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    marginTop: "auto",
                  }}
                >
                  Unirme · {fee != null ? formatCop(fee) : "Ver tarifa"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
