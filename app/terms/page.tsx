import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de servicio | PadelYa!",
  description: "Términos de servicio de PadelYa! para jugadores y organizadores.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10" style={{ color: "var(--text)" }}>
      <h1 style={{ fontFamily: "var(--font-syne)", fontSize: "1.8rem", fontWeight: 800, marginBottom: "1rem" }}>
        Términos de servicio
      </h1>
      <p style={{ color: "var(--text-2)", marginBottom: "1.2rem" }}>
        Al usar PadelYa! aceptas estas reglas de uso para crear, unirte y gestionar partidos de pádel.
      </p>

      <Section title="1. Uso de la plataforma">
        PadelYa! conecta jugadores para coordinar partidos. Cada usuario es responsable de la veracidad de su perfil, su disponibilidad y su comportamiento en cancha.
      </Section>
      <Section title="2. Pagos y cupos">
        Un cupo queda reservado cuando el pago es aprobado por el proveedor de pagos. Si el pago se rechaza o se anula, el cupo vuelve a estar disponible.
      </Section>
      <Section title="3. Cancelaciones">
        Las reglas de cancelación y reembolso aplican según la política de reembolsos publicada en esta plataforma.
      </Section>
      <Section title="4. Conducta y sanciones">
        El uso indebido, fraude o no-show reiterado puede implicar suspensión de la cuenta o bloqueo de futuros cupos.
      </Section>
      <Section title="5. Cambios">
        Podemos actualizar estos términos para reflejar mejoras del servicio o cambios regulatorios. La versión publicada en esta página será la vigente.
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--card)" }}>
      <h2 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>{title}</h2>
      <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>{children}</p>
    </section>
  );
}
