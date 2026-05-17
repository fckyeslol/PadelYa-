import Image from "next/image";
import Link from "next/link";

const CARDS = [
  {
    href: "/matches",
    label: "Explorar partidos",
    title: "Partidos abiertos",
    description:
      "Encuentra cupos libres, filtra por nivel y únete en minutos.",
    image: "/venues/club-padel-zenter-del-rio.jpg",
    imageAlt: "Jugadores en cancha de pádel en Barranquilla",
  },
  {
    href: "/players",
    label: "Ver jugadores",
    title: "Comunidad",
    description:
      "Perfiles, nivel y historial para armar el partido ideal.",
    image: "/hero-player.jpg",
    imageAlt: "Jugador de pádel en Barranquilla",
  },
  {
    href: "/matches/new",
    label: "Crear partido",
    title: "Abre tu partido",
    description:
      "Tienes cancha reservada. Publica, cobra cupos y llena la lista.",
    image: "/venues/club-padel-zenter.jpg",
    imageAlt: "Instalación de pádel cubierta",
  },
];

export function DiscoverSection() {
  return (
    <section className="landing-discover-section px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="landing-discover-header mb-12 max-w-2xl">
          <p className="landing-discover-eyebrow">Experiencia PadelYa</p>
          <h2 className="landing-section-title mb-3">Descubre PadelYa</h2>
          <p className="landing-section-sub">
            Todo lo que necesitas para jugar pádel en Barranquilla, en un solo lugar.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 md:gap-7">
          {CARDS.map((card) => (
            <Link key={card.href} href={card.href} className="landing-discover-card">
              <div className="landing-discover-media">
                <Image
                  src={card.image}
                  alt={card.imageAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="landing-discover-img"
                />
                <div className="landing-discover-media-shade" aria-hidden />
              </div>

              <div className="landing-discover-body">
                <h3 className="landing-discover-title">{card.title}</h3>
                <p className="landing-discover-desc">{card.description}</p>
                <span className="landing-discover-cta">
                  {card.label}
                  <ArrowIcon />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
