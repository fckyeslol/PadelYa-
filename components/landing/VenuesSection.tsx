import Link from "next/link";
import { BARRANQUILLA_VENUES } from "@/config/venues";
import { VenuePhoto } from "@/components/venue/VenuePhoto";

const SHOWN_VENUE_IDS = new Set(["casa-padel", "x3-padel-club", "la-jaula"]);

export function VenuesSection() {
  return (
    <section style={{ background: "var(--surface)" }} className="px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="landing-section-title mb-2">Clubes en Barranquilla</h2>
        <p className="landing-section-sub mb-10 max-w-xl">
          Reserva en las canchas donde ya juegan los partidos de PadelYa.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {BARRANQUILLA_VENUES.filter((v) => SHOWN_VENUE_IDS.has(v.id)).map((venue) => (
            <Link
              key={venue.id}
              href={`/matches?venue=${encodeURIComponent(venue.name)}`}
              className="landing-match-card landing-venue-card overflow-hidden p-0"
            >
              <VenuePhoto
                venueName={venue.name}
                height={180}
                rounded="0"
                showLabel
                imageVariant="club"
              />
              <div className="p-4">
                <p className="landing-match-meta" style={{ marginBottom: "0.75rem" }}>
                  Ver partidos en {venue.name}
                </p>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    color: "var(--primary)",
                  }}
                >
                  Explorar partidos →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
