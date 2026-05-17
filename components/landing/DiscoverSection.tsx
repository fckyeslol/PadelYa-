import Link from "next/link";

const CARDS = [
  {
    href: "/matches",
    title: "Partidos abiertos",
    description: "Únete a un partido público o crea el tuyo y llena los cupos.",
    gradient: "linear-gradient(135deg, #0d3a9e 0%, #2563eb 100%)",
    icon: "🏟️",
  },
  {
    href: "/players",
    title: "Comunidad",
    description: "Conoce jugadores de tu nivel y mira su historial en cancha.",
    gradient: "linear-gradient(135deg, #1e3a6e 0%, #1a4fd6 100%)",
    icon: "👥",
  },
  {
    href: "/matches/new",
    title: "Crea tu partido",
    description: "¿Tienes cancha? Abre el partido y el sistema organiza el resto.",
    gradient: "linear-gradient(135deg, #0a2f7a 0%, #3b82f6 100%)",
    icon: "➕",
  },
];

export function DiscoverSection() {
  return (
    <section style={{ background: "#f1f5f9" }} className="px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="landing-section-title mb-2">Descubre PadelYa</h2>
        <p className="landing-section-sub mb-10 max-w-xl">
          Todo lo que necesitas para jugar pádel en Barranquilla, en un solo lugar.
        </p>

        <div className="grid gap-5 md:grid-cols-3">
          {CARDS.map((card) => (
            <Link key={card.href} href={card.href} className="landing-discover-card">
              <div
                className="landing-discover-top"
                style={{ background: card.gradient }}
              >
                <span style={{ fontSize: "2rem", marginBottom: "0.5rem" }} aria-hidden>
                  {card.icon}
                </span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
              <div className="landing-discover-footer">
                <span>Explorar</span>
                <span aria-hidden>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
