"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  getAvailableTimeSlotsWithDuration,
  getPlayerFeeByVenueNameWithDuration,
  hasPricingForVenueName,
  isRuleBasedVenueName,
  PRICED_VENUE_NAMES,
} from "@/config/pricing";
import { formatCop } from "@/utils/currency";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function buildDays(count = 30) {
  const todayStr = new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).slice(0, 10);
  const today = new Date(`${todayStr}T12:00:00`);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const value = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = i === 0;
    const isTomorrow = i === 1;
    return {
      value,
      dayName: isToday ? "Hoy" : isTomorrow ? "Mañana" : DAY_NAMES[d.getDay()],
      dayNum: day,
      monthName: MONTH_NAMES[m - 1],
      isToday,
    };
  });
}

const DAYS = buildDays();

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
  const todayStr = new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).slice(0, 10);
  const isToday = dateValue === todayStr;

  if (!isToday) return TIME_SLOTS;

  const nowBogota = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }),
  );
  return TIME_SLOTS.filter((slot) => {
    const [h, m] = slot.value.split(":").map(Number);
    const slotAt = new Date(nowBogota);
    slotAt.setHours(h, m, 0, 0);
    return slotAt > nowBogota;
  });
}

const SHOWN_VENUES = new Set(["Casa Padel", "X3 Pádel Club", "La Jaula"]);
const BAQ_VENUES = PRICED_VENUE_NAMES.filter((v) => SHOWN_VENUES.has(v));

function playerFeeForSlot(
  venueName: string,
  date: string,
  time: string,
  durationMinutes: 60 | 90,
): number | null {
  if (!venueName.trim()) return null;
  return getPlayerFeeByVenueNameWithDuration(venueName.trim(), date, time, durationMinutes);
}

function slotsForVenueAndDate(
  venueName: string,
  dateValue: string,
  bookableTimes: Set<string> | null,
  durationMinutes: 60 | 90,
  isRuleBased: boolean,
) {
  const priced = getAvailableTimeSlotsWithDuration(venueName, dateValue, durationMinutes);
  if (!priced.length) return [];

  const allowed = new Set(priced);
  let base = slotsForDate(dateValue).filter((s) => allowed.has(s.value));

  // Rule-based venues (Ace, X3) don't use the EasyCancha availability API
  if (!isRuleBased) {
    if (bookableTimes === null) return [];
    base = base.filter((s) => bookableTimes.has(s.value));
  }

  return base;
}

const ROW: React.CSSProperties = {
  paddingTop: "1.25rem",
  paddingBottom: "1.25rem",
  borderBottom: "1px solid var(--border)",
};

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: "0.68rem",
  fontWeight: 400,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  marginBottom: "0.65rem",
  fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)",
};

