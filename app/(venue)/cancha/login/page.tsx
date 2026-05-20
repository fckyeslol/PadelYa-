import { redirect } from "next/navigation";
import { getVenueSession } from "@/lib/auth/venue";
import { VenueLoginForm } from "@/components/venue-portal/VenueLoginForm";
import { VP } from "@/components/venue-portal/theme";

export const dynamic = "force-dynamic";

export default async function VenueLoginPage() {
  const session = await getVenueSession();
  if (session) redirect("/cancha");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.25rem",
        background: `linear-gradient(160deg, ${VP.sidebar} 0%, #152238 45%, var(--bg) 45%)`,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: VP.surface,
          borderRadius: "20px",
          border: `1px solid ${VP.border}`,
          padding: "2rem 1.75rem",
          boxShadow: "0 20px 50px rgba(11,23,40,0.18)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <p
            style={{
              fontFamily: VP.fontDisplay,
              fontWeight: 800,
              fontSize: "1.5rem",
              color: VP.primary,
              margin: 0,
            }}
          >
            PadelYa!
          </p>
          <h1
            style={{
              margin: "0.5rem 0 0",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: VP.text,
              fontFamily: VP.fontDisplay,
            }}
          >
            Portal de tu cancha
          </h1>
          <p style={{ margin: "0.45rem 0 0", fontSize: "0.85rem", color: VP.text2 }}>
            Horarios, bloqueos y reservas pagadas
          </p>
        </div>
        <VenueLoginForm />
      </div>
    </div>
  );
}
