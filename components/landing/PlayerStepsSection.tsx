const STEPS = [
  {
    title: "Encuentra",
    description:
      "Explora partidos abiertos por nivel y fecha. Únete a uno existente o crea el tuyo.",
  },
  {
    title: "Reserva",
    description:
      "Paga tu cupo en línea en segundos. Tu plaza queda confirmada al instante.",
  },
  {
    title: "Juega",
    description:
      "Coordínate en el chat del partido, llega a la cancha y registra el resultado.",
  },
];

export function PlayerStepsSection() {
  return (
    <section className="landing-steps px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <h2 className="landing-steps-title">
            Así funciona<br />
            <span style={{ color: "var(--primary)" }}>PadelYa</span>
          </h2>
          <p
            style={{
              color: "var(--text-3)",
              fontSize: "0.78rem",
              fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              paddingBottom: "0.25rem",
            }}
          >
            03 pasos
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid gap-0 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <article key={step.title} className="landing-step-card">
              {/* Faded large number in background */}
              <span className="landing-step-num-bg" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="mb-4 flex items-center gap-3">
                <span className="landing-step-num">{i + 1}</span>
                <h3
                  style={{
                    fontFamily: "var(--font-barlow, 'Barlow Condensed', sans-serif)",
                    fontWeight: 800,
                    fontSize: "1.3rem",
                    letterSpacing: "0.01em",
                    textTransform: "uppercase",
                  }}
                >
                  {step.title}
                </h3>
              </div>

              <p style={{ fontSize: "0.9rem", lineHeight: 1.65 }}>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
