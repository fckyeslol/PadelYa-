import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BARRANQUILLA_VENUES, getVenueById, getVenueInfo, type VenueInfo } from "@/config/venues";
import { listOpenMatches } from "@/services/matches/service";
import { MatchList } from "@/components/match/MatchList";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ venueId: string }> };

const SITE_URL = "https://www.padelya.co";

export function generateStaticParams() {
  return BARRANQUILLA_VENUES.map((v) => ({ venueId: v.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { venueId } = await params;
  const venue = getVenueById(venueId);
  if (!venue) return { title: "Cancha no encontrada" };

  const title = `${venue.name} — Pádel en Barranquilla`;
  const description = `Juega pádel en ${venue.name}, Barranquilla. Encuentra partidos abiertos, únete y paga tu cupo en línea, o crea tu propio partido en PadelYa.`;

  return {
    title,
    description,
    alternates: { canonical: `/canchas/${venueId}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/canchas/${venueId}`,
      siteName: "PadelYa!",
      images: [{ url: venue.clubImage, alt: `${venue.name} — Pádel en Barranquilla` }],
    },
  };
}

/** Two-paragraph, venue-specific copy (varies by name + court count). */
function venueCopy(venue: VenueInfo): { intro: string; detail: string } {
  const courtsLabel = venue.courts
    ? `${venue.courts} canchas`
    : "sus canchas";
  return {
    intro: `${venue.name} es una de las sedes de pádel en Barranquilla disponibles en PadelYa. En esta página encuentras los partidos abiertos en ${venue.name}: únete a uno con un cupo libre, paga en línea y llega a la cancha con tu lugar confirmado.`,
    detail: `¿No hay partido a la hora que quieres jugar en ${venue.name}? Crea el tuyo en segundos, elige el horario entre ${courtsLabel} y comparte el enlace para llenarlo con jugadores de tu nivel. Sin grupos de WhatsApp interminables — todo desde PadelYa.`,
  };
}

export default async function VenuePage({ params }: Props) {
  const { venueId } = await params;
  const venue = getVenueById(venueId);
  if (!venue) notFound();

  const allMatches = await listOpenMatches().catch(() => []);
  const venueMatches = allMatches.filter((m) => getVenueInfo(m.venueName)?.id === venueId);
  const copy = venueCopy(venue);

  const otherVenues = BARRANQUILLA_VENUES.filter((v) => v.id !== venueId).slice(0, 6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: venue.name,
    description: `Cancha de pádel en Barranquilla. Encuentra y únete a partidos abiertos en ${venue.name} con PadelYa.`,
    url: `${SITE_URL}/canchas/${venue.id}`,
    image: `${SITE_URL}${venue.clubImage}`,
    sport: "Pádel",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Barranquilla",
      addressRegion: "Atlántico",
      addressCountry: "CO",
    },
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="mx-auto max-w-4xl px-6 py-8" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        {/* Breadcrumb */}
        <nav aria-label="Ruta de navegación">
          <Link
            href="/canchas"
            style={{ color: "var(--text-3)", fontSize: "0.82rem", textDecoration: "none", fontFamily: "var(--font-dm-sans)" }}
            className="hover:text-[var(--text)]"
          >
            ← Todas las canchas
          </Link>
        </nav>

        {/* Hero */}
        <header style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 7",
              borderRadius: "20px",
              overflow: "hidden",
              border: "1px solid var(--border)",
            }}
          >
            <Image
              src={venue.clubImage}
              alt={`${venue.name} — cancha de pádel en Barranquilla`}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              style={{ objectFit: venue.imageFit ?? "cover", objectPosition: venue.clubImagePosition ?? "center" }}
            />
          </div>

          <div>
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
              Pádel en {venue.name}
            </h1>
            <p style={{ color: "var(--text-2)", fontSize: "1rem", lineHeight: 1.65, maxWidth: "44rem", fontFamily: "var(--font-dm-sans)" }}>
              {copy.intro}
            </p>
          </div>
        </header>

        {/* Open matches at this venue */}
        <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h2 style={{ fontFamily: "var(--font-montserrat)", fontWeight: 700, fontSize: "1.3rem", color: "var(--text)", letterSpacing: "-0.01em" }}>
            Partidos abiertos en {venue.name}
          </h2>
          {venueMatches.length > 0 ? (
            <MatchList matches={venueMatches} />
          ) : (
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "1.75rem",
                textAlign: "center",
                color: "var(--text-2)",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              <p style={{ marginBottom: "1rem" }}>Aún no hay partidos abiertos en {venue.name}. ¡Sé el primero!</p>
              <Link href="/matches/new" className="landing-cta-btn" style={{ display: "inline-block" }}>
                Crear partido →
              </Link>
            </div>
          )}
        </section>

        {/* SEO body copy */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-montserrat)", fontWeight: 700, fontSize: "1.15rem", color: "var(--text)", marginBottom: "0.75rem" }}>
            Cómo jugar pádel en {venue.name}
          </h2>
          <p style={{ color: "var(--text-2)", fontSize: "0.95rem", lineHeight: 1.7, fontFamily: "var(--font-dm-sans)" }}>
            {copy.detail}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.25rem" }}>
            <Link href="/matches" className="landing-cta-btn" style={{ display: "inline-block" }}>
              Ver todos los partidos →
            </Link>
            <Link
              href="/matches/new"
              style={{
                display: "inline-block",
                padding: "0.7rem 1.25rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                color: "var(--text)",
                textDecoration: "none",
                fontFamily: "var(--font-dm-sans)",
                fontWeight: 600,
                fontSize: "0.9rem",
              }}
            >
              Crear partido
            </Link>
          </div>
        </section>

        {/* Internal links to other venues */}
        <section style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <h2 style={{ fontFamily: "var(--font-montserrat)", fontWeight: 700, fontSize: "1.05rem", color: "var(--text)" }}>
            Otras canchas de pádel en Barranquilla
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {otherVenues.map((v) => (
              <Link
                key={v.id}
                href={`/canchas/${v.id}`}
                style={{
                  padding: "0.4rem 0.9rem",
                  borderRadius: "999px",
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--text-2)",
                  textDecoration: "none",
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-dm-sans)",
                }}
                className="hover:text-[var(--text)]"
              >
                {v.name}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
