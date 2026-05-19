import Link from "next/link";
import Image from "next/image";
import { listCommunityPlayers } from "@/services/players/service";
import { formatDateTime } from "@/utils/dates";

const SKILL_LABEL: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ skillLevel?: string }>;
};

export default async function PlayersPage({ searchParams }: Props) {
  const { skillLevel } = await searchParams;
  const players = await listCommunityPlayers(36, skillLevel).catch(() => []);

  return (
    <div className="app-page-shell">
      <div className="app-top-section px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <div>
            <h1
              style={{
                fontFamily: "var(--font-montserrat)",
                fontWeight: 800,
                fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
                letterSpacing: "-0.025em",
                color: "var(--text)",
              }}
            >
              Jugadores de la comunidad
            </h1>
            <p style={{ color: "var(--text-2)", marginTop: "0.25rem", fontSize: "0.9rem" }}>
              {players.length} jugador{players.length !== 1 ? "es" : ""}{skillLevel ? ` de nivel ${SKILL_LABEL[skillLevel] ?? skillLevel}` : ""}
            </p>
          </div>

          {/* Skill level filter */}
          <form className="flex flex-wrap gap-2 mt-4">
            <SkillPill value="" current={skillLevel ?? ""} label="Todos" />
            <SkillPill value="beginner" current={skillLevel ?? ""} label="Principiante" />
            <SkillPill value="intermediate" current={skillLevel ?? ""} label="Intermedio" />
            <SkillPill value="advanced" current={skillLevel ?? ""} label="Avanzado" />
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {players.length === 0 ? (
          <div className="banner-warning">Aún no hay jugadores visibles en la comunidad.</div>
        ) : (
          <div className="app-content-frame p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.9rem",
                  textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Avatar src={player.avatarUrl} name={player.fullName} size={44} />
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        color: "var(--text)",
                        fontWeight: 700,
                        fontSize: "0.92rem",
                        fontFamily: "var(--font-dm-sans)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {player.fullName}
                    </p>
                    <p style={{ color: "var(--text-3)", fontSize: "0.78rem" }}>
                      {SKILL_LABEL[player.skillLevel] ?? player.skillLevel}
                    </p>
                  </div>
                </div>
                <p style={{ color: "var(--text-2)", fontSize: "0.78rem" }}>
                  Activo por última vez: {formatDateTime(player.lastSeenAt)}
                </p>
                <span
                  style={{
                    color: "var(--primary)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  Ver perfil →
                </span>
              </Link>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SkillPill({ value, current, label }: { value: string; current: string; label: string }) {
  const isActive = current === value;
  return (
    <button
      type="submit"
      name="skillLevel"
      value={value}
      style={{
        borderRadius: "999px",
        padding: "0.35rem 0.85rem",
        fontSize: "0.82rem",
        fontWeight: isActive ? 600 : 400,
        fontFamily: "var(--font-dm-sans)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
        background: isActive ? "var(--primary-muted)" : "transparent",
        color: isActive ? "var(--primary)" : "var(--text-2)",
      }}
    >
      {label}
    </button>
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
