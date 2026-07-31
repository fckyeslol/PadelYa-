"use client";

import { useCallback, useEffect, useState } from "react";
import { DAY_TYPE_LABEL, type DayType } from "@/config/venue-pricing-rules";
import {
  VP,
  vpCardStyle,
  vpEyebrowStyle,
  vpLabelStyle,
  vpNumericInputStyle,
  vpPrimaryButtonStyle,
  vpTitleStyle,
} from "./theme";

type Hours = {
  dayType: DayType;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

export function VenueHoursPanel() {
  const [hours, setHours] = useState<Hours[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<DayType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedDay, setSavedDay] = useState<DayType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cancha/hours");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo cargar el horario.");
      setHours(json.hours as Hours[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el horario.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (dayType: DayType, next: Partial<Hours>) => {
    setHours((prev) => prev.map((h) => (h.dayType === dayType ? { ...h, ...next } : h)));
    setSavedDay(null);
  };

  const save = async (row: Hours) => {
    setSavingDay(row.dayType);
    setError(null);
    try {
      const res = await fetch("/api/cancha/hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar el horario.");
      setSavedDay(row.dayType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el horario.");
    } finally {
      setSavingDay(null);
    }
  };

  return (
    <div style={{ padding: "1.5rem 1.25rem 5rem", maxWidth: "720px" }}>
      <p style={vpEyebrowStyle}>Horarios</p>
      <h2 style={vpTitleStyle}>Cuándo abrís</h2>
      <p
        style={{
          margin: "0.6rem 0 1.5rem",
          color: VP.text2,
          fontSize: "0.95rem",
          maxWidth: "56ch",
          lineHeight: 1.55,
        }}
      >
        Fuera de este horario no ofrecemos turnos en tu cancha. Si dejás un día sin
        configurar, usamos las horas que tengan precio en tu tarifario.
      </p>

      {loading ? (
        <p style={{ color: VP.text3, fontSize: "0.9rem" }}>Cargando…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {hours.map((row) => (
            <div key={row.dayType} style={vpCardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontFamily: VP.fontDisplay,
                    fontSize: "1.15rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                    color: VP.text,
                  }}
                >
                  {DAY_TYPE_LABEL[row.dayType]}
                </h3>

                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    cursor: "pointer",
                    color: row.isClosed ? VP.gold : VP.text2,
                    fontSize: "0.88rem",
                    fontWeight: row.isClosed ? 700 : 500,
                    minHeight: "44px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={row.isClosed}
                    onChange={(e) => patch(row.dayType, { isClosed: e.target.checked })}
                    style={{ width: "18px", height: "18px", accentColor: VP.gold }}
                  />
                  Cerrado
                </label>
              </div>

              {!row.isClosed && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: "0.7rem",
                    marginTop: "0.85rem",
                  }}
                >
                  <div>
                    <label style={vpLabelStyle} htmlFor={`opens-${row.dayType}`}>
                      Abre
                    </label>
                    <input
                      id={`opens-${row.dayType}`}
                      type="time"
                      step={1800}
                      value={row.opensAt ?? ""}
                      onChange={(e) => patch(row.dayType, { opensAt: e.target.value || null })}
                      style={vpNumericInputStyle}
                    />
                  </div>
                  <div>
                    <label style={vpLabelStyle} htmlFor={`closes-${row.dayType}`}>
                      Cierra
                    </label>
                    <input
                      id={`closes-${row.dayType}`}
                      type="time"
                      step={1800}
                      value={row.closesAt ?? ""}
                      onChange={(e) => patch(row.dayType, { closesAt: e.target.value || null })}
                      style={vpNumericInputStyle}
                    />
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginTop: "0.9rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => save(row)}
                  disabled={savingDay === row.dayType}
                  style={{
                    ...vpPrimaryButtonStyle,
                    minHeight: "40px",
                    padding: "0.5rem 1.1rem",
                    fontSize: "0.86rem",
                    opacity: savingDay === row.dayType ? 0.6 : 1,
                  }}
                >
                  {savingDay === row.dayType ? "Guardando…" : "Guardar"}
                </button>
                {savedDay === row.dayType && (
                  <span style={{ color: VP.success, fontSize: "0.86rem" }}>Guardado</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" style={{ marginTop: "1rem", color: VP.danger, fontSize: "0.9rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
