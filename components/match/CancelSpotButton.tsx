"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

export function CancelSpotButton({ matchId }: { matchId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

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
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <Button
        variant="danger"
        disabled={pending}
        onClick={cancelSpot}
        size="sm"
      >
        {pending ? "Cancelando..." : "Cancelar mi cupo"}
      </Button>
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
