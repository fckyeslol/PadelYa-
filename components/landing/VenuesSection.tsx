import Link from "next/link";
import Image from "next/image";
import { BARRANQUILLA_VENUES } from "@/config/venues";

export function VenuesSection() {
  return (
    <section style={{ background: "#ffffff" }} className="px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="landing-section-title mb-2">Clubes en Barranquilla</h2>
        <p className="landing-section-sub mb-10 max-w-xl">
          Reserva en las canchas donde ya juegan los partidos de PadelYa.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {BARRANQUILLA_VENUES.map((venue) => (
            <Link
              key={venue.id}
              href={`/matches?venue=${encodeURIComponent(venue.name)}`}
              className="landing-match-card landing-venue-card overflow-hidden p-0"
            >
              <div style={{ position: "relative", height: "180px" }}>
                <Image
                  src={venue.clubImage}
                  alt={venue.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  style={{ objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top, rgba(15,22,41,0.85) 0%, rgba(15,22,41,0.3) 55%, transparent 100%)",
                  }}
                />
                <span className="venue-photo-overlay-title">
                  {venue.name}
                </span>
              </div>
              <div className="p-4">
                <p className="landing-match-meta" style={{ marginBottom: "0.75rem" }}>
                  Ver partidos en {venue.name}
                </p>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    color: "#1a4fd6",
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
