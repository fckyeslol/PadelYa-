"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DAY_TYPES, DAY_TYPE_LABEL, type DayType } from "@/config/venue-pricing-rules";
import {
  VP,
  vpCardStyle,
  vpCop,
  vpEyebrowStyle,
  vpGhostButtonStyle,
  vpLabelStyle,
  vpNumericInputStyle,
  vpPrimaryButtonStyle,
  vpTitleStyle,
} from "./theme";

type Band = { startTime: string; endTime: string; courtPriceCop: number | null };
type ApiRule = {
  dayType: DayType;
  durationMinutes: 60 | 90 | 120;
  startTime: string;
  endTime: string;
  courtPriceCop: number;
};

type PricingResponse = {
  rules: ApiRule[];
  courtMarkupCop: number;
  suggested?: Record<string, Band[]>;
};

const DURATIONS: (60 | 90 | 120)[] = [60, 90, 120];
const EMPTY_BAND: Band = { startTime: "06:00", endTime: "12:00", courtPriceCop: null };

/** Sin setState adentro: la comparten el effect de montaje y el refresco post-guardado. */
async function fetchPricing(signal?: AbortSignal): Promise<PricingResponse> {
  const res = await fetch("/api/cancha/pricing", { signal });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "No se pudo cargar el tarifario.");
  return json as PricingResponse;
}

function playerFee(courtPriceCop: number | null, markup: number): number | null {
  if (courtPriceCop == null || courtPriceCop <= 0) return null;
  return Math.round((courtPriceCop + markup) / 4);
}

