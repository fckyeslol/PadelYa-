"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { getPricingCalendarDates } from "@/config/pricing";
import type { VenueDaySchedule } from "@/services/venue-portal/schedule";
import { VenueBookingDetail } from "@/components/venue-portal/VenueBookingDetail";
import { VenuePageHeader } from "@/components/venue-portal/VenuePageHeader";
import { VP, VP_SLOT } from "@/components/venue-portal/theme";

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

type SelectedSlot = {
  courtId: string;
  courtName: string;
  date: string;
  time: string;
  status: string;
  blockId?: string;
};

type Props = {
  /** Dentro de VenuePortalShell: sin header ni logout duplicados */
  embedded?: boolean;
};

export function VenueScheduleBoard({ embedded = false }: Props) {
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
      if (
        !confirm(
          `¿Bloquear ${courtName} a las ${time}?\n\nEsa cancha quedará bloqueada. Si todas las canchas a esa hora están bloqueadas o reservadas, los jugadores no podrán reservar.`,
        )
      ) {
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

  const todayLabel = new Date().toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      style={{
        padding: embedded ? "2.5rem 1.75rem 6rem" : "1.5rem 1rem 5rem",
        maxWidth: embedded ? "1100px" : "72rem",
        margin: embedded ? undefined : "0 auto",
      }}
      className={embedded ? undefined : "mx-auto w-full px-4 md:px-6"}
    >
      <VenuePageHeader
        title="Agenda"
        subtitle={embedded ? undefined : todayLabel}
      />

      <p style={{ color: VP.text2, fontSize: "0.88rem", marginBottom: "1.25rem", marginTop: embedded ? "-0.5rem" : 0 }}>
        Toca un horario libre para bloquearlo, uno bloqueado para liberarlo, o uno reservado para ver
        los jugadores.
      </p>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "0.5rem",
          marginBottom: "1.25rem",
        }}
      >
        {days.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDate(d.value)}
            style={{
              flexShrink: 0,
              padding: "0.5rem 0.9rem",
              borderRadius: "999px",
              border: date === d.value ? `2px solid ${VP.primary}` : `1px solid ${VP.border}`,
              background: date === d.value ? VP.primaryMuted : VP.surface,
              color: VP.text,
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: date === d.value ? 600 : 400,
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            padding: "0.85rem 1rem",
            borderRadius: VP.radius,
            background: "rgba(153,27,27,0.07)",
            border: "1px solid rgba(153,27,27,0.15)",
            color: VP.danger,
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {pending && !schedule && (
        <p style={{ color: VP.text2, fontSize: "0.9rem" }}>Cargando agenda…</p>
      )}

      {schedule && schedule.times.length === 0 && (
        <div
          style={{
            padding: "2.5rem",
            textAlign: "center",
            background: VP.surface,
            borderRadius: VP.radiusLg,
            border: `1px solid ${VP.border}`,
          }}
        >
          <p style={{ margin: 0, color: VP.text2 }}>No hay horarios en el calendario para esta fecha.</p>
        </div>
      )}

      {schedule && schedule.times.length > 0 && (
        <div
          style={{
            overflowX: "auto",
            background: VP.surface,
            border: `1px solid ${VP.border}`,
            borderRadius: VP.radiusLg,
            boxShadow: "0 1px 3px rgba(15,22,41,0.04)",
          }}
        >
          <table style={{ borderCollapse: "collapse", minWidth: "100%", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ background: "var(--card-hover)" }}>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    background: "var(--card-hover)",
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    borderBottom: `1px solid ${VP.border}`,
                    minWidth: "110px",
                    color: VP.text2,
                    fontWeight: 600,
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Cancha
                </th>
                {schedule.times.map((t) => (
                  <th
                    key={t}
                    style={{
                      padding: "0.55rem 0.35rem",
                      borderBottom: `1px solid ${VP.border}`,
                      fontWeight: 500,
                      color: VP.text3,
                      minWidth: "48px",
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
                      background: VP.surface,
                      padding: "0.65rem 1rem",
                      fontWeight: 600,
                      borderBottom: `1px solid ${VP.border}`,
                      whiteSpace: "nowrap",
                      color: VP.text,
                    }}
                  >
                    {court.courtName}
                  </td>
                  {court.slots.map((slot) => {
                    const st = VP_SLOT[slot.status];
                    return (
                      <td
                        key={slot.time}
                        style={{ padding: "0.3rem", borderBottom: `1px solid ${VP.border}` }}
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
                            minHeight: "38px",
                            borderRadius: "8px",
                            border: `1px solid ${st.border}`,
                            background: st.bg,
                            cursor: "pointer",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            color: VP.text2,
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
          gap: "1.25rem",
          marginTop: "1.25rem",
          fontSize: "0.8rem",
          color: VP.text3,
          flexWrap: "wrap",
        }}
      >
        <span>■ Bloqueado</span>
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
