"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { formatCop } from "@/utils/currency";
import {
  BrickLoadingOverlay,
  GhostButton,
  IdlePriceHero,
  MercadoPagoBadge,
  OrderSummary,
  PaymentError,
  PaymentFunnelShell,
  PrimaryButton,
  StatusPending,
  StatusSuccess,
  TrustStrip,
  type FunnelStepKey,
} from "@/components/payment/PaymentFunnelUI";
import styles from "@/components/payment/payment-funnel.module.css";

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

function funnelStep(step: Step): FunnelStepKey {
  if (step === "success" || step === "pending_payment") return "done";
  if (step === "paying" || step === "initiating") return "payment";
  return "summary";
}

export function MercadoPagoCheckout({ matchId, orgFeeCop, autoStart = false }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [externalReference, setExternalReference] = useState<string | null>(null);
  const [brickReady, setBrickReady] = useState(false);
  const controllerRef = useRef<MPBrickController | null>(null);
  const brickReadyRef = useRef(false);
  const autoStartedRef = useRef(false);
  const checkoutInFlightRef = useRef(false);

  if (orgFeeCop == null || orgFeeCop <= 0) {
    return (
      <div className="banner-danger" style={{ margin: "1rem 0" }}>
        Este partido no tiene tarifa válida para el horario reservado. El organizador debe
        actualizar la fecha u hora según EasyCancha.
      </div>
    );
  }
  const totalCop = orgFeeCop;
  const totalLabel = formatCop(totalCop);
  const activeFunnelStep = funnelStep(step);
  const brickLoading = step === "paying" && (!scriptLoaded || !brickReady);

  const startCheckout = useCallback(async () => {
    if (checkoutInFlightRef.current) return;
    checkoutInFlightRef.current = true;
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
      if (!res.ok || !data.externalReference) {
        throw new Error(data.error ?? "No fue posible iniciar el pago");
      }
      setExternalReference(data.externalReference);
      setBrickReady(false);
      setStep("paying");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error iniciando el pago");
      setStep("idle");
    } finally {
      checkoutInFlightRef.current = false;
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
    if (step !== "paying") {
      brickReadyRef.current = false;
      setBrickReady(false);
      return;
    }
    if (!scriptLoaded || !externalReference) return;

    brickReadyRef.current = false;
    setBrickReady(false);

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
            bankTransfer: "pse",
          },
        },
        callbacks: {
          onReady: () => {
            if (!cancelled) {
              brickReadyRef.current = true;
              setBrickReady(true);
              setError(null);
            }
          },
          onError: (err) => {
            if (!cancelled) {
              brickReadyRef.current = false;
              setBrickReady(false);
              setError(err.message ?? "Error en el formulario de pago");
              setStep("confirm");
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

            const brickTd =
              brickFormData.transaction_details &&
              typeof brickFormData.transaction_details === "object"
                ? (brickFormData.transaction_details as Record<string, unknown>)
                : null;
            const hasPaymentData =
              Boolean(brickFormData.token) ||
              Boolean(brickFormData.payment_method_id) ||
              Boolean(brickFormData.financial_institution) ||
              Boolean(brickTd?.financial_institution);

            if (!hasPaymentData) {
              const message = "Completa los datos del método de pago antes de continuar.";
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
          brickReadyRef.current = false;
          setBrickReady(false);
          setError(err.message || "No se pudo cargar el formulario de Mercado Pago");
          setStep("confirm");
        }
      });

    const loadTimeout = window.setTimeout(() => {
      if (!cancelled && !brickReadyRef.current) {
        brickReadyRef.current = false;
        setBrickReady(false);
        setError("Mercado Pago tardó demasiado en cargar. Intenta de nuevo.");
        setStep("confirm");
      }
    }, 20000);

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimeout);
      controllerRef.current?.unmount();
      controllerRef.current = null;
    };
  }, [step, scriptLoaded, externalReference, totalCop]);

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

      <PaymentFunnelShell activeStep={activeFunnelStep}>
        {step === "success" && (
          <StatusSuccess
            title="Pago aprobado"
            description="Tu cupo está confirmado. Estamos actualizando el partido…"
          />
        )}

        {step === "pending_payment" && (
          <StatusPending
            title="Pago en proceso"
            description="Tu transacción está siendo verificada. Te avisaremos en cuanto se confirme."
          />
        )}

        {step === "initiating" && (
          <>
            <OrderSummary totalLabel={totalLabel} />
            <div className={styles.brickWrap}>
              <BrickLoadingOverlay label="Preparando checkout seguro…" />
            </div>
          </>
        )}

        {step === "paying" && (
          <>
            <OrderSummary totalLabel={totalLabel} />
            <div className={styles.brickWrap}>
              {brickLoading && <BrickLoadingOverlay label="Cargando métodos de pago…" />}
              <div className={styles.brickHost}>
                <div id={BRICK_CONTAINER_ID} />
              </div>
            </div>
            {error && <PaymentError message={error} />}
            <div className={styles.actions}>
              <GhostButton
                onClick={() => {
                  controllerRef.current?.unmount();
                  setStep("confirm");
                }}
              >
                ← Cambiar método de pago
              </GhostButton>
            </div>
            <MercadoPagoBadge />
          </>
        )}

        {step === "confirm" && (
          <>
            <OrderSummary totalLabel={totalLabel} />
            {error && <PaymentError message={error} />}
            <PrimaryButton onClick={() => void startCheckout()}>
              <LockIcon />
              Continuar al pago
            </PrimaryButton>
            <GhostButton onClick={() => setStep("idle")}>← Volver al resumen</GhostButton>
            <div className={styles.divider} />
            <TrustStrip />
            <MercadoPagoBadge />
          </>
        )}

        {step === "idle" && (
          <>
            <IdlePriceHero totalLabel={totalLabel} />
            <OrderSummary totalLabel={totalLabel} />
            {error && <PaymentError message={error} />}
            <PrimaryButton
              onClick={() => {
                setError(null);
                setStep("confirm");
              }}
            >
              <LockIcon />
              Continuar
            </PrimaryButton>
            <div className={styles.divider} />
            <TrustStrip />
            <MercadoPagoBadge />
          </>
        )}
      </PaymentFunnelShell>
    </>
  );
}

function LockIcon() {
  return (
    <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}
