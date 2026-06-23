"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

interface Props {
  matchId: string;
  guestMatchPlayerId: string;
  guestName: string;
}

export function CancelGuestButton({ matchId, guestMatchPlayerId, guestName }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirm, setConfirm] = useState(false);

  function cancel() {
    startTransition(async () => {
      const res = await fetch(`/api/matches/${matchId}/cancel-guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestMatchPlayerId }),
      });
      const payload = (await res.json()) as { message?: string; error?: string };
      setMessage({ text: payload.message ?? payload.error ?? "Operación procesada", ok: res.ok });
      setConfirm(false);
    });
  }

  if (message?.ok) {
    return (
      <p style={{ fontSize: "0.78rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)" }}>
        {message.text}
      </p>
    );
  }

  if (confirm) {
    return (
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <Button variant="danger" size="sm" disabled={pending} onClick={cancel}>
          {pending ? "Cancelando…" : `Sí, quitar a ${guestName}`}
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm(false)}>
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
        Quitar invitado
      </Button>
      {message && !message.ok && (
        <p style={{ fontSize: "0.75rem", color: "var(--danger)", fontFamily: "var(--font-dm-sans)" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
