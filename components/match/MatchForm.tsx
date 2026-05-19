"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function buildDays(count = 14) {
  const days = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    days.push({
      value: `${yyyy}-${mm}-${dd}`,
      dayName: i === 0 ? "Hoy" : i === 1 ? "Mañana" : DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
      monthName: MONTH_NAMES[d.getMonth()],
      isToday: i === 0,
    });
  }
  return days;
}

const DAYS = buildDays(14);

const TIME_SLOTS = Array.from({ length: 35 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return {
    label: `${h}:${m === 0 ? "00" : "30"}`,
    value: `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`,
  };
});

const DEADLINE_OPTIONS = [
  { label: "2h antes", hours: 2 },
  { label: "4h antes", hours: 4 },
  { label: "12h antes", hours: 12 },
  { label: "24h antes", hours: 24 },
  { label: "48h antes", hours: 48 },
];

const POPULAR_HOURS = ["07:00", "08:00", "18:00", "19:00", "20:00", "21:00"];

function formatSelectedDay(dateValue: string) {
  const d = DAYS.find((day) => day.value === dateValue);
  if (!d) return dateValue;
  return `${d.dayName} ${d.dayNum} ${d.monthName}`;
}

function slotsForDate(dateValue: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const isToday = dateValue === `${yyyy}-${mm}-${dd}`;

  if (!isToday) return TIME_SLOTS;

  const now = new Date();
  return TIME_SLOTS.filter((slot) => {
    const [h, m] = slot.value.split(":").map(Number);
    const slotAt = new Date();
    slotAt.setHours(h, m, 0, 0);
    return slotAt > now;
  });
}

import { ALL_VENUE_NAMES } from "@/config/venues";

const BAQ_VENUES = ALL_VENUE_NAMES;

