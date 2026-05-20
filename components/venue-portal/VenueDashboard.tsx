"use client";

import { useEffect, useState, useTransition } from "react";
import { formatCop } from "@/utils/currency";
import { VenuePageHeader } from "@/components/venue-portal/VenuePageHeader";
import { VP, VP_MATCH_STATUS, VP_SKILL_LABEL } from "@/components/venue-portal/theme";

type TodayMatch = {
  id: string;
  scheduledAt: string;
  status: string;
  skillLevel: string;
  orgFeeCop: number;
  courtName: string;
};

type DashboardData = {
  totalMatches: number;
  monthMatches: number;
  weekMatches: number;
  courts: number;
  todayMatches: TodayMatch[];
};

export function VenueDashboard({ onGoToAgenda }: { onGoToAgenda: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const res = await fetch("/api/cancha/dashboard");
      if (res.status === 401) {
        window.location.href = "/cancha/login";
        return;
      }
      if (!res.ok) {
        setError("No se pudieron cargar las métricas");
        return;
      }
      setData((await res.json()) as DashboardData);
    });
  }, []);

  const todayLabel = new Date().toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const loading = pending && !data;

  return (
    <div style={{ padding: "2.5rem 1.75rem 6rem", maxWidth: "860px" }}>
      <VenuePageHeader title="Resumen" subtitle={todayLabel} />

      {error && (
        <div
          style={{
            padding: "0.85rem 1rem",
            borderRadius: VP.radius,
            background: "rgba(153,27,27,0.07)",
            border: "1px solid rgba(153,27,27,0.15)",
            color: VP.danger,
            fontSize: "0.85rem",
            marginBottom: "1.5rem",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "1rem",
          marginBottom: "2rem",
        }}
        className="sm:grid-cols-4"
      >
        <StatCard label="Próximas reservas" value={data?.totalMatches} loading={loading} accentTop={VP.primary} icon={<IconBookings />} />
        <StatCard label="Este mes" value={data?.monthMatches} loading={loading} accentTop={VP.gold} icon={<IconMonth />} />
        <StatCard label="Esta semana" value={data?.weekMatches} loading={loading} accentTop={VP.info} icon={<IconWeek />} />
        <StatCard label="Canchas activas" value={data?.courts} loading={loading} accentTop={VP.success} icon={<IconCourt />} />
      </div>

      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 700,
              fontFamily: VP.fontDisplay,
              color: VP.text,
            }}
          >
            Agenda de hoy
          </h3>
          <button
            type="button"
            onClick={onGoToAgenda}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: VP.primary,
              fontSize: "0.82rem",
              fontWeight: 600,
              padding: 0,
            }}
          >
            Ver agenda completa →
          </button>
        </div>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: "70px",
                  borderRadius: VP.radius,
                  background: VP.surface,
                  border: `1px solid ${VP.border}`,
                  opacity: 1 - i * 0.2,
                }}
              />
            ))}
          </div>
        )}

        {!loading && data?.todayMatches.length === 0 && (
          <div
            style={{
              padding: "3rem 1.5rem",
              textAlign: "center",
              background: VP.surface,
              borderRadius: VP.radiusLg,
              border: `1px solid ${VP.border}`,
            }}
          >
            <p style={{ margin: 0, color: VP.text2, fontSize: "0.9rem" }}>Sin reservas para hoy</p>
            <button
              type="button"
              onClick={onGoToAgenda}
              style={{
                marginTop: "1rem",
                background: VP.surface,
                border: `1px solid ${VP.border}`,
                borderRadius: "8px",
                padding: "0.45rem 1rem",
                fontSize: "0.82rem",
                color: VP.text2,
                cursor: "pointer",
              }}
            >
              Gestionar agenda
            </button>
          </div>
        )}

        {!loading && data && data.todayMatches.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {data.todayMatches.map((match) => {
              const cfg = VP_MATCH_STATUS[match.status] ?? {
                label: match.status,
                color: VP.text3,
                bg: "rgba(100,116,139,0.1)",
              };
              const time = new Date(match.scheduledAt).toLocaleTimeString("es-CO", {
                timeZone: "America/Bogota",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={match.id}
                  style={{
                    background: VP.surface,
                    borderRadius: VP.radius,
                    border: `1px solid ${VP.border}`,
                    padding: "0.9rem 1.1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <div
                    style={{
                      minWidth: "56px",
                      textAlign: "center",
                      background: VP.primaryMuted,
                      borderRadius: "9px",
                      padding: "0.45rem 0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: VP.text,
                        fontFamily: VP.fontDisplay,
                      }}
                    >
                      {time}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: VP.text, marginBottom: "0.15rem" }}>
                      {match.courtName}
                    </div>
                    <div style={{ fontSize: "0.77rem", color: VP.text2 }}>
                      {VP_SKILL_LABEL[match.skillLevel] ?? match.skillLevel}
                      {" · "}
                      {formatCop(match.orgFeeCop)}/jug.
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      padding: "0.25rem 0.65rem",
                      borderRadius: "999px",
                      whiteSpace: "nowrap",
                      color: cfg.color,
                      background: cfg.bg,
                    }}
                  >
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  accentTop,
  icon,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  accentTop: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: VP.surface,
        borderRadius: VP.radiusLg,
        border: `1px solid ${VP.border}`,
        padding: "1.3rem 1.25rem 1.25rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: accentTop,
          borderRadius: `${VP.radiusLg} ${VP.radiusLg} 0 0`,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.85rem",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.72rem",
            fontWeight: 600,
            color: VP.text3,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          {label}
        </p>
        <span style={{ color: accentTop, opacity: 0.55 }}>{icon}</span>
      </div>
      {loading ? (
        <div style={{ height: "36px", width: "45%", borderRadius: "6px", background: "var(--card-hover)" }} />
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: "2.1rem",
            fontWeight: 700,
            fontFamily: VP.fontDisplay,
            color: VP.text,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {value ?? 0}
        </p>
      )}
    </div>
  );
}

function IconBookings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconMonth() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}

function IconWeek() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconCourt() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M12 8a4 4 0 0 1 0 8" />
      <path d="M12 8a4 4 0 0 0 0 8" />
    </svg>
  );
}
