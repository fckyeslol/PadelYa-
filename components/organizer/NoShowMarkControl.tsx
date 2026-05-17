"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";

export function NoShowMarkControl({ matchPlayerId }: { matchPlayerId: string }) {
  const [pending, startTransition] = useTransition();

  function handleNoShow() {
    startTransition(async () => {
      await fetch("/api/organizer/no-show", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchPlayerId }),
      });
    });
  }

  return (
    <Button className="bg-amber-600 hover:bg-amber-700" disabled={pending} onClick={handleNoShow}>
      Marcar no-show
    </Button>
  );
}