export function VenuePricingBoard() {
  const [day, setDay] = useState<DayType>("weekday");
  const [duration, setDuration] = useState<60 | 90 | 120>(90);
  const [allRules, setAllRules] = useState<ApiRule[]>([]);
  const [suggested, setSuggested] = useState<Record<string, Band[]>>({});
  const [markup, setMarkup] = useState(22_500);
  const [bands, setBands] = useState<Band[]>([]);
  /** true si lo que se ve es NUESTRA sugerencia y la sede todavía no la guardó. */
  const [isPrefilled, setIsPrefilled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const applyPricing = useCallback((json: PricingResponse) => {
    setAllRules(json.rules);
    setMarkup(json.courtMarkupCop);
    setSuggested((json.suggested ?? {}) as Record<string, Band[]>);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyPricing(await fetchPricing());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el tarifario.");
    } finally {
      setLoading(false);
    }
  }, [applyPricing]);

  // `loading` ya arranca en true, así que el montaje no necesita volver a prenderlo.
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const json = await fetchPricing(controller.signal);
        if (controller.signal.aborted) return;
        applyPricing(json);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar el tarifario.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [applyPricing]);

  // Al cambiar de día o duración: se muestra lo que la sede guardó. Si no guardó nada para
  // esa combinación, se PRECARGA nuestro tarifario de referencia — así nunca arranca de una
  // grilla vacía, que es cómo se cortaría la disponibilidad sin darse cuenta (al guardar,
  // su grilla reemplaza la nuestra completa para ese día + duración).
  //
  // Se recalcula durante el render y no en un effect: es estado derivado, y hacerlo en un
  // effect obliga a un segundo render con la grilla vieja en pantalla.
  // https://react.dev/learn/you-might-not-need-an-effect
  const [gridSource, setGridSource] = useState({ allRules, suggested, day, duration });
  if (
    gridSource.allRules !== allRules ||
    gridSource.suggested !== suggested ||
    gridSource.day !== day ||
    gridSource.duration !== duration
  ) {
    // Recargar del server no invalida el aviso de "guardado": `save()` refresca
    // el tarifario justo después de persistir, y limpiarlo acá hacía que el
    // cartel apareciera y desapareciera solo. Sólo deja de aplicar cuando la
    // sede se mueve a otra combinación, porque el aviso es de ese día + duración.
    const comboChanged = gridSource.day !== day || gridSource.duration !== duration;
    setGridSource({ allRules, suggested, day, duration });

    const savedBands = allRules
      .filter((r) => r.dayType === day && r.durationMinutes === duration)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime,
        courtPriceCop: r.courtPriceCop,
      }));

    if (savedBands.length > 0) {
      setBands(savedBands);
      setIsPrefilled(false);
    } else {
      const hint = suggested[`${day}:${duration}`] ?? [];
      setBands(hint.map((b) => ({ ...b })));
      setIsPrefilled(hint.length > 0);
    }
    if (comboChanged) setSaved(false);
  }

  /** Cuántas franjas tiene cada combinación: le dice a la sede qué le falta cargar. */
  const filledCombos = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of allRules) {
      const key = `${r.dayType}:${r.durationMinutes}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [allRules]);

  const updateBand = (index: number, patch: Partial<Band>) => {
    setBands((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
    setSaved(false);
  };

  const removeBand = (index: number) => {
    setBands((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  const restoreSuggestion = () => {
    const hint = suggested[`${day}:${duration}`] ?? [];
    setBands(hint.map((b) => ({ ...b })));
    setIsPrefilled(true);
    setSaved(false);
  };

  const addBand = () => {
    setBands((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, last ? { ...EMPTY_BAND, startTime: last.endTime, endTime: "23:00" } : EMPTY_BAND];
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = bands.map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
        courtPriceCop: b.courtPriceCop ?? 0,
      }));
      const res = await fetch("/api/cancha/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayType: day, durationMinutes: duration, rules: payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar el tarifario.");
      setSaved(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el tarifario.");
    } finally {
      setSaving(false);
    }
  };

  const usingOurPrices = allRules.length === 0;

  return (
    <div style={{ padding: "1.5rem 1.25rem 5rem", maxWidth: "820px" }}>
      <p style={vpEyebrowStyle}>Tarifario</p>
      <h2 style={vpTitleStyle}>Tus precios</h2>
      <p
        style={{
          margin: "0.6rem 0 1.5rem",
          color: VP.text2,
          fontSize: "0.95rem",
          maxWidth: "56ch",
          lineHeight: 1.55,
        }}
      >
        Cargá lo que cobrás por la cancha en cada franja. Nosotros dividimos entre los cuatro
        jugadores y les mostramos ese precio al reservar.
      </p>

      {/* Cuando la grilla viene precargada, el aviso de abajo dice lo mismo pero mejor y
          con qué hacer: no se apilan los dos. */}
      {usingOurPrices && !loading && !isPrefilled && (
        <div
          style={{
            ...vpCardStyle,
            marginBottom: "1.25rem",
            borderColor: "rgba(255,90,31,0.35)",
            background: VP.goldMuted,
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: VP.text, fontSize: "0.95rem" }}>
            Todavía usamos precios nuestros
          </p>
          <p style={{ margin: "0.35rem 0 0", color: VP.text2, fontSize: "0.88rem", lineHeight: 1.5 }}>
            Hasta que cargues los tuyos, cobramos con un tarifario de referencia que armamos en
            julio. Si tus precios cambiaron, acá los corregís.
          </p>
        </div>
      )}

      {/* Selector de día */}
      <div style={{ marginBottom: "1rem" }}>
        <span style={vpLabelStyle}>Día</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {DAY_TYPES.map((d) => (
            <Chip
              key={d}
              label={DAY_TYPE_LABEL[d]}
              active={day === d}
              badge={filledCombos.get(`${d}:${duration}`)}
              onClick={() => setDay(d)}
            />
          ))}
        </div>
      </div>

      {/* Selector de duración */}
      <div style={{ marginBottom: "1.5rem" }}>
        <span style={vpLabelStyle}>Duración del turno</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {DURATIONS.map((d) => (
            <Chip
              key={d}
              label={`${d} min`}
              active={duration === d}
              badge={filledCombos.get(`${day}:${d}`)}
              onClick={() => setDuration(d)}
            />
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: VP.text3, fontSize: "0.9rem" }}>Cargando tu tarifario…</p>
      ) : (
        <>
          {isPrefilled && (
            <div
              style={{
                ...vpCardStyle,
                marginBottom: "0.8rem",
                borderColor: VP.primaryMuted,
                background: VP.primaryMuted,
              }}
            >
              <p style={{ margin: 0, fontWeight: 700, color: VP.text, fontSize: "0.93rem" }}>
                Precargamos nuestros precios de referencia
              </p>
              <p
                style={{
                  margin: "0.35rem 0 0",
                  color: VP.text2,
                  fontSize: "0.87rem",
                  lineHeight: 1.5,
                }}
              >
                Revisá cada franja y corregí lo que no coincida. Al guardar, esta grilla
                reemplaza la nuestra para {DAY_TYPE_LABEL[day].toLowerCase()} en turnos de{" "}
                {duration} min — así que dejá cargadas todas las horas en que abrís.
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {bands.length === 0 && (
              <div style={{ ...vpCardStyle, borderStyle: "dashed", textAlign: "center" }}>
                <p style={{ margin: 0, color: VP.text2, fontSize: "0.92rem" }}>
                  No hay franjas para {DAY_TYPE_LABEL[day].toLowerCase()} en turnos de {duration} min.
                </p>
                <p style={{ margin: "0.3rem 0 0", color: VP.text3, fontSize: "0.85rem" }}>
                  {suggested[`${day}:${duration}`]?.length
                    ? "Podés volver a cargar nuestros precios de referencia como base."
                    : "Agregá una franja para empezar."}
                </p>
              </div>
            )}

            {bands.map((band, i) => (
              <BandRow
                key={i}
                band={band}
                markup={markup}
                onChange={(patch) => updateBand(i, patch)}
                onRemove={() => removeBand(i)}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "1.1rem" }}>
            <button type="button" onClick={addBand} style={vpGhostButtonStyle}>
              + Agregar franja
            </button>
            {!isPrefilled && (suggested[`${day}:${duration}`]?.length ?? 0) > 0 && (
              <button type="button" onClick={restoreSuggestion} style={vpGhostButtonStyle}>
                Usar nuestros precios como base
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{ ...vpPrimaryButtonStyle, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Guardando…" : "Guardar precios"}
            </button>
          </div>

          {error && (
            <p
              role="alert"
              style={{
                margin: "0.9rem 0 0",
                color: VP.danger,
                fontSize: "0.9rem",
                lineHeight: 1.5,
              }}
            >
              {error}
            </p>
          )}
          {saved && !error && (
            <p style={{ margin: "0.9rem 0 0", color: VP.success, fontSize: "0.9rem" }}>
              Precios guardados. Ya se aplican a los partidos nuevos.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function BandRow({
  band,
  markup,
  onChange,
  onRemove,
}: {
  band: Band;
  markup: number;
  onChange: (patch: Partial<Band>) => void;
  onRemove: () => void;
}) {
  const fee = playerFee(band.courtPriceCop, markup);

  return (
    <div style={{ ...vpCardStyle, padding: "0.9rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: "0.7rem",
          alignItems: "end",
        }}
      >
        <div>
          <label style={vpLabelStyle} htmlFor={`from-${band.startTime}-${band.endTime}`}>
            Desde
          </label>
          <input
            id={`from-${band.startTime}-${band.endTime}`}
            type="time"
            step={1800}
            value={band.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
            style={vpNumericInputStyle}
          />
        </div>
        <div>
          <label style={vpLabelStyle} htmlFor={`to-${band.startTime}-${band.endTime}`}>
            Hasta
          </label>
          <input
            id={`to-${band.startTime}-${band.endTime}`}
            type="time"
            step={1800}
            value={band.endTime}
            onChange={(e) => onChange({ endTime: e.target.value })}
            style={vpNumericInputStyle}
          />
        </div>
        <div>
          <label style={vpLabelStyle} htmlFor={`price-${band.startTime}-${band.endTime}`}>
            Precio cancha
          </label>
          <input
            id={`price-${band.startTime}-${band.endTime}`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            placeholder="60000"
            value={band.courtPriceCop ?? ""}
            onChange={(e) =>
              onChange({ courtPriceCop: e.target.value === "" ? null : Number(e.target.value) })
            }
            style={vpNumericInputStyle}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginTop: "0.85rem",
          paddingTop: "0.8rem",
          borderTop: `1px solid ${VP.border}`,
        }}
      >
        <div>
          <span style={{ fontSize: "0.76rem", color: VP.text3, letterSpacing: "0.04em" }}>
            CADA JUGADOR PAGA
          </span>
          <p
            style={{
              margin: "0.1rem 0 0",
              fontFamily: VP.fontMono,
              fontVariantNumeric: "tabular-nums",
              fontSize: "1.35rem",
              fontWeight: 500,
              color: fee == null ? VP.text3 : VP.primary,
              lineHeight: 1.1,
            }}
          >
            {fee == null ? "—" : vpCop(fee)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar esta franja"
          style={{
            ...vpGhostButtonStyle,
            minHeight: "40px",
            padding: "0.4rem 0.9rem",
            color: VP.danger,
            borderColor: "rgba(255,68,68,0.3)",
          }}
        >
          Quitar
        </button>
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  badge,
  onClick,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: "44px",
        padding: "0.5rem 0.95rem",
        borderRadius: "999px",
        cursor: "pointer",
        border: `1px solid ${active ? VP.primary : VP.border}`,
        background: active ? VP.primaryMuted : "transparent",
        color: active ? VP.primary : VP.text2,
        fontFamily: VP.fontBody,
        fontSize: "0.88rem",
        fontWeight: active ? 700 : 500,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        transition: "border-color 0.15s, color 0.15s, background 0.15s",
      }}
    >
      {label}
      {badge ? (
        <span
          style={{
            fontFamily: VP.fontMono,
            fontSize: "0.7rem",
            color: active ? VP.primary : VP.text3,
            opacity: 0.85,
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
