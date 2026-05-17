import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad | PadelYa!",
  description: "Cómo PadelYa! recolecta y usa datos personales.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10" style={{ color: "var(--text)" }}>
      <h1 style={{ fontFamily: "var(--font-syne)", fontSize: "1.8rem", fontWeight: 800, marginBottom: "1rem" }}>
        Política de privacidad
      </h1>
      <p style={{ color: "var(--text-2)", marginBottom: "1.2rem" }}>
        Esta política explica cómo tratamos tus datos en PadelYa!.
      </p>

      <Section title="1. Datos que recolectamos">
        Nombre, correo, nivel de juego, teléfono, foto de perfil y eventos relacionados con tus pagos y participación en partidos.
      </Section>
      <Section title="2. Para qué usamos tus datos">
        Para crear tu cuenta, gestionar partidos, procesar pagos, mostrar perfiles en la app y comunicar estados relevantes (como confirmación de pago).
      </Section>
      <Section title="3. Compartición">
        No vendemos tus datos. Compartimos lo estrictamente necesario con proveedores de infraestructura y pagos para operar el servicio.
      </Section>
      <Section title="4. Seguridad y conservación">
        Aplicamos controles técnicos razonables. Conservamos la información por el tiempo necesario para operar el servicio y cumplir obligaciones legales.
      </Section>
      <Section title="5. Tus derechos">
        Puedes solicitar actualización o eliminación de tu información escribiendo al canal de soporte oficial de PadelYa!.
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
