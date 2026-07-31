"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

/** Horas antes del partido a partir de las cuales cancelar cuenta como tardío. */
export const LATE_CANCELLATION_HOURS = 3;

/**
 * Calcula si un cupo ya entró en la ventana de cancelación tardía.
 * Va acá para que lo use quien renderiza (server component), donde el reloj es
 * el del servidor — que es la autoridad y además el que aplica la regla en la API.
 */
export function isWithinLateCancellationWindow(
  scheduledAt: string | null | undefined,
  nowMs: number,
): boolean {
  if (!scheduledAt) return false;
  const hoursLeft = (new Date(scheduledAt).getTime() - nowMs) / (1000 * 60 * 60);
  return hoursLeft < LATE_CANCELLATION_HOURS;
}

interface Props {
  matchId: string;
  matchStatus?: string;
  /**
   * Si el cupo ya está en la ventana de cancelación tardía. Lo calcula el que
   * renderiza (con isWithinLateCancellationWindow), NO este componente: llamar
   * Date.now() en el cuerpo del render es impuro y da resultados que cambian
   * solos entre renders.
   */
  isLateWindow?: boolean;
}

export function CancelSpotButton({ matchId, matchStatus, isLateWindow = false }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const isFull = matchStatus === "full";
  const isLate = isFull || isLateWindow;

  if (isFull) {
    return (
      <div
        style={{
          background: "rgba(239,68,68,0.05)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: "12px",
          padding: "1rem",
          display: "flex",
          gap: "0.5rem",
          alignItems: "flex-start",
        }}
      >
        <span style={{ fontSize: "1rem" }}>🔒</span>
        <p style={{ fontSize: "0.82rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.5 }}>
          El partido está completo. No es posible cancelar tu cupo una vez el partido se llena.
        </p>
      </div>
    );
  }

  function cancelSpot() {
    startTransition(async () => {
      const response = await fetch(`/api/matches/${matchId}/cancel`, {
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      setMessage({
        text: payload.message ?? payload.error ?? "Operacion procesada",
        ok: response.ok,
      });
      setShowConfirm(false);
    });
  }

  if (showConfirm) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          background: isLate ? "rgba(239,68,68,0.05)" : "var(--surface)",
          border: `1px solid ${isLate ? "rgba(239,68,68,0.2)" : "var(--border)"}`,
          borderRadius: "12px",
          padding: "1rem",
        }}
      >
        {isLate ? (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <span style={{ fontSize: "1rem" }}>⚠️</span>
            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--danger)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.2rem" }}>
                Cancelación tardía — sin reembolso
              </p>
              <p style={{ fontSize: "0.78rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.5 }}>
                {matchStatus === "full"
                  ? "El partido ya está lleno. Al cancelar pierdes tu cupo sin derecho a reembolso."
                  : `Faltan menos de 3 horas para el partido. Al cancelar pierdes tu cupo sin derecho a reembolso.`}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <span style={{ fontSize: "1rem" }}>ℹ️</span>
            <p style={{ fontSize: "0.82rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.5 }}>
              Al cancelar se iniciará un proceso de reembolso manual. El tiempo de acreditación puede ser de 24–72 horas hábiles.
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button
            variant="danger"
            disabled={pending}
            onClick={cancelSpot}
            size="sm"
            style={{ flex: 1 }}
          >
            {pending ? "Cancelando..." : "Sí, cancelar cupo"}
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => setShowConfirm(false)}
            size="sm"
          >
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => setShowConfirm(true)}
        size="sm"
      >
        Cancelar mi cupo
      </Button>
      {isLate && !message && (
        <p style={{ fontSize: "0.72rem", color: "var(--danger)", fontFamily: "var(--font-dm-sans)" }}>
          ⚠️ Cancelación tardía — no aplica reembolso
        </p>
      )}
      {message && (
        <p
          style={{
            fontSize: "0.78rem",
            color: message.ok ? "var(--text-2)" : "var(--danger)",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
