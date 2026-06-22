"use client";

import { useState } from "react";
import { formatCop } from "@/utils/currency";
import { MatchPaymentCheckout } from "@/components/payment/MatchPaymentCheckout";

interface Props {
  matchId: string;
  feeCop: number;
  /** Max guests that still fit (capacity minus the payer's own slot when included). */
  maxGuests: number;
  /** Whether the payer's own slot is paid in the same checkout. */
  includeSelf: boolean;
}

type GuestRow = { name: string; phone: string };

function isValidGuest(g: GuestRow): boolean {
  return g.name.trim().length >= 2 && g.phone.replace(/\D/g, "").length >= 10;
}

export function AddGuestSection({ matchId, feeCop, maxGuests, includeSelf }: Props) {
  const [open, setOpen] = useState(false);
  const [guests, setGuests] = useState<GuestRow[]>([{ name: "", phone: "" }]);
  const [proceed, setProceed] = useState(false);

  if (maxGuests < 1) return null;

  const validGuests = guests.filter(isValidGuest).map((g) => ({
    name: g.name.trim(),
    phone: g.phone.trim(),
  }));
  const slotCount = (includeSelf ? 1 : 0) + validGuests.length;
  const totalLabel = formatCop(feeCop * Math.max(slotCount, 1));
  const canContinue = validGuests.length > 0;

  const updateGuest = (i: number, patch: Partial<GuestRow>) =>
    setGuests((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const addGuest = () =>
    setGuests((prev) => (prev.length >= maxGuests ? prev : [...prev, { name: "", phone: "" }]));
  const removeGuest = (i: number) =>
    setGuests((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  if (proceed && canContinue) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        <p style={{ fontSize: "0.85rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)" }}>
          {includeSelf
            ? `Pagas tu cupo y ${validGuests.length} invitado(s).`
            : `Pagas ${validGuests.length} invitado(s).`}
        </p>
        <MatchPaymentCheckout
          matchId={matchId}
          orgFeeCop={feeCop}
          includeSelf={includeSelf}
          guests={validGuests}
        />
        <button onClick={() => setProceed(false)} style={ghostBtn}>
          ← Editar invitados
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={openBtn}>
        <PlusIcon />
        Invitar a alguien y pagar su cupo
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <div>
        <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.2rem" }}>
          Invitar jugadores
        </p>
        <p style={{ fontSize: "0.82rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.5 }}>
          Agrega a quien quieras invitar y paga su cupo. No necesitan cuenta en PadelYa.
        </p>
      </div>

      {guests.map((guest, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <input
              value={guest.name}
              onChange={(e) => updateGuest(i, { name: e.target.value })}
              placeholder="Nombre"
              style={inputStyle}
              maxLength={80}
            />
            <input
              value={guest.phone}
              onChange={(e) => updateGuest(i, { phone: e.target.value })}
              placeholder="Celular (ej. 300 123 4567)"
              inputMode="tel"
              style={inputStyle}
              maxLength={20}
            />
          </div>
          {guests.length > 1 && (
            <button onClick={() => removeGuest(i)} aria-label="Quitar invitado" style={removeBtn}>
              ×
            </button>
          )}
        </div>
      ))}

      {guests.length < maxGuests && (
        <button onClick={addGuest} style={ghostBtn}>
          + Agregar otro invitado
        </button>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid var(--border)",
          paddingTop: "0.75rem",
        }}
      >
        <span style={{ fontSize: "0.85rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)" }}>
          Total ({slotCount} cupo{slotCount === 1 ? "" : "s"})
        </span>
        <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)", fontFamily: "var(--font-montserrat)" }}>
          {totalLabel}
        </span>
      </div>

      <button
        onClick={() => setProceed(true)}
        disabled={!canContinue}
        style={{ ...primaryBtn, opacity: canContinue ? 1 : 0.5, cursor: canContinue ? "pointer" : "not-allowed" }}
      >
        Continuar al pago
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "0.65rem 0.8rem",
  fontSize: "0.9rem",
  color: "var(--text)",
  fontFamily: "var(--font-dm-sans)",
  width: "100%",
};

const primaryBtn: React.CSSProperties = {
  background: "var(--primary)",
  color: "#ffffff",
  border: "none",
  borderRadius: "12px",
  padding: "0.875rem",
  fontWeight: 700,
  fontSize: "0.95rem",
  fontFamily: "var(--font-dm-sans)",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "0.6rem 0.875rem",
  fontSize: "0.85rem",
  color: "var(--text-2)",
  fontFamily: "var(--font-dm-sans)",
  cursor: "pointer",
};

const openBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  background: "var(--card)",
  border: "1px dashed var(--border)",
  borderRadius: "12px",
  padding: "0.875rem 1rem",
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "var(--text)",
  fontFamily: "var(--font-dm-sans)",
  cursor: "pointer",
  width: "100%",
  justifyContent: "center",
};

const removeBtn: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  width: "32px",
  height: "32px",
  fontSize: "1.1rem",
  color: "var(--text-2)",
  cursor: "pointer",
  flexShrink: 0,
};

function PlusIcon() {
  return (
    <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
