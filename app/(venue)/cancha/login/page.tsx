import { redirect } from "next/navigation";
import { getVenueSession } from "@/lib/auth/venue";
import { VenueLoginForm } from "@/components/venue-portal/VenueLoginForm";

export const dynamic = "force-dynamic";

export default async function VenueLoginPage() {
  const session = await getVenueSession();
  if (session) redirect("/cancha");

  return (
    <div
      className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col items-center justify-center px-6 py-12"
    >
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <p
          style={{
            fontFamily: "var(--font-montserrat)",
            fontWeight: 800,
            fontSize: "1.75rem",
            color: "var(--primary)",
            margin: 0,
          }}
        >
          PadelYa!
        </p>
        <h1 style={{ margin: "0.5rem 0 0", fontSize: "1.15rem", color: "var(--text)" }}>
          Portal de tu cancha
        </h1>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.88rem", color: "var(--text-2)" }}>
          Administra horarios, bloqueos y reservas pagadas.
        </p>
      </div>
      <VenueLoginForm />
    </div>
  );
}