export function MatchForm() {
  const [venueName, setVenueName] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [showAllTimes, setShowAllTimes] = useState(false);
  const [deadlineHours, setDeadlineHours] = useState(4);
  const [skillLevel, setSkillLevel] = useState("intermediate");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = venueName.trim() && matchDate && matchTime && !pending;

  function submit() {
    startTransition(async () => {
      const scheduledAt = new Date(`${matchDate}T${matchTime}:00`).toISOString();
      const joinDeadline = new Date(
        new Date(scheduledAt).getTime() - deadlineHours * 3_600_000
      ).toISOString();

      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueName,
          scheduledAt,
          joinDeadline,
          skillLevel,
          notes,
        }),
      });

      const payload = (await response.json()) as { id?: string; error?: string; checkoutUrl?: string };
      if (!response.ok || !payload.id || !payload.checkoutUrl) {
        setMessage(payload.error ?? "No fue posible crear el partido");
        return;
      }

      window.location.href = payload.checkoutUrl;
    });
  }

  return (
    <div className="form-card">
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-syne)",
            fontWeight: 800,
            fontSize: "1.5rem",
            letterSpacing: "-0.025em",
            color: "var(--text)",
            marginBottom: "0.3rem",
          }}
        >
          Abrir partido
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
          Completa los datos, confirma tu reserva de cancha y luego publica el partido.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        {/* Venue */}
        <div>
          <label className="form-label" htmlFor="venue">
            Club o cancha
          </label>
          {/* Quick-select chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.6rem" }}>
            {BAQ_VENUES.map((v) => {
              const selected = venueName === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVenueName(selected ? "" : v)}
                  style={{
                    borderRadius: "999px",
                    padding: "0.25rem 0.75rem",
                    fontSize: "0.78rem",
                    fontWeight: selected ? 600 : 400,
                    fontFamily: "var(--font-dm-sans)",
                    cursor: "pointer",
                    transition: "all 0.12s",
                    border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                    background: selected ? "var(--primary-muted)" : "var(--surface)",
                    color: selected ? "var(--primary)" : "var(--text-2)",
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>
          <input
            id="venue"
            className="input-base"
            placeholder="O escribe otro club..."
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
          />
        </div>

        {/* Date strip */}
        <div>
          <label className="form-label">Fecha del partido</label>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              overflowX: "auto",
              paddingBottom: "4px",
              scrollbarWidth: "none",
            }}
          >
            {DAYS.map((d) => {
              const selected = matchDate === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    setMatchDate(d.value);
                    setMatchTime("");
                    setShowAllTimes(false);
                  }}
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "2px",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "12px",
                    border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                    background: selected ? "var(--primary-muted)" : "var(--card)",
                    cursor: "pointer",
                    transition: "border-color 0.12s, background 0.12s",
                    minWidth: "52px",
                  }}
                >
                  <span style={{
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    color: selected ? "var(--primary)" : "var(--text-3)",
                    fontFamily: "var(--font-dm-sans)",
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                  }}>
                    {d.dayName}
                  </span>
                  <span style={{
                    fontSize: "1.15rem",
                    fontWeight: 800,
                    color: selected ? "var(--primary)" : "var(--text)",
                    fontFamily: "var(--font-syne)",
                    lineHeight: 1,
                  }}>
                    {d.dayNum}
                  </span>
                  <span style={{
                    fontSize: "0.65rem",
                    color: selected ? "var(--primary)" : "var(--text-3)",
                    fontFamily: "var(--font-dm-sans)",
                  }}>
                    {d.monthName}
                  </span>
                </button>
              );
            })}
          </div>
          {!matchDate ? (
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.78rem",
                color: "var(--text-3)",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              Elige un día para ver los horarios disponibles.
            </p>
          ) : null}
        </div>

        {matchDate ? (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "0.75rem",
                marginBottom: "0.65rem",
              }}
            >
              <label className="form-label" style={{ marginBottom: 0 }}>
                Hora del partido
              </label>
              <button
                type="button"
                onClick={() => {
                  setMatchDate("");
                  setMatchTime("");
                  setShowAllTimes(false);
                }}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  fontSize: "0.78rem",
                  color: "var(--primary)",
                  fontFamily: "var(--font-dm-sans)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  whiteSpace: "nowrap",
                }}
              >
                Cambiar día
              </button>
            </div>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-2)",
                marginBottom: "0.75rem",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              {formatSelectedDay(matchDate)}
            </p>

            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-3)",
                marginBottom: "0.4rem",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              Horarios populares
            </p>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {POPULAR_HOURS.map((t) => {
                const available = slotsForDate(matchDate).some((s) => s.value === t);
                if (!available) return null;
                const selected = matchTime === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMatchTime(selected ? "" : t)}
                    style={{
                      padding: "0.45rem 0.9rem",
                      borderRadius: "8px",
                      border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                      background: selected ? "var(--primary-muted)" : "var(--card)",
                      color: selected ? "var(--primary)" : "var(--text-2)",
                      fontSize: "0.85rem",
                      fontWeight: selected ? 700 : 500,
                      fontFamily: "var(--font-dm-sans)",
                      cursor: "pointer",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            {showAllTimes ? (
              <>
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-3)",
                    marginBottom: "0.4rem",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  Más horarios
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "0.4rem",
                    overflowX: "auto",
                    paddingBottom: "4px",
                    scrollbarWidth: "thin",
                  }}
                >
                  {slotsForDate(matchDate).map((s) => {
                    const selected = matchTime === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setMatchTime(s.value)}
                        style={{
                          flexShrink: 0,
                          padding: "0.45rem 0.75rem",
                          borderRadius: "8px",
                          border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                          background: selected ? "var(--primary-muted)" : "var(--card)",
                          color: selected ? "var(--primary)" : "var(--text-2)",
                          fontSize: "0.82rem",
                          fontWeight: selected ? 700 : 400,
                          fontFamily: "var(--font-dm-sans)",
                          cursor: "pointer",
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllTimes(false)}
                  style={{
                    marginTop: "0.5rem",
                    border: "none",
                    background: "none",
                    padding: 0,
                    fontSize: "0.78rem",
                    color: "var(--text-3)",
                    fontFamily: "var(--font-dm-sans)",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Ocultar horarios
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowAllTimes(true)}
                style={{
                  padding: "0.5rem 0.875rem",
                  borderRadius: "8px",
                  border: "1px dashed var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-2)",
                  fontSize: "0.82rem",
                  fontFamily: "var(--font-dm-sans)",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Ver más horarios
              </button>
            )}
          </div>
        ) : null}

        {/* Deadline chips */}
        <div>
          <label className="form-label">Límite para unirse</label>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {DEADLINE_OPTIONS.map((o) => {
              const selected = deadlineHours === o.hours;
              return (
                <button
                  key={o.hours}
                  type="button"
                  onClick={() => setDeadlineHours(o.hours)}
                  style={{
                    padding: "0.4rem 0.875rem",
                    borderRadius: "999px",
                    border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                    background: selected ? "var(--primary-muted)" : "var(--card)",
                    color: selected ? "var(--primary)" : "var(--text-2)",
                    fontSize: "0.82rem",
                    fontWeight: selected ? 600 : 400,
                    fontFamily: "var(--font-dm-sans)",
                    cursor: "pointer",
                    transition: "border-color 0.1s, background 0.1s, color 0.1s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Skill level */}
        <div>
          <label className="form-label" htmlFor="skillLevel">
            Nivel de juego
          </label>
          <select
            id="skillLevel"
            className="input-base"
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
          >
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="form-label" htmlFor="notes">
            Notas del partido
            <span style={{ color: "var(--text-3)", fontWeight: 400 }}> — opcional</span>
          </label>
          <textarea
            id="notes"
            className="input-base"
            placeholder="Reglas especiales, equipamiento, indicaciones..."
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: "vertical", minHeight: "80px" }}
          />
        </div>

        {/* Error */}
        {message && (
          <div className="banner-danger">
            {message}
          </div>
        )}

        {/* Submit */}
        <Button
          disabled={!canSubmit}
          onClick={submit}
          size="lg"
          style={{ width: "100%", marginTop: "0.25rem" }}
        >
          {pending ? (
            <>
              <SpinnerIcon />
              Creando partido...
            </>
          ) : (
            "Crear partido"
          )}
        </Button>
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
