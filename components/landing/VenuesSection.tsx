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
              className="landing-match-card overflow-hidden p-0"
            >
              <div style={{ position: "relative", height: "180px" }}>
                <Image
                  src={venue.image}
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
                      "linear-gradient(to top, rgba(15,22,41,0.7) 0%, transparent 50%)",
                  }}
                />
                <h3
                  style={{
                    position: "absolute",
                    bottom: "1rem",
                    left: "1rem",
                    right: "1rem",
                    fontFamily: "var(--font-syne)",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "#ffffff",
                  }}
                >
                  {venue.name}
                </h3>
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
