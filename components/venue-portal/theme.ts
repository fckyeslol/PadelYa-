import type { CSSProperties } from "react";

/**
 * Tokens del portal de canchas (/cancha).
 *
 * Dos cosas que se corrigieron el 2026-07-31:
 *
 * 1. Las fuentes ahora son las MISMAS que usa la landing, referenciadas por sus tokens
 *    semánticos (`--font-display`, `--font-dm-sans`, `--font-mono-ui`). Antes el portal
 *    llegaba a la display por `--font-montserrat`, que es un alias de compatibilidad
 *    declarado en globals.css: funcionaba, pero era indirección heredada y el portal
 *    quedaba desacoplado de la landing si algún día cambia la display.
 * 2. La barra lateral usaba un azul frío #0B1728 ajeno a la paleta de PadelYa, que es
 *    negro cálido + amarillo ácido. El portal parecía otro producto.
 *
 * Criterio de diseño: esto es software de mostrador. Lo usa la persona de recepción del
 * club, desde el celular, entre cliente y cliente, en un local iluminado. Prioriza
 * legibilidad a distancia, área táctil grande y estado visible de un vistazo — no la
 * densidad de un dashboard de escritorio.
 */
export const VP = {
  // Barra lateral: negro cálido, un escalón por debajo del fondo para que se lea como
  // una superficie sólida y no como un panel flotante.
  sidebar: "#070604",
  sidebarText: "rgba(242,237,228,0.52)",
  sidebarTextActive: "#0C0B08",
  sidebarHover: "rgba(242,237,228,0.07)",
  sidebarBorder: "rgba(242,237,228,0.08)",

  bg: "var(--bg)",
  surface: "var(--surface)",
  surface2: "var(--surface-2)",
  border: "var(--border)",
  borderLight: "var(--border-light)",
  text: "var(--text)",
  text2: "var(--text-2)",
  text3: "var(--text-3)",
  primary: "var(--primary)",
  primaryFg: "var(--primary-fg)",
  primaryMuted: "var(--primary-muted)",
  danger: "var(--danger)",
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  gold: "var(--gold)",
  goldMuted: "var(--gold-muted)",

  radius: "12px",
  radiusLg: "16px",

  /** Mismos tokens que la landing: Barlow Condensed vía --font-display. */
  fontDisplay: "var(--font-display)",
  fontBody: "var(--font-dm-sans, 'DM Sans', sans-serif)",
  /** Precios y horas son datos: en monoespaciada se alinean y se comparan de un vistazo. */
  fontMono: "var(--font-mono-ui)",
} as const;

/** Etiqueta de sección: versalitas condensadas, como la señalética de una cancha. */
export const vpEyebrowStyle: CSSProperties = {
  margin: 0,
  fontFamily: VP.fontDisplay,
  fontSize: "0.7rem",
  fontWeight: 600,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: VP.text3,
};

export const vpTitleStyle: CSSProperties = {
  margin: "0.3rem 0 0",
  fontFamily: VP.fontDisplay,
  fontSize: "clamp(1.6rem, 1.2rem + 1.6vw, 2.3rem)",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  lineHeight: 1.05,
  color: VP.text,
  textTransform: "uppercase",
};

export const VP_SLOT = {
  available: { bg: "rgba(0,201,167,0.12)", border: "rgba(0,201,167,0.3)", label: "Libre" },
  blocked: { bg: "rgba(255,90,31,0.14)", border: "rgba(255,90,31,0.36)", label: "Bloqueado" },
  booked: { bg: "rgba(233,255,71,0.12)", border: "rgba(233,255,71,0.3)", label: "Reservado" },
} as const;

export const VP_MATCH_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Abierto", color: "var(--success)", bg: "rgba(0,201,167,0.1)" },
  full: { label: "Lleno", color: "var(--primary)", bg: "var(--primary-muted)" },
  confirmed: { label: "Confirmado", color: "var(--primary)", bg: "var(--primary-muted)" },
  pending_court: { label: "Pendiente", color: "var(--gold)", bg: "var(--gold-muted)" },
};

export const VP_SKILL_LABEL: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

/** Alto mínimo de 44px: se toca con el dedo, de pie, detrás del mostrador. */
export const vpInputStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "0.6rem 0.85rem",
  borderRadius: "10px",
  border: `1px solid ${VP.border}`,
  background: VP.surface2,
  color: VP.text,
  fontFamily: VP.fontBody,
  fontSize: "0.95rem",
};

/** Para horas y precios: monoespaciada y tabular, así las columnas quedan a plomo. */
export const vpNumericInputStyle: CSSProperties = {
  ...vpInputStyle,
  fontFamily: VP.fontMono,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-0.01em",
};

export const vpLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.78rem",
  color: VP.text2,
  marginBottom: "0.4rem",
  fontWeight: 500,
  letterSpacing: "0.02em",
};

export const vpCardStyle: CSSProperties = {
  background: VP.surface,
  border: `1px solid ${VP.border}`,
  borderRadius: VP.radiusLg,
  padding: "1.15rem",
};

export const vpPrimaryButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.65rem 1.35rem",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  background: VP.primary,
  color: VP.primaryFg,
  fontFamily: VP.fontBody,
  fontSize: "0.92rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
};

export const vpGhostButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.65rem 1.1rem",
  borderRadius: "10px",
  border: `1px solid ${VP.border}`,
  cursor: "pointer",
  background: "transparent",
  color: VP.text2,
  fontFamily: VP.fontBody,
  fontSize: "0.9rem",
  fontWeight: 600,
};

/** Formatea COP sin decimales: $110.000 */
export function vpCop(value: number): string {
  return `$${value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}
