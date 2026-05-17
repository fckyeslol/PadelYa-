"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  matchId: string;
};

export function OrganizerMatchActions({ matchId }: Props) {
  const [courtReference, setCourtReference] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runAction(action: "confirm" | "complete" | "cancel") {
    startTransition(async () => {
      const response = await fetch("/api/organizer/matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, action, courtReference, cancelReason }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      setMessage(payload.message ?? payload.error ?? "Operación finalizada");
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 p-3">
      <input
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        placeholder="Referencia de cancha (opcional)"
        value={courtReference}
        onChange={(event) => setCourtReference(event.target.value)}
      />
      <input
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        placeholder="Motivo de cancelación (si aplica)"
        value={cancelReason}
        onChange={(event) => setCancelReason(event.target.value)}
      />
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => runAction("confirm")}>
          Confirmar cancha (partido lleno)
        </Button>
        <Button disabled={pending} className="bg-zinc-700 hover:bg-zinc-800" onClick={() => runAction("complete")}>
          Marcar completado
        </Button>
        <Button disabled={pending} className="bg-rose-600 hover:bg-rose-700" onClick={() => runAction("cancel")}>
          Cancelar partido
        </Button>
      </div>
      {message ? <p className="text-xs text-zinc-600">{message}</p> : null}
    </div>
  );
}