export function MatchForm() {
  const [venueName, setVenueName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<60 | 90>(90);
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [showAllTimes, setShowAllTimes] = useState(false);
  const [deadlineHours, setDeadlineHours] = useState(4);
  const [skillLevel, setSkillLevel] = useState("intermediate");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [bookableTimes, setBookableTimes] = useState<Set<string> | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const isRuleBased = isRuleBasedVenueName(venueName);

  useEffect(() => {
    // Rule-based venues don't use the EasyCancha availability API
    if (!venueName.trim() || !matchDate || isRuleBased) {
      setBookableTimes(null);
      return;
    }
    let cancelled = false;
    setAvailabilityLoading(true);
    fetch(
      `/api/venues/slot-availability?venueName=${encodeURIComponent(venueName.trim())}&date=${encodeURIComponent(matchDate)}`,
    )
      .then((res) => res.json())
      .then((data: { bookableTimes?: string[] }) => {
        if (!cancelled) {
          setBookableTimes(new Set(data.bookableTimes ?? []));
        }
      })
      .catch(() => {
        if (!cancelled) setBookableTimes(new Set());
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [venueName, matchDate, isRuleBased]);

  const hasPricedVenue = hasPricingForVenueName(venueName);
  const availableSlots =
    venueName.trim() && matchDate
      ? slotsForVenueAndDate(venueName, matchDate, bookableTimes, durationMinutes, isRuleBased)
      : [];
  const selectedPlayerFee =
    matchDate && matchTime && hasPricedVenue
      ? playerFeeForSlot(venueName, matchDate, matchTime, durationMinutes)
      : null;
  const canSubmit =
    hasPricedVenue && matchDate && matchTime && selectedPlayerFee != null && !pending;

  function submit() {
    startTransition(async () => {
      const scheduledAt = new Date(`${matchDate}T${matchTime}:00-05:00`).toISOString();
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
          durationMinutes,
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
    <div>
      {/* ── Club ─────────────────────────────────────── */}
      <div style={ROW}>
        <p style={LABEL}>Club o cancha</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.6rem" }}>
          {BAQ_VENUES.map((v) => {
            const selected = venueName === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setVenueName(selected ? "" : v);
                  setMatchDate("");
                  setMatchTime("");
                  setDurationMinutes(90);
                }}
                style={{
                  borderRadius: "4px",
                  padding: "0.3rem 0.85rem",
                  fontSize: "0.82rem",
                  fontWeight: selected ? 600 : 400,
                  fontFamily: "var(--font-dm-sans)",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                  background: selected ? "var(--primary)" : "transparent",
                  color: selected ? "var(--primary-fg)" : "var(--text-2)",
                }}
              >
                {v}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--text-3)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
          Tarifas EasyCancha, Casa Padel, Ace Padel Club y X3 Pádel Club.
        </p>
      </div>

      {/* ── Duración (rule-based) ────────────────────── */}
      {isRuleBased ? (
        <div style={ROW}>
          <p style={LABEL}>Duración del partido</p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {([60, 90] as const).map((dur) => {
              const selected = durationMinutes === dur;
              return (
                <button
                  key={dur}
                  type="button"
                  onClick={() => {
                    setDurationMinutes(dur);
                    setMatchTime("");
                  }}
                  style={{
                    padding: "0.3rem 0.85rem",
                    borderRadius: "4px",
                    border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                    background: selected ? "var(--primary)" : "transparent",
                    color: selected ? "var(--primary-fg)" : "var(--text-2)",
                    fontSize: "0.82rem",
                    fontWeight: selected ? 600 : 400,
                    fontFamily: "var(--font-dm-sans)",
                    cursor: "pointer",
                    transition: "border-color 0.1s, background 0.1s, color 0.1s",
                  }}
                >
                  {dur === 60 ? "1 hora" : "1.5 horas"}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── Fecha ────────────────────────────────────── */}
      <div style={ROW}>
        <p style={LABEL}>Fecha del partido</p>
        <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "4px", scrollbarWidth: "none" }}>
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
                  borderRadius: "6px",
                  border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                  background: selected ? "var(--primary)" : "transparent",
                  cursor: "pointer",
                  transition: "border-color 0.12s, background 0.12s",
                  minWidth: "52px",
                }}
              >
                <span style={{
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  color: selected ? "var(--primary-fg)" : "var(--text-3)",
                  fontFamily: "var(--font-dm-sans)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}>
                  {d.dayName}
                </span>
                <span style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: selected ? "var(--primary-fg)" : "var(--text)",
                  fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)",
                  lineHeight: 1,
                }}>
                  {d.dayNum}
                </span>
                <span style={{
                  fontSize: "0.62rem",
                  color: selected ? "var(--primary-fg)" : "var(--text-3)",
                  fontFamily: "var(--font-dm-sans)",
                }}>
                  {d.monthName}
                </span>
              </button>
            );
          })}
        </div>
        {!matchDate ? (
          <p style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--text-3)", fontFamily: "var(--font-dm-sans)" }}>
            Elige un día para ver los horarios disponibles.
          </p>
        ) : null}
      </div>

      {matchDate && venueName.trim() && !hasPricedVenue ? (
        <div style={{ paddingTop: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
          <div className="banner-danger">
            Elige uno de los clubes de la lista para ver horarios y precios.
          </div>
        </div>
      ) : null}

      {/* ── Hora (conditional) ───────────────────────── */}
      {matchDate && hasPricedVenue ? (
        <div style={ROW}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.65rem" }}>
            <p style={{ ...LABEL, marginBottom: 0 }}>Hora del partido</p>
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
                fontSize: "0.75rem",
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
          <p style={{ fontSize: "0.8rem", color: "var(--text-2)", marginBottom: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>
            {formatSelectedDay(matchDate)}
          </p>

          <p style={{ fontSize: "0.68rem", color: "var(--text-3)", marginBottom: "0.4rem", fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Populares
          </p>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            {POPULAR_HOURS.map((t) => {
              const available = availableSlots.some((s) => s.value === t);
              if (!available) return null;
              const selected = matchTime === t;
              const slotFee = playerFeeForSlot(venueName, matchDate, t, durationMinutes);
              if (slotFee == null) return null;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMatchTime(selected ? "" : t)}
                  style={{
                    padding: "0.5rem 0.85rem",
                    borderRadius: "4px",
                    border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                    background: selected ? "var(--primary)" : "transparent",
                    color: selected ? "var(--primary-fg)" : "var(--text-2)",
                    fontSize: "0.85rem",
                    fontWeight: selected ? 700 : 500,
                    fontFamily: "var(--font-dm-sans)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "2px",
                    minWidth: "4.5rem",
                  }}
                >
                  <span>{t}</span>
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, color: selected ? "var(--primary-fg)" : "var(--text-3)" }}>
                    {formatCop(slotFee)}
                  </span>
                </button>
              );
            })}
          </div>

          {showAllTimes ? (
            <>
              <p style={{ fontSize: "0.68rem", color: "var(--text-3)", marginBottom: "0.4rem", fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Más horarios
              </p>
              <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "4px", scrollbarWidth: "thin" }}>
                {availableSlots.map((s) => {
                  const selected = matchTime === s.value;
                  const slotFee = playerFeeForSlot(venueName, matchDate, s.value, durationMinutes);
                  if (slotFee == null) return null;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setMatchTime(s.value)}
                      style={{
                        flexShrink: 0,
                        padding: "0.45rem 0.65rem",
                        borderRadius: "4px",
                        border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                        background: selected ? "var(--primary)" : "transparent",
                        color: selected ? "var(--primary-fg)" : "var(--text-2)",
                        fontSize: "0.82rem",
                        fontWeight: selected ? 700 : 400,
                        fontFamily: "var(--font-dm-sans)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "2px",
                        minWidth: "3.5rem",
                      }}
                    >
                      <span>{s.label}</span>
                      <span style={{ fontSize: "0.65rem", fontWeight: 600, color: selected ? "var(--primary-fg)" : "var(--text-3)" }}>
                        {formatCop(slotFee)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowAllTimes(false)}
                style={{ marginTop: "0.5rem", border: "none", background: "none", padding: 0, fontSize: "0.78rem", color: "var(--text-3)", fontFamily: "var(--font-dm-sans)", cursor: "pointer", textDecoration: "underline" }}
              >
                Ocultar horarios
              </button>
            </>
          ) : availableSlots.length > POPULAR_HOURS.filter((t) => availableSlots.some((s) => s.value === t)).length ? (
            <button
              type="button"
              onClick={() => setShowAllTimes(true)}
              style={{
                padding: "0.5rem 0.875rem",
                borderRadius: "4px",
                border: "1px dashed var(--border)",
                background: "transparent",
                color: "var(--text-2)",
                fontSize: "0.82rem",
                fontFamily: "var(--font-dm-sans)",
                cursor: "pointer",
                width: "100%",
              }}
            >
              Ver más horarios ({availableSlots.length})
            </button>
          ) : null}
          {availableSlots.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--text-3)", fontFamily: "var(--font-dm-sans)" }}>
              {availabilityLoading
                ? "Comprobando disponibilidad de canchas…"
                : bookableTimes !== null && bookableTimes.size === 0
                  ? "No hay cancha libre en ese día. Prueba otro horario o día."
                  : "No hay horarios disponibles para este club y día. Prueba otro día o club."}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── Límite ───────────────────────────────────── */}
      <div style={ROW}>
        <p style={LABEL}>Límite para unirse</p>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {DEADLINE_OPTIONS.map((o) => {
            const selected = deadlineHours === o.hours;
            return (
              <button
                key={o.hours}
                type="button"
                onClick={() => setDeadlineHours(o.hours)}
                style={{
                  padding: "0.3rem 0.85rem",
                  borderRadius: "4px",
                  border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                  background: selected ? "var(--primary)" : "transparent",
                  color: selected ? "var(--primary-fg)" : "var(--text-2)",
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

      {/* ── Nivel ────────────────────────────────────── */}
      <div style={ROW}>
        <label htmlFor="skillLevel" style={LABEL}>Nivel de juego</label>
        <div style={{ position: "relative" }}>
          <select
            id="skillLevel"
            className="input-base"
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
            style={{ paddingRight: "2.5rem" }}
          >
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
          {/* Custom chevron — hides the native browser arrow */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "0.875rem",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              width="11"
              height="11"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Notas ────────────────────────────────────── */}
      <div style={ROW}>
        <label htmlFor="notes" style={LABEL}>
          Notas <span style={{ opacity: 0.5 }}>— opcional</span>
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

      {/* ── Submit ───────────────────────────────────── */}
      <div style={{ paddingTop: "1.5rem" }}>
        {selectedPlayerFee != null && venueName.trim() ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              marginBottom: "1.25rem",
              padding: "0.875rem 1rem",
              background: "var(--surface-2, #1F1C17)",
              borderRadius: "4px",
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "0.68rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)" }}>
                Por jugador
              </p>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)" }}>
                Cada jugador paga al unirse
              </p>
            </div>
            <p style={{ margin: 0, fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)", fontWeight: 700, fontSize: "1.5rem", color: "var(--primary)", letterSpacing: "-0.02em", flexShrink: 0 }}>
              {formatCop(selectedPlayerFee)}
            </p>
          </div>
        ) : null}

        {message && (
          <div className="banner-danger" style={{ marginBottom: "1rem" }}>
            {message}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Button disabled={!canSubmit} onClick={submit} size="lg" style={{ width: "100%" }}>
            {pending ? (
              <>
                <SpinnerIcon />
                Creando partido...
              </>
            ) : (
              "Publicar Partido Gratis"
            )}
          </Button>
          {selectedPlayerFee != null ? (
            <p style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
              Publicar es gratis · Los jugadores pagan {formatCop(selectedPlayerFee)} al unirse
            </p>
          ) : null}
        </div>
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
