import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { formatCop } from "@/utils/currency";
import { formatDateTime } from "@/utils/dates";
import {
  getPlayerMatchHistory,
  getPublicPlayerProfile,
} from "@/services/players/service";

type Props = { params: Promise<{ playerId: string }> };

const SKILL_LABEL: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

const MATCH_STATUS_LABEL: Record<string, string> = {
  pending_court: "Pendiente de cancha",
  open: "Abierto",
  full: "Lleno",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled_unfilled: "Cancelado por cupo",
  cancelled_by_organizer: "Cancelado por organizador",
};

const PLAYER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pago pendiente",
  paid: "Pagado",
  cancelled: "Cancelado",
  cancelled_late: "Cancelado tarde",
  no_show: "No-show",
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { playerId } = await params;
  const player = await getPublicPlayerProfile(playerId).catch(() => null);
  if (!player) return { title: "Jugador — PadelYa!" };

  const skill = SKILL_LABEL[player.skillLevel] ?? player.skillLevel;
  const description = `${player.fullName} juega pádel en Barranquilla. Nivel ${skill} · ${player.matchesPlayed} partidos jugados.`;

  return {
    title: `${player.fullName} — PadelYa!`,
    description,
    openGraph: {
      title: `${player.fullName} — PadelYa!`,
      description,
      siteName: "PadelYa!",
    },
  };
}

export default async function PublicPlayerPage({ params }: Props) {
  const { playerId } = await params;
  const [player, history] = await Promise.all([
    getPublicPlayerProfile(playerId),
    getPlayerMatchHistory(playerId, 25),
  ]);

  if (!player) notFound();

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto max-w-4xl px-6 py-4">
          <Link href="/players" style={{ color: "var(--text-2)", fontSize: "0.82rem" }}>
            ← Volver a jugadores
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <section
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "1.35rem",
          }}
        >
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <Avatar src={player.avatarUrl} name={player.fullName} size={72} />
            <div style={{ flex: 1, minWidth: "220px" }}>
              <h1
                style={{
                  fontFamily: "var(--font-montserrat)",
                  fontWeight: 800,
                  fontSize: "1.5rem",
                  color: "var(--text)",
                  letterSpacing: "-0.02em",
                }}
              >
                {player.fullName}
              </h1>
              <p style={{ color: "var(--text-2)", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                {SKILL_LABEL[player.skillLevel] ?? player.skillLevel} · Miembro desde{" "}
                {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
                  new Date(player.memberSince),
                )}
              </p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
                <Chip>Nivel: {SKILL_LABEL[player.skillLevel] ?? player.skillLevel}</Chip>
              </div>
            </div>
            {player.whatsappPhone ? (
              <a
                href={`https://wa.me/${normalizePhone(player.whatsappPhone)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: "var(--primary)",
                  color: "#ffffff",
                  borderRadius: "10px",
                  padding: "0.55rem 0.95rem",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  textDecoration: "none",
                }}
              >
                Contactar por WhatsApp
              </a>
            ) : null}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "0.6rem",
              marginTop: "0.95rem",
            }}
          >
            <StatCard label="Partidos jugados" value={player.matchesPlayed.toString()} />
            <StatCard label="Próximos partidos" value={player.upcomingMatches.toString()} />
            <StatCard
              label="Miembro desde"
              value={new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
                new Date(player.memberSince),
              )}
            />
          </div>
        </section>

        <section
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "1.25rem",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-montserrat)",
              fontWeight: 700,
              fontSize: "1.1rem",
              color: "var(--text)",
              marginBottom: "0.85rem",
            }}
          >
            Historial de partidos
          </h2>

          {history.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>
              Este jugador aún no tiene historial visible.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {history.map((item) => (
                <Link
                  key={`${item.matchId}-${item.joinedAt}`}
                  href={`/matches/${item.matchId}`}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "0.75rem",
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                    <p style={{ color: "var(--text)", fontWeight: 600 }}>{item.venueName}</p>
                    <span style={{ color: "var(--gold)", fontSize: "0.82rem" }}>
                      {formatCop(item.orgFeeCop)}
                    </span>
                  </div>
                  <p style={{ color: "var(--text-2)", fontSize: "0.82rem" }}>
                    {formatDateTime(item.scheduledAt)}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Chip>{SKILL_LABEL[item.skillLevel] ?? item.skillLevel}</Chip>
                    <Chip>{MATCH_STATUS_LABEL[item.status] ?? item.status}</Chip>
                    <Chip>{PLAYER_STATUS_LABEL[item.playerStatus] ?? item.playerStatus}</Chip>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.2rem 0.55rem",
        borderRadius: "999px",
        border: "1px solid var(--border)",
        color: "var(--text-2)",
        fontSize: "0.76rem",
      }}
    >
      {children}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "0.6rem 0.7rem",
        background: "var(--surface)",
      }}
    >
      <p style={{ color: "var(--text-3)", fontSize: "0.72rem", marginBottom: "0.2rem" }}>{label}</p>
      <p style={{ color: "var(--text)", fontSize: "0.9rem", fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function Avatar({ src, name, size }: { src?: string | null; name: string; size: number }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        overflow: "hidden",
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--primary-muted)",
        color: "var(--primary)",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {src ? (
        <Image src={src} alt={name} fill style={{ objectFit: "cover" }} sizes={`${size}px`} />
      ) : (
        initials
      )}
    </span>
  );
}

function normalizePhone(phone: string) {
  return phone.replace(/\D+/g, "");
}
