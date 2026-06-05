import Image from "next/image";
import Link from "next/link";
import { HeroSearch } from "@/components/landing/HeroSearch";

const HERO_IMAGE = "/hero-player.jpg";

export function HeroSection() {
  return (
    <section
      className="landing-hero"
      style={{ minHeight: "min(92vh, 900px)", display: "flex", alignItems: "center" }}
    >
      {/* Full-bleed background image with dark overlay */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center top" }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(108deg, rgba(12,11,8,0.97) 0%, rgba(12,11,8,0.88) 40%, rgba(12,11,8,0.45) 100%)",
          }}
        />
      </div>

      {/* Subtle court-line grid */}
      <div className="hero-court-grid" aria-hidden />

      {/* Content */}
      <div className="relative mx-auto w-full max-w-6xl px-6 py-20 lg:py-28" style={{ zIndex: 2 }}>
        {/* Eyebrow */}
        <p className="landing-hero-eyebrow mb-6">
          <span
            aria-hidden
            style={{ width: 28, height: 2, background: "var(--primary)", display: "inline-block", flexShrink: 0 }}
          />
          Barranquilla · Pádel
        </p>

        {/* Headline */}
        <h1 className="landing-hero-title mb-6" style={{ maxWidth: "16ch" }}>
          Encuentra tu<br />
          partido de <em>pádel</em><br />
          en Barranquilla
        </h1>

        {/* Subtext */}
        <p className="landing-hero-sub mb-8">
          Partidos abiertos en Barranquilla. Paga tu cupo en segundos
          y juega con gente de tu nivel.
        </p>

        {/* Search */}
        <div className="mb-8" style={{ maxWidth: 480 }}>
          <HeroSearch />
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
          <Link href="/matches" className="landing-cta-btn">
            Ver partidos →
          </Link>
          <Link
            href="/matches/new"
            style={{
              color: "var(--text-2)",
              fontSize: "0.9rem",
              fontWeight: 500,
              fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
              textDecoration: "none",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "2px",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            Crear partido
          </Link>
        </div>
      </div>
    </section>
  );
}
