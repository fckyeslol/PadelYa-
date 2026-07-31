"use client";

import { useCallback, useEffect, useState } from "react";
import {
  VP,
  vpCardStyle,
  vpEyebrowStyle,
  vpGhostButtonStyle,
  vpInputStyle,
  vpPrimaryButtonStyle,
  vpTitleStyle,
} from "./theme";

type Court = { id: string; name: string; sortOrder: number; isActive: boolean };

export function VenueCourtsPanel() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cancha/courts");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudieron cargar las canchas.");
      setCourts(json.courts as Court[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las canchas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const call = async (init: RequestInit) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cancha/courts", {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar el cambio.");
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!newName.trim()) return;
    const ok = await call({ method: "POST", body: JSON.stringify({ name: newName }) });
    if (ok) setNewName("");
  };

  const rename = async (courtId: string) => {
    const ok = await call({ method: "PATCH", body: JSON.stringify({ courtId, name: editingName }) });
    if (ok) setEditingId(null);
  };

  const setActive = (courtId: string, isActive: boolean) =>
    call({ method: "PATCH", body: JSON.stringify({ courtId, isActive }) });

  const active = courts.filter((c) => c.isActive);
  const inactive = courts.filter((c) => !c.isActive);

  return (
    <div style={{ padding: "1.5rem 1.25rem 5rem", maxWidth: "720px" }}>
      <p style={vpEyebrowStyle}>Canchas</p>
      <h2 style={vpTitleStyle}>Tus canchas</h2>
      <p
        style={{
          margin: "0.6rem 0 1.5rem",
          color: VP.text2,
          fontSize: "0.95rem",
          maxWidth: "56ch",
          lineHeight: 1.55,
        }}
      >
        Cuántas canchas tenés define cuántos partidos podemos abrir a la misma hora. Si sacás
        una de servicio, dejá de recibir reservas ahí sin perder el historial.
      </p>

      {loading ? (
        <p style={{ color: VP.text3, fontSize: "0.9rem" }}>Cargando…</p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {active.map((court) => (
              <div
                key={court.id}
                style={{
                  ...vpCardStyle,
                  padding: "0.85rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                {editingId === court.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      style={{ ...vpInputStyle, flex: "1 1 180px", width: "auto" }}
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => rename(court.id)}
                      style={{ ...vpPrimaryButtonStyle, minHeight: "40px", padding: "0.45rem 1rem" }}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      style={{ ...vpGhostButtonStyle, minHeight: "40px", padding: "0.45rem 0.9rem" }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        flex: 1,
                        minWidth: "140px",
                        fontFamily: VP.fontDisplay,
                        fontSize: "1.1rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.02em",
                        color: VP.text,
                      }}
                    >
                      {court.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(court.id);
                        setEditingName(court.name);
                      }}
                      style={{ ...vpGhostButtonStyle, minHeight: "40px", padding: "0.45rem 0.9rem" }}
                    >
                      Renombrar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setActive(court.id, false)}
                      style={{
                        ...vpGhostButtonStyle,
                        minHeight: "40px",
                        padding: "0.45rem 0.9rem",
                        color: VP.gold,
                        borderColor: "rgba(255,90,31,0.3)",
                      }}
                    >
                      Sacar de servicio
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div style={{ ...vpCardStyle, marginTop: "1rem", borderStyle: "dashed" }}>
            <label
              htmlFor="new-court"
              style={{ display: "block", ...vpEyebrowStyle, marginBottom: "0.6rem" }}
            >
              Agregar cancha
            </label>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <input
                id="new-court"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void add();
                }}
                placeholder="Cancha 5"
                style={{ ...vpInputStyle, flex: "1 1 180px", width: "auto" }}
              />
              <button
                type="button"
                onClick={add}
                disabled={busy || !newName.trim()}
                style={{ ...vpPrimaryButtonStyle, opacity: busy || !newName.trim() ? 0.5 : 1 }}
              >
                Agregar
              </button>
            </div>
          </div>

          {inactive.length > 0 && (
            <div style={{ marginTop: "1.75rem" }}>
              <p style={vpEyebrowStyle}>Fuera de servicio</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.6rem" }}>
                {inactive.map((court) => (
                  <div
                    key={court.id}
                    style={{
                      ...vpCardStyle,
                      padding: "0.7rem 1rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                      opacity: 0.75,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: "140px", color: VP.text2, fontSize: "0.95rem" }}>
                      {court.name}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setActive(court.id, true)}
                      style={{ ...vpGhostButtonStyle, minHeight: "40px", padding: "0.45rem 0.9rem" }}
                    >
                      Volver a habilitar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" style={{ marginTop: "1rem", color: VP.danger, fontSize: "0.9rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
