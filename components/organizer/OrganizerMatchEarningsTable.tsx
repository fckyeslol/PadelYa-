import Link from "next/link";
import type { MatchEarningsRow } from "@/services/analytics/match-revenue";
import type { MatchStatus } from "@/types/domain";
import { formatCop } from "@/utils/currency";
import { formatDateTime } from "@/utils/dates";

type Props = {
  rows: MatchEarningsRow[];
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  pending_court: "Pendiente cancha",
  open: "Abierto",
  full: "Lleno",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled_unfilled: "Sin llenar",
  cancelled_by_organizer: "Cancelado",
};

const STATUS_STYLE: Record<MatchStatus, { bg: string; color: string; border: string }> = {
  pending_court: { bg: "rgba(94, 85, 73, 0.16)", color: "var(--text-2)", border: "rgba(94, 85, 73, 0.4)" },
  open: { bg: "rgba(233, 255, 71, 0.08)", color: "var(--primary)", border: "rgba(233, 255, 71, 0.25)" },
  full: { bg: "rgba(77, 163, 255, 0.10)", color: "var(--info)", border: "rgba(77, 163, 255, 0.28)" },
  confirmed: { bg: "rgba(0, 201, 167, 0.10)", color: "var(--success)", border: "rgba(0, 201, 167, 0.28)" },
  completed: { bg: "rgba(0, 201, 167, 0.16)", color: "var(--success)", border: "rgba(0, 201, 167, 0.4)" },
  cancelled_unfilled: { bg: "rgba(94, 85, 73, 0.16)", color: "var(--text-3)", border: "rgba(94, 85, 73, 0.4)" },
  cancelled_by_organizer: { bg: "rgba(255, 68, 68, 0.10)", color: "var(--danger)", border: "rgba(255, 68, 68, 0.28)" },
};

export function OrganizerMatchEarningsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p
        style={{
          color: "var(--text-3)",
          fontSize: "0.875rem",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        Aún no hay partidos completados ni confirmados con ingresos registrados.
      </p>
    );
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden sm:block" style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.85rem",
          }}
        >
          <thead>
            <tr>
              <Th>Fecha · Cancha</Th>
              <Th align="center">Jugadores pagos</Th>
              <Th align="right">Tarifa</Th>
              <Th align="right">Recaudado</Th>
              <Th align="right">Estado</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const statusStyle = STATUS_STYLE[row.status];
              return (
                <tr
                  key={row.matchId}
                  style={{
                    background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                  }}
                >
                  <Td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0 }}>
                      <span
                        style={{
                          color: "var(--text-3)",
                          fontSize: "0.72rem",
                          fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {formatDateTime(row.scheduledAt)}
                      </span>
                      <Link
                        href={`/matches/${row.matchId}`}
                        style={{
                          color: "var(--text)",
                          fontWeight: 600,
                          textDecoration: "none",
                          lineHeight: 1.3,
                        }}
                        className="hover:text-[var(--primary)]"
                      >
                        {row.venueName}
                      </Link>
                    </div>
                  </Td>

                  <Td align="center">
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--text)",
                        fontWeight: 600,
                      }}
                    >
                      <PlayersDot count={row.paidCount} />
                      {row.paidCount}/4
                    </span>
                  </Td>

                  <Td align="right">
                    <span
                      style={{
                        color: "var(--text-2)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatCop(row.orgFeeCop)}
                    </span>
                  </Td>

                  <Td align="right">
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: "0.95rem",
                        color: row.totalCollectedCop > 0 ? "var(--primary)" : "var(--text-3)",
                        letterSpacing: "-0.01em",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatCop(row.totalCollectedCop)}
                    </span>
                  </Td>

                  <Td align="right">
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        background: statusStyle.bg,
                        border: `1px solid ${statusStyle.border}`,
                        color: statusStyle.color,
                        borderRadius: "999px",
                        padding: "0.18rem 0.6rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.01em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked list */}
      <div className="sm:hidden" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {rows.map((row) => {
          const statusStyle = STATUS_STYLE[row.status];
          return (
            <div
              key={row.matchId}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "0.85rem 0.95rem",
                background: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      color: "var(--text-3)",
                      fontSize: "0.7rem",
                      fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)",
                      letterSpacing: "0.04em",
                      marginBottom: "0.15rem",
                    }}
                  >
                    {formatDateTime(row.scheduledAt)}
                  </p>
                  <Link
                    href={`/matches/${row.matchId}`}
                    style={{
                      color: "var(--text)",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      textDecoration: "none",
                    }}
                    className="hover:text-[var(--primary)]"
                  >
                    {row.venueName}
                  </Link>
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    background: statusStyle.bg,
                    border: `1px solid ${statusStyle.border}`,
                    color: statusStyle.color,
                    borderRadius: "999px",
                    padding: "0.18rem 0.55rem",
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {STATUS_LABEL[row.status]}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "0.45rem",
                  borderTop: "1px dashed var(--border)",
                }}
              >
                <span
                  style={{
                    color: "var(--text-2)",
                    fontSize: "0.78rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  <PlayersDot count={row.paidCount} />
                  {row.paidCount}/4 · {formatCop(row.orgFeeCop)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    color: row.totalCollectedCop > 0 ? "var(--primary)" : "var(--text-3)",
                    letterSpacing: "-0.01em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatCop(row.totalCollectedCop)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      style={{
        textAlign: align,
        padding: "0.55rem 0.85rem",
        fontSize: "0.68rem",
        fontWeight: 600,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      style={{
        padding: "0.7rem 0.85rem",
        borderBottom: "1px solid var(--border)",
        textAlign: align,
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

function PlayersDot({ count }: { count: number }) {
  const filled = Math.min(Math.max(count, 0), 4);
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: i < filled ? "var(--primary)" : "var(--border-light)",
            boxShadow: i < filled ? "0 0 5px rgba(233,255,71,0.45)" : "none",
          }}
        />
      ))}
    </span>
  );
}
