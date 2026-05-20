"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { getPricingCalendarDates } from "@/config/pricing";
import type { VenueDaySchedule } from "@/services/venue-portal/schedule";
import { VenueBookingDetail } from "@/components/venue-portal/VenueBookingDetail";
import { VenueLogoutButton } from "@/components/venue-portal/VenueLogoutButton";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function buildDays() {
  const todayStr = new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).slice(0, 10);
  return getPricingCalendarDates()
    .filter((d) => d >= todayStr)
    .map((value) => {
      const [y, m, d] = value.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const isToday = value === todayStr;
      return {
        value,
        label: isToday
          ? "Hoy"
          : `${DAY_NAMES[dateObj.getDay()]} ${d} ${MONTH_NAMES[m - 1]}`,
      };
    });
}

const STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  available: { bg: "rgba(16,185,129,0.15)", label: "Libre" },
  blocked: { bg: "rgba(251,191,36,0.2)", label: "Bloqueado" },
  booked: { bg: "rgba(59,130,246,0.2)", label: "Reservado" },
};

type SelectedSlot = {
  courtId: string;
  courtName: string;
  date: string;
  time: string;
  status: string;
  blockId?: string;
};

type Props = {
  venueName: string;
};

export function VenueScheduleBoard({ venueName }: Props) {
  const days = useMemo(() => buildDays(), []);
  const [date, setDate] = useState(days[0]?.value ?? "");
  const [schedule, setSchedule] = useState<VenueDaySchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedSlot | null>(null);
  const [pending, startTransition] = useTransition();

  const loadSchedule = useCallback(() => {
    if (!date) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/cancha/schedule?date=${date}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/cancha/login";
          return;
        }
        setError(data.error ?? "Error al cargar agenda");
        return;
      }
      setSchedule(data as VenueDaySchedule);
    });
  }, [date]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  function handleSlotClick(
    courtId: string,
    courtName: string,
    time: string,
    status: string,
    blockId?: string,
  ) {
    if (status === "booked") {
      setSelected({ courtId, courtName, date, time, status });
      return;
    }

    if (status === "available") {
      if (!confirm(`¿Bloquear ${courtName} el ${time}? Los jugadores no podrán reservar ese horario en esa cancha.`)) {
        return;
      }
      startTransition(async () => {
        const res = await fetch("/api/cancha/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courtId, date, time }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error ?? "No se pudo bloquear");
          return;
        }
        loadSchedule();
      });
      return;
    }

    if (status === "blocked" && blockId) {
      if (!confirm(`¿Quitar bloqueo de ${courtName} a las ${time}?`)) return;
      startTransition(async () => {
        const res = await fetch("/api/cancha/blocks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error ?? "No se pudo desbloquear");
          return;
        }
        loadSchedule();
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-3)" }}>Portal de cancha</p>
          <h1 style={{ margin: "0.15rem 0 0", fontSize: "1.5rem" }}>{venueName}</h1>
        </div>
        <VenueLogoutButton />
      </header>

      <p style={{ color: "var(--text-2)", fontSize: "0.88rem", marginBottom: "1rem" }}>
        Toca un horario libre para bloquearlo, uno bloqueado para liberarlo, o uno reservado para ver
        los jugadores.
      </p>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        {days.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDate(d.value)}
            style={{
              flexShrink: 0,
              padding: "0.5rem 0.85rem",
              borderRadius: "999px",
              border: date === d.value ? "2px solid var(--primary)" : "1px solid var(--border)",
              background: date === d.value ? "rgba(16,185,129,0.12)" : "var(--surface)",
              color: "var(--text)",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {pending && !schedule && <p style={{ color: "var(--text-2)" }}>Cargando agenda…</p>}

      {schedule && schedule.times.length === 0 && (
        <p style={{ color: "var(--text-2)" }}>No hay horarios en el calendario para esta fecha.</p>
      )}

      {schedule && schedule.times.length > 0 && (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "12px" }}>
          <table style={{ borderCollapse: "collapse", minWidth: "100%", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ background: "var(--surface)" }}>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    background: "var(--surface)",
                    padding: "0.6rem 0.75rem",
                    textAlign: "left",
                    borderBottom: "1px solid var(--border)",
                    minWidth: "100px",
                  }}
                >
                  Cancha
                </th>
                {schedule.times.map((t) => (
                  <th
                    key={t}
                    style={{
                      padding: "0.5rem 0.35rem",
                      borderBottom: "1px solid var(--border)",
                      fontWeight: 500,
                      color: "var(--text-2)",
                      minWidth: "52px",
                    }}
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.courts.map((court) => (
                <tr key={court.courtId}>
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      background: "var(--bg)",
                      padding: "0.6rem 0.75rem",
                      fontWeight: 600,
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {court.courtName}
                  </td>
                  {court.slots.map((slot) => {
                    const st = STATUS_STYLE[slot.status];
                    return (
                      <td
                        key={slot.time}
                        style={{ padding: "0.25rem", borderBottom: "1px solid var(--border)" }}
                      >
                        <button
                          type="button"
                          title={st.label}
                          disabled={pending}
                          onClick={() =>
                            handleSlotClick(
                              court.courtId,
                              court.courtName,
                              slot.time,
                              slot.status,
                              slot.blockId,
                            )
                          }
                          style={{
                            width: "100%",
                            minHeight: "36px",
                            borderRadius: "6px",
                            border: "none",
                            background: st.bg,
                            cursor: "pointer",
                            fontSize: "0.65rem",
                            color: "var(--text-2)",
                          }}
                        >
                          {slot.status === "booked" ? "●" : slot.status === "blocked" ? "■" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginTop: "1rem",
          fontSize: "0.8rem",
          color: "var(--text-2)",
          flexWrap: "wrap",
        }}
      >
        <span>■ Bloqueado manualmente</span>
        <span>● Reserva PadelYa!</span>
        <span>Celda vacía = disponible</span>
      </div>

      {selected?.status === "booked" && (
        <VenueBookingDetail
          courtId={selected.courtId}
          date={selected.date}
          time={selected.time}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
