import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad | PadelYa!",
  description: "Cómo PadelYa! recolecta, usa y protege tus datos personales.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10" style={{ color: "var(--text)" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "var(--font-montserrat)", fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.5rem", letterSpacing: "-0.025em" }}>
          Política de privacidad
        </h1>
        <p style={{ color: "var(--text-3)", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}>
          Última actualización: mayo 2026
        </p>
        <p style={{ color: "var(--text-2)", marginTop: "0.75rem", lineHeight: 1.6 }}>
          Tu privacidad es importante para nosotros. Esta política explica qué datos recolectamos, cómo los usamos y cómo los protegemos.
        </p>
      </div>

      <Section title="1. Datos que recolectamos">
        Al usar PadelYa! recolectamos: nombre y apellido, correo electrónico, número de teléfono, foto de perfil (opcional), nivel de juego, historial de partidos y pagos, y eventos de interacción dentro de la plataforma. Si pagas con Wompi, ellos procesan los datos de tu método de pago — nosotros solo recibimos confirmación de la transacción.
      </Section>

      <Section title="2. Cómo usamos tus datos">
        Usamos tu información para: crear y gestionar tu cuenta, mostrar tu perfil a otros jugadores en el contexto de un partido, procesar pagos y reembolsos, enviarte notificaciones sobre partidos (confirmación, cancelación, estado de pago), mostrar estadísticas agregadas de la plataforma, y mejorar la experiencia de usuario.
      </Section>

      <Section title="3. Compartición de datos">
        No vendemos ni alquilamos tus datos. Compartimos información con terceros únicamente cuando es necesario para operar el servicio: Supabase (base de datos e infraestructura), Wompi (procesamiento de pagos), Resend (envío de correos transaccionales), y Vercel (hosting). Todos están sujetos a sus propias políticas de privacidad.
      </Section>

      <Section title="4. Datos visibles para otros usuarios">
        Tu nombre, foto de perfil y nivel de juego son visibles para otros usuarios registrados cuando participan en el mismo partido. Tu correo y teléfono nunca se muestran públicamente en la plataforma.
      </Section>

      <Section title="5. Seguridad">
        Aplicamos controles técnicos estándar de la industria: conexiones cifradas (HTTPS/TLS), políticas de acceso a base de datos por fila (RLS en Supabase), y autenticación segura. Sin embargo, ningún sistema es 100% infalible. Te recomendamos usar una contraseña robusta y no compartir tus credenciales.
      </Section>

      <Section title="6. Retención de datos">
        Conservamos tu información mientras tu cuenta esté activa. Si solicitas eliminar tu cuenta, borraremos tus datos personales salvo los que debamos conservar por obligaciones legales o contables (como registros de transacciones).
      </Section>

      <Section title="7. Tus derechos">
        Tienes derecho a acceder, corregir o eliminar tu información personal. Para ejercer estos derechos, contáctanos directamente. Procesaremos tu solicitud en un plazo razonable según lo exige la Ley 1581 de 2012 (Habeas Data en Colombia).
      </Section>

      <Section title="8. Cambios a esta política">
        Podemos actualizar esta política ocasionalmente. Publicaremos la versión actualizada en esta página con la fecha de última modificación. Para cambios significativos, te notificaremos por correo.
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
