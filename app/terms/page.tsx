import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de servicio | PadelYa!",
  description: "Términos de servicio de PadelYa! para jugadores y organizadores.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10" style={{ color: "var(--text)" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "var(--font-montserrat)", fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.5rem", letterSpacing: "-0.025em" }}>
          Términos de servicio
        </h1>
        <p style={{ color: "var(--text-3)", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}>
          Última actualización: mayo 2026
        </p>
        <p style={{ color: "var(--text-2)", marginTop: "0.75rem", lineHeight: 1.6 }}>
          Al usar PadelYa! aceptas estas condiciones. Si no estás de acuerdo, por favor no uses la plataforma.
        </p>
      </div>

      <Section title="1. Quiénes somos">
        PadelYa! es una plataforma digital que conecta jugadores de pádel en Barranquilla, Colombia, facilitando la organización de partidos, la reserva de cupos y el procesamiento de pagos. No somos un club deportivo ni propietarios de las canchas.
      </Section>

      <Section title="2. Uso de la plataforma">
        Debes tener al menos 18 años para crear una cuenta. Eres responsable de mantener tu información de perfil actualizada y veraz. Está prohibido usar la plataforma para actividades fraudulentas, revender cupos o acosar a otros usuarios. Nos reservamos el derecho de suspender cuentas que incumplan estas reglas.
      </Section>

      <Section title="3. Reserva de cupos y pagos">
        Un cupo queda reservado únicamente cuando el pago es aprobado por Mercado Pago (nuestro proveedor de pagos). Los pagos se procesan en pesos colombianos (COP). El valor incluye la cuota del partido más la tarifa de servicio de la plataforma. Si el pago se rechaza o se anula, el cupo vuelve a estar disponible para otros jugadores.
      </Section>

      <Section title="4. Cancelaciones y reembolsos">
        Las cancelaciones están sujetas a nuestra Política de Reembolsos. En resumen: cancelaciones con más de 3 horas de anticipación y con el partido no lleno aplican para reembolso manual; cancelaciones tardías o cuando el partido ya está lleno no aplican para reembolso. Consulta la política completa en /refund-policy.
      </Section>

      <Section title="5. Conducta en cancha">
        PadelYa! no tiene control sobre lo que ocurre dentro de las canchas. Los jugadores son responsables de su comportamiento durante el partido. El no-show reiterado (marcar asistencia y no presentarse) puede resultar en restricciones a la cuenta.
      </Section>

      <Section title="6. Responsabilidad limitada">
        PadelYa! actúa como intermediario. No somos responsables por lesiones, daños a la propiedad, disputas entre jugadores o problemas con las instalaciones deportivas. El uso de las canchas está sujeto a las reglas del establecimiento donde se juega.
      </Section>

      <Section title="7. Propiedad intelectual">
        El nombre, logo y diseño de PadelYa! son propiedad de sus creadores. No puedes reproducir o usar nuestra marca sin autorización escrita.
      </Section>

      <Section title="8. Modificaciones">
        Podemos actualizar estos términos para reflejar mejoras del servicio o cambios regulatorios. Notificaremos cambios relevantes por correo o mediante aviso en la app. La versión publicada en esta página es siempre la vigente.
      </Section>

      <Section title="9. Ley aplicable">
        Estos términos se rigen por las leyes de la República de Colombia. Cualquier disputa se resolverá en los tribunales competentes de Barranquilla.
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "1rem", padding: "1.25rem 1.5rem", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--card)" }}>
      <h2 style={{ fontWeight: 700, marginBottom: "0.6rem", fontSize: "0.95rem", fontFamily: "var(--font-montserrat)", color: "var(--text)" }}>{title}</h2>
      <p style={{ color: "var(--text-2)", lineHeight: 1.7, fontSize: "0.9rem", fontFamily: "var(--font-dm-sans)" }}>{children}</p>
    </section>
  );
}
