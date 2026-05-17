import Image from "next/image";
import Link from "next/link";
import { HeroSearch } from "@/components/landing/HeroSearch";

const HERO_IMAGE = "/hero-player.jpg";

export function HeroSection() {
  return (
    <section
      className="landing-hero"
      style={{
        background:
          "linear-gradient(155deg, #0a2f7a 0%, #0d3a9e 35%, #1a4fd6 100%)",
        minHeight: "min(85vh, 800px)",
      }}
    >
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-6 pb-14 pt-10 lg:grid-cols-2 lg:gap-12 lg:pb-16 lg:pt-12">
        <div>
          <p className="landing-hero-badge mb-6">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#c8f135",
                display: "inline-block",
              }}
            />
            Partidos abiertos en Barranquilla
          </p>

          <h1 className="landing-hero-title mb-5">
            Encuentra <em>partidos y jugadores</em> cerca de ti
          </h1>

          <p className="landing-hero-sub mb-8">
            Únete a partidos abiertos, paga tu cupo en segundos y conecta con la
            comunidad de pádel en Barranquilla.
          </p>

          <HeroSearch />

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/matches" className="landing-cta-btn">
              Ver partidos
            </Link>
            <Link href="/matches/new" className="landing-hero-link">
              Crear partido →
            </Link>
          </div>
        </div>

        <div className="landing-hero-visual mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
          <Image
            src={HERO_IMAGE}
            alt="Jugador de pádel en cancha"
            fill
            priority
            sizes="(max-width: 1024px) 90vw, 480px"
            style={{ objectFit: "cover", objectPosition: "center top" }}
          />
        </div>
      </div>
    </section>
  );
}
