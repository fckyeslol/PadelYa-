import type { MatchStatus } from "@/types/domain";

const STATUS_LABEL: Record<MatchStatus, string> = {
  pending_court: "Pendiente cancha",
  open: "Abierto",
  full: "Completo",
  confirmed: "Confirmado",
  completed: "Jugado",
  cancelled_unfilled: "Cancelado",
  cancelled_by_organizer: "Cancelado",
};

const STATUS_STYLE: Record<MatchStatus, React.CSSProperties> = {
  pending_court: {
    background: "rgba(146,64,14,0.08)",
    color: "var(--warning)",
    border: "1px solid rgba(146,64,14,0.20)",
  },
  open: {
    background: "rgba(30,58,110,0.08)",
    color: "var(--primary)",
    border: "1px solid rgba(30,58,110,0.18)",
  },
  full: {
    background: "rgba(29,78,216,0.08)",
    color: "var(--info)",
    border: "1px solid rgba(29,78,216,0.18)",
  },
  confirmed: {
    background: "rgba(212,137,26,0.10)",
    color: "var(--gold)",
    border: "1px solid rgba(212,137,26,0.22)",
  },
  completed: {
    background: "var(--border-light)",
    color: "var(--text-2)",
    border: "1px solid var(--border)",
  },
  cancelled_unfilled: {
    background: "rgba(146,64,14,0.08)",
    color: "var(--warning)",
    border: "1px solid rgba(146,64,14,0.20)",
  },
  cancelled_by_organizer: {
    background: "rgba(153,27,27,0.07)",
    color: "var(--danger)",
    border: "1px solid rgba(153,27,27,0.18)",
  },
};

const STATUS_DOT: Record<MatchStatus, boolean> = {
  pending_court: true,
  open: true,
  full: false,
  confirmed: false,
  completed: false,
  cancelled_unfilled: false,
  cancelled_by_organizer: false,
};

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const showDot = STATUS_DOT[status];

  return (
    <span
      style={{
        ...STATUS_STYLE[status],
        borderRadius: "999px",
        padding: "0.25rem 0.65rem",
        fontSize: "0.72rem",
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      {showDot && (
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "currentColor",
            flexShrink: 0,
          }}
          className="animate-pulse-dot"
        />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}
