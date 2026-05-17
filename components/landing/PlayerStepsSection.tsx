const STEPS = [
  {
    title: "Encuentra",
    description:
      "Explora partidos abiertos por nivel y fecha. Únete a uno existente o crea el tuyo.",
  },
  {
    title: "Reserva",
    description:
      "Paga tu cupo con Wompi en segundos. Tu plaza queda confirmada al instante.",
  },
  {
    title: "Juega",
    description:
      "Coordínate en el chat del partido, llega a la cancha y registra el resultado.",
  },
];

export function PlayerStepsSection() {
  return (
    <section
      className="landing-steps px-6 py-16 lg:py-20"
      style={{
        background: "linear-gradient(160deg, #0a2f7a 0%, #0d3a9e 50%, #1a4fd6 100%)",
      }}
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="landing-steps-title">PadelYa para jugadores</h2>

        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <article key={step.title} className="landing-step-card">
              <div className="mb-4 flex items-center gap-3">
                <span className="landing-step-num">{i + 1}</span>
                <h3
                  style={{
                    fontFamily: "var(--font-syne)",
                    fontWeight: 700,
                    fontSize: "1.15rem",
                  }}
                >
                  {step.title}
                </h3>
              </div>
              <div
                style={{
                  borderTop: "1px dashed #cbd5e1",
                  marginBottom: "1rem",
                }}
              />
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
