"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { APP_CONFIG } from "@/config/business";

interface Props {
  matchId: string;
  orgFeeCop?: number;
}

export function WompiCheckoutButton({ matchId, orgFeeCop }: Props) {
  const [step, setStep] = useState<"idle" | "confirm" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  const serviceFee = APP_CONFIG.platformFeeCop;
  const totalCop = (orgFeeCop ?? 0) + serviceFee;

  async function handleCheckout() {
    setStep("loading");
    setError(null);

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });

      const payload = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? "No fue posible iniciar el pago");
      }

      window.location.href = payload.checkoutUrl;
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "No fue posible iniciar el pago",
      );
      setStep("idle");
    }
  }

  if (step === "confirm") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {/* Cost breakdown */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "1.1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
            Resumen del pago
          </p>
          {orgFeeCop != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
              <span style={{ color: "var(--text-2)" }}>Cupo del partido</span>
              <span style={{ color: "var(--text)", fontWeight: 500 }}>{fmt(orgFeeCop)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
            <span style={{ color: "var(--text-2)" }}>Servicio de plataforma</span>
            <span style={{ color: "var(--text)", fontWeight: 500 }}>{fmt(serviceFee)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.95rem",
              fontWeight: 700,
              paddingTop: "0.5rem",
              borderTop: "1px solid var(--border)",
              marginTop: "0.25rem",
            }}
          >
            <span style={{ color: "var(--text)" }}>Total</span>
            <span style={{ color: "var(--primary)" }}>{orgFeeCop != null ? fmt(totalCop) : "Ver en Wompi"}</span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          style={{
            background: "var(--primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: "12px",
            padding: "0.875rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            fontFamily: "var(--font-dm-sans)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            width: "100%",
          }}
        >
          <LockIcon />
          Confirmar y pagar con Wompi
        </button>

        <button
          onClick={() => setStep("idle")}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-3)",
            fontSize: "0.82rem",
            cursor: "pointer",
            fontFamily: "var(--font-dm-sans)",
            padding: "0.25rem",
          }}
        >
          ← Volver
        </button>

        <p style={{ color: "var(--text-3)", fontSize: "0.75rem", textAlign: "center", fontFamily: "var(--font-dm-sans)" }}>
          Este es el valor final que se cobrará en Wompi (Nequi, PSE o tarjeta).
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Button
        onClick={() => setStep("confirm")}
        disabled={step === "loading"}
        size="lg"
        style={{ width: "100%" }}
      >
        {step === "loading" ? (
          <>
            <SpinnerIcon />
            Redirigiendo a Wompi...
          </>
        ) : (
          <>
            <LockIcon />
            {orgFeeCop != null ? `Reservar cupo · ${fmt(totalCop)}` : "Reservar cupo y pagar"}
          </>
        )}
      </Button>

      {error && <div className="banner-danger">{error}</div>}

      <p style={{ color: "var(--text-3)", fontSize: "0.75rem", textAlign: "center", fontFamily: "var(--font-dm-sans)" }}>
        Pago procesado por Wompi — Nequi, PSE o tarjeta.
      </p>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

function LockIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
