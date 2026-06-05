import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BARRANQUILLA_VENUES } from "@/config/venues";

export const metadata: Metadata = {
  title: "Canchas de pádel en Barranquilla",
  description:
    "Todas las canchas de pádel en Barranquilla con partidos abiertos en PadelYa: Casa Padel, La Jaula, X3 Pádel Club, Pádel Park y más. Únete o crea tu partido.",
  alternates: { canonical: "/canchas" },
};

export default function CanchasIndexPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-5xl px-6 py-10" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <header>
          <p
            style={{
              fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--primary)",
              marginBottom: "0.6rem",
            }}
          >
            Barranquilla · Pádel
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display, 'Barlow Condensed', sans-serif)",
              fontWeight: 900,
              fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: "var(--text)",
              marginBottom: "0.9rem",
            }}
          >
            Canchas de pádel en Barranquilla
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "1rem", lineHeight: 1.65, maxWidth: "46rem", fontFamily: "var(--font-dm-sans)" }}>
            Estas son las sedes de pádel en Barranquilla con partidos abiertos en PadelYa. Elige tu
            cancha favorita, mira los partidos disponibles y únete con tu cupo confirmado — o crea el
            tuyo y llena la lista.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BARRANQUILLA_VENUES.map((venue) => (
            <Link
              key={venue.id}
              href={`/canchas/${venue.id}`}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                overflow: "hidden",
                textDecoration: "none",
                transition: "border-color 0.15s ease",
              }}
              className="hover:border-[var(--primary)]"
            >
              <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10" }}>
                <Image
                  src={venue.clubImage}
                  alt={`${venue.name} — cancha de pádel en Barranquilla`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  style={{ objectFit: venue.imageFit ?? "cover", objectPosition: venue.clubImagePosition ?? "center" }}
                />
              </div>
              <div style={{ padding: "1rem" }}>
                <h2 style={{ fontFamily: "var(--font-montserrat)", fontWeight: 700, fontSize: "1.05rem", color: "var(--text)", marginBottom: "0.25rem" }}>
                  {venue.name}
                </h2>
                <p style={{ color: "var(--text-3)", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}>
                  {venue.courts ? `${venue.courts} canchas · ` : ""}Ver partidos →
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
