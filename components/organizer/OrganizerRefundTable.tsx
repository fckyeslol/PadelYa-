"use client";

import { useState, useTransition } from "react";

export type RefundRow = {
  id: string;
  status: string;
  amount_cop: number;
  reason: string;
  playerName: string;
  venueName: string;
  matchId: string;
};

const REASON_LABEL: Record<string, string> = {
  cancelled_by_player: "Canceló jugador",
  cancelled_by_organizer: "Canceló organizador",
  match_cancelled_unfilled: "Partido sin llenar",
};

export function OrganizerRefundTable({ refunds: initial }: { refunds: RefundRow[] }) {
  const [refunds, setRefunds] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  async function updateRefund(refundId: string, status: "processed" | "rejected") {
    setActionId(refundId);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/organizer/refunds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundId, status }),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        setError(payload.error ?? "Error al actualizar");
      } else {
        setRefunds((prev) =>
          prev.map((r) => (r.id === refundId ? { ...r, status } : r)),
        );
      }
      setActionId(null);
    });
  }

  const pendingRefunds = refunds.filter((r) => r.status === "pending_manual");
  const resolvedRefunds = refunds.filter((r) => r.status !== "pending_manual");

  const statusLabel: Record<string, string> = {
    processed: "Procesado manualmente",
    rejected: "Rechazado",
    refunded: "Reembolsado automáticamente",
    failed: "Error — revisar",
  };
  const statusColor: Record<string, string> = {
    processed: "var(--success)",
    rejected: "var(--danger)",
    refunded: "var(--primary)",
    failed: "var(--danger)",
  };
  const statusBg: Record<string, string> = {
    processed: "rgba(16,185,129,0.1)",
    rejected: "rgba(239,68,68,0.1)",
    refunded: "rgba(233,255,71,0.08)",
    failed: "rgba(239,68,68,0.1)",
  };

  if (refunds.length === 0) {
    return (
      <p style={{ color: "var(--text-3)", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)" }}>
        No hay reembolsos pendientes.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {error && (
        <div className="banner-danger" style={{ fontSize: "0.82rem" }}>{error}</div>
      )}

      {pendingRefunds.length > 0 && (
        <div>
          <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem", fontFamily: "var(--font-dm-sans)" }}>
            Pendientes ({pendingRefunds.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pendingRefunds.map((r) => (
              <div
                key={r.id}
                style={{
                  background: "rgba(251,191,36,0.04)",
                  border: "1px solid rgba(251,191,36,0.2)",
                  borderRadius: "12px",
                  padding: "0.875rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}>
                    {r.playerName}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)" }}>
                    {r.venueName} · {REASON_LABEL[r.reason] ?? r.reason} · <span style={{ fontWeight: 600, color: "var(--gold)" }}>{fmt(r.amount_cop)}</span>
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  <button
                    disabled={pending && actionId === r.id}
                    onClick={() => updateRefund(r.id, "processed")}
                    style={{
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.25)",
                      color: "var(--success)",
                      borderRadius: "8px",
                      padding: "0.35rem 0.75rem",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      fontFamily: "var(--font-dm-sans)",
                      cursor: "pointer",
                      opacity: pending && actionId === r.id ? 0.5 : 1,
                    }}
                  >
                    ✓ Procesado
                  </button>
                  <button
                    disabled={pending && actionId === r.id}
                    onClick={() => updateRefund(r.id, "rejected")}
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "var(--danger)",
                      borderRadius: "8px",
                      padding: "0.35rem 0.75rem",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      fontFamily: "var(--font-dm-sans)",
                      cursor: "pointer",
                      opacity: pending && actionId === r.id ? 0.5 : 1,
                    }}
                  >
                    ✕ Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolvedRefunds.length > 0 && (
        <div>
          <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem", fontFamily: "var(--font-dm-sans)" }}>
            Resueltos ({resolvedRefunds.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {resolvedRefunds.map((r) => (
              <div
                key={r.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "0.65rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <p style={{ fontSize: "0.82rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)" }}>
                  {r.playerName} · {r.venueName} · {fmt(r.amount_cop)}
                </p>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-dm-sans)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "999px",
                    background: statusBg[r.status] ?? "rgba(255,255,255,0.06)",
                    color: statusColor[r.status] ?? "var(--text-3)",
                  }}
                >
                  {statusLabel[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
