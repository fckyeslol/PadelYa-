import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getMatchById } from "@/services/matches/service";
import { formatDateTime } from "@/utils/dates";
import { ConfirmCourtForm } from "./ConfirmCourtForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ matchId: string }> };

/** Map venue name keywords to their booking platform URL */
function getBookingLinks(venueName: string): { label: string; url: string; icon: string }[] {
  const name = venueName.toLowerCase();
  const links: { label: string; url: string; icon: string }[] = [];

  if (name.includes("casa padel") || name.includes("casapadel")) {
    links.push({
      label: "Reservar en Casa Padel",
      url: "https://www.reservadeportes.com/calendario/CasaPadel/9/",
      icon: "R",
    });
  } else if (
    name.includes("la jaula") ||
    name.includes("padel park") ||
    name.includes("padel zenter") ||
    name.includes("ace padel") ||
    name.includes("x3 padel") ||
    name.includes("x3 pádel")
  ) {
    links.push({
      label: "Reservar en EasyCancha",
      url: "https://app.easycancha.com/book/slots",
      icon: "E",
    });
  }

  // Always add a Google search fallback
  links.push({
    label: "Buscar en Google Maps",
    url: `https://www.google.com/maps/search/${encodeURIComponent(venueName + " Barranquilla")}`,
    icon: "G",
  });

  return links;
}

export default async function ConfirmCourtPage({ params }: Props) {
  const { matchId } = await params;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const match = await getMatchById(matchId).catch(() => null);
  if (!match) return notFound();

  // Only the host can see this page
  if (match.hostPlayerId !== user.id) redirect(`/matches/${matchId}`);

  // If already activated, go to the match page
  if (match.status !== "pending_court") redirect(`/matches/${matchId}`);

  const bookingLinks = getBookingLinks(match.venueName);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-lg px-5 py-10" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Progress indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Step n={1} done label="Datos del partido" />
          <div style={{ flex: 1, height: "2px", background: "var(--primary)", borderRadius: "1px" }} />
          <Step n={2} active label="Reservar cancha" />
          <div style={{ flex: 1, height: "2px", background: "var(--border)", borderRadius: "1px" }} />
          <Step n={3} label="¡Listo!" />
        </div>

        {/* Header */}
        <div>
          <h1
            style={{
              fontFamily: "var(--font-syne)",
              fontWeight: 800,
              fontSize: "1.6rem",
              letterSpacing: "-0.03em",
              color: "var(--text)",
              marginBottom: "0.4rem",
            }}
          >
            Reserva la cancha
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Ve a la plataforma de reservas, elige tu hora y vuelve aquí con el
            número de confirmación para publicar el partido.
          </p>
        </div>

        {/* Match summary */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
          }}
        >
          <p
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              color: "var(--text-2)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            Tu partido
          </p>
          <p
            style={{
              fontFamily: "var(--font-syne)",
              fontWeight: 700,
              fontSize: "1.1rem",
              color: "var(--text)",
            }}
          >
            {match.venueName}
          </p>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
            {formatDateTime(match.scheduledAt)}
          </p>
        </div>

        {/* Booking platform links */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p
            style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "var(--text-2)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            Paso 1 — Reserva en la plataforma
          </p>
          {bookingLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.875rem",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                padding: "1rem 1.125rem",
                color: "var(--text)",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
                transition: "border-color 0.15s, background 0.15s",
              }}
              className="hover:border-[var(--primary)] hover:bg-[var(--card-hover,var(--card))]"
            >
              <span
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "var(--text-2)",
                  flexShrink: 0,
                }}
              >
                {link.icon}
              </span>
              <span style={{ flex: 1 }}>{link.label}</span>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--text-3)", flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          ))}
        </div>

        {/* Confirm form */}
        <ConfirmCourtForm matchId={matchId} />
      </div>
    </div>
  );
}

function Step({
  n,
  label,
  done,
  active,
}: {
  n: number;
  label: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem", minWidth: "4rem" }}>
      <span
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.75rem",
          fontWeight: 700,
          background: done
            ? "var(--primary)"
            : active
              ? "var(--primary)"
              : "var(--surface)",
          border: done || active ? "none" : "1px solid var(--border)",
          color: done || active ? "#ffffff" : "var(--text-2)",
        }}
      >
        {done ? "✓" : n}
      </span>
      <span
        style={{
          fontSize: "0.65rem",
          color: active ? "var(--primary)" : "var(--text-3)",
          fontWeight: active ? 600 : 400,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
    </div>
  );
}
