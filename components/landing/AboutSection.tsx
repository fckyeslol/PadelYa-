import Image from "next/image";
import Link from "next/link";

const ABOUT_IMAGE = "/about-padel.jpg";

export function AboutSection() {
  return (
    <section style={{ background: "var(--bg)" }} className="px-6 py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="landing-about-visual mx-auto w-full max-w-sm lg:max-w-none">
          <Image
            src={ABOUT_IMAGE}
            alt="Jugadores de pádel en cancha en Barranquilla"
            fill
            sizes="(max-width: 1024px) 90vw, 420px"
            style={{ objectFit: "cover", objectPosition: "center" }}
          />
        </div>

        <div>
          <h2 className="landing-section-title mb-4">¿Qué es PadelYa?</h2>
          <p className="landing-body mb-4">
            PadelYa es la plataforma para jugadores de pádel en Barranquilla.{" "}
            <span className="landing-highlight">
              Encuentra partidos abiertos, reserva tu cupo y conecta con otros
              jugadores
            </span>{" "}
            de tu nivel — todo desde un solo lugar.
          </p>
          <p className="landing-body mb-8">
            Sin grupos de WhatsApp interminables: ves quién va, pagas en línea y
            llegas a la cancha con tu lugar confirmado.
          </p>
          <Link href="/matches" className="landing-cta-btn">
            Explorar partidos
          </Link>
        </div>
      </div>
    </section>
  );
}
