"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ALL_VENUE_NAMES } from "@/config/venues";
import type { Match } from "@/types/domain";

export function EditMatchForm({ match }: { match: Match }) {
  const router = useRouter();
  const [venueName, setVenueName] = useState(match.venueName);
  const [notes, setNotes] = useState(match.notes ?? "");
  const [orgFeeCop, setOrgFeeCop] = useState(String(match.orgFeeCop));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canEditFee = match.status === "pending_court";

  function submit() {
    setError(null);
    startTransition(async () => {
      const body: Record<string, unknown> = { venueName, notes };
      if (canEditFee) body.orgFeeCop = Number(orgFeeCop) || match.orgFeeCop;

      const res = await fetch(`/api/matches/${match.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        setError(payload.error ?? "No se pudo actualizar el partido");
        return;
      }

      router.push(`/matches/${match.id}`);
      router.refresh();
    });
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "20px",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      {match.status === "open" && (
        <div
          style={{
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.2)",
            borderRadius: "10px",
            padding: "0.875rem 1rem",
            fontSize: "0.82rem",
            color: "var(--text-2)",
            fontFamily: "var(--font-dm-sans)",
            lineHeight: 1.5,
          }}
        >
          El partido está abierto. Solo puedes editar el lugar y las notas — la tarifa queda fija para jugadores que ya vieron el precio.
        </div>
      )}

      <Field label="Cancha / club">
        <select
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          className="input-base"
          style={{ width: "100%" }}
        >
          {ALL_VENUE_NAMES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
          {!ALL_VENUE_NAMES.includes(venueName) && (
            <option value={venueName}>{venueName}</option>
          )}
        </select>
      </Field>

      {canEditFee && (
        <Field label="Cuota por jugador (COP)">
          <input
            type="number"
            className="input-base"
            value={orgFeeCop}
            onChange={(e) => setOrgFeeCop(e.target.value)}
            min={0}
            step={1000}
          />
        </Field>
      )}

      <Field label="Notas (opcional)">
        <textarea
          className="input-base"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Instrucciones de llegada, equipamiento, etc."
          style={{ resize: "vertical", minHeight: "80px" }}
        />
      </Field>

      {error && <div className="banner-danger">{error}</div>}

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <Button
          disabled={pending || !venueName.trim()}
          onClick={submit}
          style={{ flex: 1 }}
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: "0.8rem",
          fontWeight: 500,
          color: "var(--text-2)",
          marginBottom: "0.4rem",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
