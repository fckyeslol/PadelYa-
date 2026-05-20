import type { CSSProperties } from "react";

/** Tokens compartidos del portal de canchas (/cancha). Alineados con globals.css. */
export const VP = {
  sidebar: "#0B1728",
  sidebarText: "rgba(255,255,255,0.45)",
  sidebarTextActive: "#ffffff",
  sidebarHover: "rgba(255,255,255,0.1)",
  sidebarBorder: "rgba(255,255,255,0.06)",
  bg: "var(--bg)",
  surface: "var(--surface)",
  border: "var(--border)",
  text: "var(--text)",
  text2: "var(--text-2)",
  text3: "var(--text-3)",
  primary: "var(--primary)",
  primaryMuted: "var(--primary-muted)",
  danger: "var(--danger)",
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  gold: "var(--gold)",
  radius: "12px",
  radiusLg: "16px",
  fontDisplay: "var(--font-montserrat)",
  fontBody: "var(--font-dm-sans)",
} as const;

export const VP_SLOT = {
  available: { bg: "rgba(22,163,74,0.12)", border: "rgba(22,163,74,0.25)", label: "Libre" },
  blocked: { bg: "rgba(212,137,26,0.15)", border: "rgba(212,137,26,0.35)", label: "Bloqueado" },
  booked: { bg: "rgba(29,78,216,0.12)", border: "rgba(29,78,216,0.25)", label: "Reservado" },
} as const;

export const VP_MATCH_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Abierto", color: "#16A34A", bg: "rgba(22,163,74,0.1)" },
  full: { label: "Lleno", color: "var(--info)", bg: "rgba(29,78,216,0.1)" },
  confirmed: { label: "Confirmado", color: "var(--primary)", bg: "var(--primary-muted)" },
  pending_court: { label: "Pendiente", color: "var(--warning)", bg: "rgba(146,64,14,0.1)" },
};

export const VP_SKILL_LABEL: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export const vpInputStyle: CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.85rem",
  borderRadius: "10px",
  border: `1px solid ${VP.border}`,
  background: VP.surface,
  color: VP.text,
  fontFamily: VP.fontBody,
  fontSize: "0.9rem",
};

export const vpLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.82rem",
  color: VP.text2,
  marginBottom: "0.35rem",
  fontWeight: 500,
};
