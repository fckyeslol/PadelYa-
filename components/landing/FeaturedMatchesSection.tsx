import Link from "next/link";
import { VenuePhoto } from "@/components/venue/VenuePhoto";
import { listOpenMatches } from "@/services/matches/service";
import { formatDateTime } from "@/utils/dates";
import { formatCop } from "@/utils/currency";
import { APP_CONFIG } from "@/config/business";

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
    <section style={{ background: "#f8fafc" }} className="px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="landing-section-title">
            Partidos disponibles en Barranquilla
          </h2>
          <Link
            href="/matches"
            style={{
              color: "#1a4fd6",
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
              (match.orgFeeCop ?? APP_CONFIG.defaultFeeCop) +
              APP_CONFIG.platformFeeCop;

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
                      fontFamily: "var(--font-syne)",
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {match.venueName}
                  </h3>
                  <p className="landing-match-meta">
                    {formatDateTime(match.scheduledAt)}
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
                    background: "#1e3a6e",
                    color: "#ffffff",
                    borderRadius: "999px",
                    padding: "0.6rem 1.25rem",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    marginTop: "auto",
                  }}
                >
                  Unirme · {formatCop(fee)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
