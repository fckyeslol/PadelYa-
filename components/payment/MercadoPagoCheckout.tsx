"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { APP_CONFIG } from "@/config/business";
import { formatCop } from "@/utils/currency";

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale?: string },
    ) => MPInstance;
  }
}

interface MPInstance {
  bricks(): MPBricksBuilder;
}

interface MPBricksBuilder {
  create(
    type: "payment",
    containerId: string,
    config: MPBrickConfig,
  ): Promise<MPBrickController>;
}

interface MPBrickController {
  unmount(): void;
}

interface MPBrickConfig {
  initialization: { amount: number; preferenceId?: string };
  customization?: Record<string, unknown>;
  callbacks: {
    onReady?: () => void;
    onSubmit?: (data: {
      selectedPaymentMethod: string;
      formData: Record<string, unknown>;
    }) => Promise<void>;
    onError?: (error: { message: string; cause?: unknown[] }) => void;
  };
}

interface Props {
  matchId: string;
  orgFeeCop?: number;
  autoStart?: boolean;
}

type Step = "idle" | "confirm" | "initiating" | "paying" | "success" | "pending_payment";

const MP_SCRIPT = "https://sdk.mercadopago.com/js/v2";
const BRICK_CONTAINER_ID = "mp-payment-brick";

export function MercadoPagoCheckout({ matchId, orgFeeCop, autoStart = false }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [externalReference, setExternalReference] = useState<string | null>(null);
  const controllerRef = useRef<MPBrickController | null>(null);
  const autoStartedRef = useRef(false);

  const serviceFee = APP_CONFIG.platformFeeCop;
  const totalCop = (orgFeeCop ?? 0) + serviceFee;
  const totalLabel = formatCop(totalCop);

  const startCheckout = useCallback(async () => {
    setStep("initiating");
    setError(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const data = (await res.json()) as {
        preferenceId?: string;
        externalReference?: string;
        error?: string;
      };
      if (!res.ok || !data.preferenceId) {
        throw new Error(data.error ?? "No fue posible iniciar el pago");
      }
      setPreferenceId(data.preferenceId);
      setExternalReference(data.externalReference ?? null);
      setStep("paying");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error iniciando el pago");
      setStep("idle");
    }
  }, [matchId]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startCheckout();
  }, [autoStart, startCheckout]);

  useEffect(() => {
    if (step !== "success") return;
    const timer = window.setTimeout(() => window.location.reload(), 1800);
    return () => window.clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step !== "paying" || !scriptLoaded || !preferenceId) return;

    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY?.trim() ?? "";
    if (!publicKey) {
      setError("Falta configurar NEXT_PUBLIC_MP_PUBLIC_KEY en el servidor.");
      setStep("confirm");
      return;
    }

    if (!window.MercadoPago) {
      setError("No se pudo cargar el SDK de Mercado Pago. Recarga la página e intenta de nuevo.");
      setStep("confirm");
      return;
    }

    let cancelled = false;

    const mp = new window.MercadoPago(publicKey, { locale: "es-CO" });

    mp.bricks()
      .create("payment", BRICK_CONTAINER_ID, {
        initialization: { amount: totalCop },
        customization: {
          paymentMethods: {
            creditCard: "all",
            debitCard: "all",
            ticket: "all",
            bankTransfer: "all",
            mercadoPago: "none",
            atm: "none",
          },
        },
        callbacks: {
          onReady: () => {
            if (!cancelled) setError(null);
          },
          onError: (err) => {
            if (!cancelled) {
              setError(err.message ?? "Error en el formulario de pago");
            }
          },
          onSubmit: (submitPayload) => {
            if (!externalReference) {
              return Promise.reject(new Error("Referencia de pago no disponible. Intenta de nuevo."));
            }

            const payload =
              submitPayload && typeof submitPayload === "object"
                ? (submitPayload as Record<string, unknown>)
                : {};
            const brickFormData =
              payload.formData && typeof payload.formData === "object" && payload.formData !== null
                ? (payload.formData as Record<string, unknown>)
                : payload.payment_method_id || payload.token
                  ? payload
                  : {};

            if (!brickFormData.payment_method_id && !brickFormData.token) {
              const message =
                "Completa los datos del método de pago antes de continuar.";
              if (!cancelled) setError(message);
              return Promise.reject(new Error(message));
            }

            return fetch("/api/payments/process", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ formData: brickFormData, externalReference }),
            })
              .then(async (res) => {
                const result = (await res.json()) as {
                  status?: string;
                  redirectUrl?: string;
                  error?: string;
                };
                if (!res.ok) {
                  const message = result.error ?? "Error procesando el pago";
                  if (!cancelled) setError(message);
                  throw new Error(message);
                }
                if (result.redirectUrl) {
                  window.location.href = result.redirectUrl;
                  return;
                }
                if (result.status === "approved") {
                  controllerRef.current?.unmount();
                  setStep("success");
                  return;
                }
                setStep("pending_payment");
              });
          },
        },
      })
      .then((controller) => {
        if (!cancelled) controllerRef.current = controller;
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setStep("confirm");
        }
      });

    return () => {
      cancelled = true;
      controllerRef.current?.unmount();
      controllerRef.current = null;
    };
  }, [step, scriptLoaded, preferenceId, totalCop, externalReference]);

  return (
    <>
      <Script
        src={MP_SCRIPT}
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        onError={() => {
          setError("No se pudo cargar Mercado Pago. Verifica tu conexión e intenta de nuevo.");
        }}
      />

      {step === "success" && (
        <div
          style={{
            background: "rgba(22,101,52,0.07)",
            border: "1px solid rgba(22,101,52,0.22)",
            borderRadius: "14px",
            padding: "1.25rem",
            textAlign: "center",
          }}
        >
          <p style={{ color: "var(--success)", fontWeight: 700, fontSize: "1rem", marginBottom: "0.35rem" }}>
            Pago aprobado
          </p>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
            Tu cupo está confirmado. Recargando el partido...
          </p>
        </div>
      )}

      {step === "pending_payment" && (
        <div
          style={{
            background: "rgba(146,64,14,0.07)",
            border: "1px solid rgba(146,64,14,0.22)",
            borderRadius: "14px",
            padding: "1.25rem",
            textAlign: "center",
          }}
        >
          <p style={{ color: "var(--warning)", fontWeight: 700, fontSize: "1rem", marginBottom: "0.35rem" }}>
            Pago en proceso
          </p>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
            Tu pago está siendo procesado. Te notificaremos cuando se confirme.
          </p>
        </div>
      )}

      {step === "initiating" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "1.25rem",
            textAlign: "center",
          }}
        >
          <p style={{ color: "var(--text)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.35rem" }}>
            Preparando Mercado Pago...
          </p>
          <p style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>
            Un momento, estamos cargando el formulario de pago.
          </p>
        </div>
      )}

      {step === "paying" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {!scriptLoaded && (
            <p style={{ color: "var(--text-2)", fontSize: "0.875rem", textAlign: "center" }}>
              Cargando Mercado Pago...
            </p>
          )}
          <div id={BRICK_CONTAINER_ID} />
          {error && <div className="banner-danger">{error}</div>}
          <button
            type="button"
            onClick={() => {
              controllerRef.current?.unmount();
              setStep("confirm");
            }}
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
        </div>
      )}

      {step === "confirm" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
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
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-2)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "0.25rem",
              }}
            >
              Resumen del pago
            </p>
            {orgFeeCop != null && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span style={{ color: "var(--text-2)" }}>Cupo del partido</span>
                <span style={{ color: "var(--text)", fontWeight: 500 }}>{formatCop(orgFeeCop)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
              <span style={{ color: "var(--text-2)" }}>Servicio de plataforma</span>
              <span style={{ color: "var(--text)", fontWeight: 500 }}>{formatCop(serviceFee)}</span>
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
              <span style={{ color: "var(--primary)" }}>{totalLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void startCheckout()}
            style={{
              background: "var(--primary)",
              color: "var(--primary-fg)",
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
            Confirmar y pagar
          </button>

          <button
            type="button"
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

          {error && <div className="banner-danger">{error}</div>}

          <p
            style={{
              color: "var(--text-3)",
              fontSize: "0.75rem",
              textAlign: "center",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            Pago procesado por Mercado Pago — tarjeta, PSE, Nequi o efectivo.
          </p>
        </div>
      )}

      {step === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {error && <div className="banner-danger">{error}</div>}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep("confirm");
            }}
            style={{
              background: "var(--primary)",
              color: "var(--primary-fg)",
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
            {orgFeeCop != null ? `Reservar cupo · ${totalLabel}` : "Reservar cupo y pagar"}
          </button>

          <p
            style={{
              color: "var(--text-3)",
              fontSize: "0.75rem",
              textAlign: "center",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            Pago seguro con Mercado Pago — tarjeta, PSE, Nequi o efectivo.
          </p>
        </div>
      )}
    </>
  );
}

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}
