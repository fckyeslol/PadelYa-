import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { listCommunityPlayers } from "@/services/players/service";
import { formatDateTime } from "@/utils/dates";

function IconFlame({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function IconTrophy({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  );
}

function IconUsers({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const SKILL_LABEL: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

const SKILL_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  beginner:     { bg: "rgba(29,78,216,0.08)",  color: "#1D4ED8", border: "rgba(29,78,216,0.2)" },
  intermediate: { bg: "rgba(22,101,52,0.08)",  color: "#166534", border: "rgba(22,101,52,0.2)" },
  advanced:     { bg: "rgba(212,137,26,0.08)", color: "#D4891A", border: "rgba(212,137,26,0.2)" },
};

const AVAILABILITY_COLOR = { high: "#166534", medium: "#D4891A", low: "#64748B" };

function getAvailability(lastSeenAt: string): "high" | "medium" | "low" {
  const hours = (Date.now() - new Date(lastSeenAt).getTime()) / 3_600_000;
  if (hours <= 24) return "high";
  if (hours <= 168) return "medium";
  return "low";
}

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ skillLevel?: string }>;
};

export default async function PlayersPage({ searchParams }: Props) {
  const { skillLevel } = await searchParams;
  const players = await listCommunityPlayers(36, skillLevel).catch(() => []);

  return (
    <div className="app-page-shell">
      <div className="app-top-section px-6 pt-8 pb-6">
        <div className="mx-auto max-w-5xl">

          {/* Title with accent bar */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1.75rem" }}>
            <div style={{ width: 4, height: 52, background: "var(--primary)", borderRadius: 999, flexShrink: 0 }} />
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
                {players.length} jugador{players.length !== 1 ? "es" : ""}
                {skillLevel ? ` de nivel ${SKILL_LABEL[skillLevel] ?? skillLevel}` : " activos"}
              </p>
            </div>
          </div>

          {/* Community stats */}
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <StatCard
              icon={<span style={{ color: "var(--primary)" }}><IconFlame /></span>}
              iconBg="var(--primary-muted)"
              value="127"
              label="Jugadores online ahora"
            />
            <StatCard
              icon={<span style={{ color: "var(--gold)" }}><IconTrophy /></span>}
              iconBg="var(--gold-muted)"
              value="1,834"
              label="Partidos jugados hoy"
            />
            <StatCard
              icon={<span style={{ color: "var(--success)" }}><IconUsers /></span>}
              iconBg="rgba(22,101,52,0.08)"
              value="92%"
              label="Encuentran compañero en 24h"
            />
          </div>

          {/* Skill level filter */}
          <div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-2)", marginBottom: "0.6rem" }}>Filtrar por nivel</p>
            <form className="flex flex-wrap gap-2">
              <SkillPill value=""             current={skillLevel ?? ""} label="Todos" />
              <SkillPill value="beginner"     current={skillLevel ?? ""} label="Principiante" />
              <SkillPill value="intermediate" current={skillLevel ?? ""} label="Intermedio" />
              <SkillPill value="advanced"     current={skillLevel ?? ""} label="Avanzado" />
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {players.length === 0 ? (
          <div className="banner-warning">Aún no hay jugadores visibles en la comunidad.</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => {
              const availability = getAvailability(player.lastSeenAt);
              const skill = SKILL_STYLE[player.skillLevel] ?? SKILL_STYLE.intermediate;
              return (
                <Link
                  key={player.id}
                  href={`/players/${player.id}`}
                  className="card-lift group"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: "1.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    textDecoration: "none",
                  }}
                >
                  {/* Avatar + name + level */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <Avatar src={player.avatarUrl} name={player.fullName} size={64} />
                      <span
                        style={{
                          position: "absolute",
                          bottom: 2,
                          right: 2,
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: AVAILABILITY_COLOR[availability],
                          border: "2.5px solid #ffffff",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          color: "var(--text)",
                          fontWeight: 700,
                          fontSize: "1rem",
                          fontFamily: "var(--font-dm-sans)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginBottom: "0.4rem",
                        }}
                      >
                        {player.fullName}
                      </p>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0.2rem 0.6rem",
                          borderRadius: 6,
                          border: `1px solid ${skill.border}`,
                          background: skill.bg,
                          color: skill.color,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        {SKILL_LABEL[player.skillLevel] ?? player.skillLevel}
                      </span>
                    </div>
                  </div>

                  {/* Last active */}
                  <p style={{ color: "var(--text-3)", fontSize: "0.78rem" }}>
                    Activo: {formatDateTime(player.lastSeenAt)}
                  </p>

                  {/* CTA button */}
                  <div
                    style={{
                      background: "var(--primary)",
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "0.65rem 1rem",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      fontFamily: "var(--font-dm-sans)",
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.4rem",
                    }}
                  >
                    Ver perfil <span>→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: ReactNode;
  iconBg: string;
  value: string;
  label: string;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        boxShadow: "0 1px 3px rgba(15,22,41,0.05)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: "0.78rem", color: "var(--text-2)", marginTop: "0.2rem" }}>{label}</p>
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
        borderRadius: 8,
        padding: "0.45rem 1.1rem",
        fontSize: "0.85rem",
        fontWeight: isActive ? 600 : 400,
        fontFamily: "var(--font-dm-sans)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
        background: isActive ? "var(--primary)" : "var(--surface)",
        color: isActive ? "#ffffff" : "var(--text-2)",
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
        fontSize: size > 50 ? "1.1rem" : "0.85rem",
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
