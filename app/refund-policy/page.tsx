import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de reembolsos | PadelYa!",
  description: "Reglas de cancelación y reembolso de cupos en PadelYa!.",
};

export default function RefundPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10" style={{ color: "var(--text)" }}>
      <h1 style={{ fontFamily: "var(--font-montserrat)", fontSize: "1.8rem", fontWeight: 800, marginBottom: "1rem" }}>
        Política de reembolsos
      </h1>
      <p style={{ color: "var(--text-2)", marginBottom: "1.2rem" }}>
        Estas reglas aplican a todos los pagos de cupos realizados en PadelYa!.
      </p>

      <Section title="1. Cancelación por jugador">
        Hay reembolso cuando cancelas con más de 3 horas de anticipación y el partido no está marcado como lleno al momento de cancelar.
      </Section>
      <Section title="2. Cancelación tardía">
        Si cancelas con menos de 3 horas de anticipación, o el partido ya estaba lleno, el reembolso puede no aplicar.
      </Section>
      <Section title="3. Partido cancelado por organizador o por no llenarse">
        Si el partido se cancela por el organizador o porque no se completó el cupo mínimo, se inicia proceso de devolución según el método de pago.
      </Section>
      <Section title="4. Tiempos de devolución">
        El tiempo de acreditación depende del proveedor de pagos y del banco emisor. En condiciones normales puede tardar entre 24 y 72 horas hábiles.
      </Section>
      <Section title="5. Soporte">
        Si tu reembolso no refleja avance en ese plazo, contáctanos con el ID del partido y el correo de tu cuenta.
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
