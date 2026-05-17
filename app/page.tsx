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
    <section style={{ background: "#ffffff" }} className="px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="landing-section-title mb-4">¿Listo para jugar?</h2>
        <p className="landing-section-sub mb-8">
          Los mejores cupos se llenan rápido. Encuentra tu partido y reserva hoy.
        </p>
        <Link href="/matches" className="landing-cta-btn">
          Ver partidos disponibles →
        </Link>
      </div>
    </section>
  );
}
