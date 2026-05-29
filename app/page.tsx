import Link from "next/link";
import { HeroSection } from "@/components/landing/HeroSection";
import { VenuesSection } from "@/components/landing/VenuesSection";
import { AboutSection } from "@/components/landing/AboutSection";
import { FeaturedMatchesSection } from "@/components/landing/FeaturedMatchesSection";
import { DiscoverSection } from "@/components/landing/DiscoverSection";
import { PlayerStepsSection } from "@/components/landing/PlayerStepsSection";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="landing-page">
      <HeroSection />
      <VenuesSection />
      <FeaturedMatchesSection />
      <AboutSection />
      <DiscoverSection />
      <PlayerStepsSection />
      <FinalCta />
    </div>
  );
}

function FinalCta() {
  return (
    <section className="landing-final-cta px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8">
        <div>
          <p
            style={{
              fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
              fontSize: "0.7rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(12,11,8,0.5)",
              marginBottom: "1rem",
            }}
          >
            Barranquilla · Pádel
          </p>
          <h2 className="landing-final-cta-title">
            ¿Cuándo<br />juegas?
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "flex-start" }}>
          <Link href="/matches" className="landing-final-cta-btn">
            Ver partidos disponibles →
          </Link>
          <Link
            href="/matches/new"
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "rgba(12,11,8,0.6)",
              textDecoration: "none",
              borderBottom: "1px solid rgba(12,11,8,0.25)",
              paddingBottom: "2px",
            }}
          >
            Crear un partido
          </Link>
        </div>
      </div>
    </section>
  );
}
