"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatCop } from "@/utils/currency";
import {
  BrickLoadingOverlay,
  GhostButton,
  IdlePriceHero,
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
    WidgetCheckout?: new (config: WompiWidgetConfig) => WompiWidget;
  }
}

interface WompiWidgetConfig {
  currency: "COP";
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature: { integrity: string };
  redirectUrl?: string;
}

interface WompiWidget {
  open: (callback: (result: { transaction: WompiTransaction }) => void) => void;
}

interface WompiTransaction {
  id: string;
  status: "APPROVED" | "DECLINED" | "VOIDED" | "PENDING" | "ERROR";
  reference: string;
  amount_in_cents: number;
  payment_method_type: string;
}

interface CheckoutParams {
  reference: string;
  amountInCents: number;
  integritySignature: string;
  publicKey: string;
  redirectUrl: string;
}

interface GuestInput {
  name: string;
  phone: string;
}

interface Props {
  matchId: string;
  orgFeeCop?: number;
  autoStart?: boolean;
  /** Whether this checkout also pays the buyer's own slot. Default true (individual flow). */
  includeSelf?: boolean;
  /** Non-registered guests whose slots this checkout funds. */
  guests?: GuestInput[];
}

type Step = "idle" | "confirm" | "initiating" | "paying" | "success" | "pending_payment";

const WOMPI_SCRIPT = "https://checkout.wompi.co/widget.js";

function funnelStep(step: Step): FunnelStepKey {
  if (step === "success" || step === "pending_payment") return "done";
  if (step === "paying" || step === "initiating") return "payment";
  return "summary";
}

export function WompiCheckout({
  matchId,
  orgFeeCop,
  autoStart = false,
  includeSelf = true,
  guests = [],
}: Props) {
  const slotCount = (includeSelf ? 1 : 0) + guests.length;
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [checkoutParams, setCheckoutParams] = useState<CheckoutParams | null>(null);
  const checkoutInFlightRef = useRef(false);
  const autoStartedRef = useRef(false);

  // La tarifa puede llegar inválida (partido sin precio para ese horario). NO se
  // puede hacer early return acá: dejaría hooks sin ejecutar y al volverse válida
  // React vería más hooks que en el render anterior. Se evalúa como flag y el
  // return vive debajo de TODOS los hooks.
  const hasValidFee = orgFeeCop != null && orgFeeCop > 0;

  /** Load Wompi script manually so we can detect when it's already cached. */
  useEffect(() => {
    // Ya cargado en una navegación previa: no hace falta marcar scriptReady.
    // El efecto que abre el widget consulta window.WidgetCheckout directamente,
    // así que setearlo acá solo provocaba un render extra.
    if (window.WidgetCheckout) return;

    const existing = document.querySelector(
      `script[src="${WOMPI_SCRIPT}"]`,
    ) as HTMLScriptElement | null;

    if (existing) {
      // Tag exists but hasn't fired yet — listen for its events.
      const onLoad = () => setScriptReady(true);
      const onError = () =>
        setError("No se pudo cargar Wompi. Verifica tu conexión e intenta de nuevo.");
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", onError);
      return () => {
        existing.removeEventListener("load", onLoad);
        existing.removeEventListener("error", onError);
      };
    }

    // First time — inject the script tag.
    const script = document.createElement("script");
    script.src = WOMPI_SCRIPT;
    script.async = true;
    script.onload = () => setScriptReady(true);
    script.onerror = () =>
      setError("No se pudo cargar Wompi. Verifica tu conexión e intenta de nuevo.");
    document.body.appendChild(script);
    // Don't remove on cleanup — it's a shared global resource.
  }, []);

  /** Step 1: fetch checkout params from server. */
  const fetchCheckoutParams = useCallback(async () => {
    if (checkoutInFlightRef.current) return;
    checkoutInFlightRef.current = true;
    setStep("initiating");
    setError(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, includeSelf, guests }),
      });
      const data = (await res.json()) as CheckoutParams & { error?: string };
      if (!res.ok || !data.reference) {
        throw new Error(data.error ?? "No fue posible iniciar el pago");
      }
      setCheckoutParams(data);
      setStep("paying");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error iniciando el pago");
      setStep("idle");
    } finally {
      checkoutInFlightRef.current = false;
    }
  }, [matchId, includeSelf, guests]);

  /** Step 2: open Wompi widget once params and script are ready. */
  useEffect(() => {
    if (step !== "paying" || !checkoutParams) return;
    // Accept either the state flag OR the global already being present (cache case).
    if (!scriptReady && !window.WidgetCheckout) return;
    if (!window.WidgetCheckout) {
      // Camino de error al integrar un sistema externo (el script de Wompi cargó
      // pero no expuso el widget). Reflejar ese fallo en el estado es justamente
      // el escape hatch que documenta React para sincronizar con algo externo;
      // no hay valor derivable del que sacarlo.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("No se pudo cargar Wompi. Recarga la página e intenta de nuevo.");
      setStep("confirm");
      return;
    }

    const checkout = new window.WidgetCheckout({
      currency: "COP",
      amountInCents: checkoutParams.amountInCents,
      reference: checkoutParams.reference,
      publicKey: checkoutParams.publicKey,
      signature: { integrity: checkoutParams.integritySignature },
      redirectUrl: checkoutParams.redirectUrl,
    });

    checkout.open((result) => {
      const tx = result?.transaction;
      if (!tx) {
        // Widget closed without a transaction (e.g. user dismissed it).
        setError("Cerraste el pago. Puedes intentarlo de nuevo cuando quieras.");
        setStep("confirm");
        return;
      }
      if (tx.status === "APPROVED") {
        setStep("success");
      } else if (tx.status === "PENDING") {
        setStep("pending_payment");
      } else {
        setError("El pago fue rechazado o cancelado. Puedes intentarlo de nuevo.");
        setStep("confirm");
      }
    });

    // Safety valve: if the widget closes without firing the callback (sandbox quirk),
    // the user can manually escape via the cancel button shown in the "paying" UI.
  }, [step, scriptReady, checkoutParams]);

  /** Auto-redirect to match page after a successful payment. */
  useEffect(() => {
    if (step !== "success") return;
    const timer = window.setTimeout(() => {
      if (checkoutParams?.redirectUrl) {
        window.location.href = `${checkoutParams.redirectUrl}?payment=approved`;
      } else {
        window.location.reload();
      }
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [step, checkoutParams]);

  /** Auto-start if triggered from match activation redirect. */
  useEffect(() => {
    // hasValidFee es imprescindible acá: antes este efecto no llegaba a correr
    // porque el early return lo cortaba. Sin el guard, un partido sin tarifa
    // válida arrancaría el checkout solo.
    if (!hasValidFee || !autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void fetchCheckoutParams();
  }, [hasValidFee, autoStart, fetchCheckoutParams]);

  // Todos los hooks ya se ejecutaron: acá sí es seguro cortar el render.
  // (La comparación va explícita, no vía hasValidFee, para que TS estreche el tipo.)
  if (orgFeeCop == null || orgFeeCop <= 0) {
    return (
      <div className="banner-danger" style={{ margin: "1rem 0" }}>
        Este partido no tiene tarifa válida para el horario reservado. El organizador debe
        actualizar la fecha u hora según EasyCancha.
      </div>
    );
  }

  const totalCop = orgFeeCop * Math.max(slotCount, 1);
  const totalLabel = formatCop(totalCop);
  const activeFunnelStep = funnelStep(step);

  return (
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
            description="Tu transacción está siendo verificada por Wompi. Te avisaremos cuando se confirme."
          />
        )}

        {(step === "initiating" || step === "paying") && (
          <>
            <OrderSummary totalLabel={totalLabel} />
            <div className={styles.brickWrap}>
              <BrickLoadingOverlay label="Abriendo checkout seguro de Wompi…" />
            </div>
            {step === "paying" && (
              <GhostButton
                onClick={() => {
                  setError("Cerraste el pago. Puedes intentarlo de nuevo cuando quieras.");
                  setStep("confirm");
                }}
              >
                ← Cancelar pago
              </GhostButton>
            )}
          </>
        )}

        {step === "confirm" && (
          <>
            <OrderSummary totalLabel={totalLabel} />
            {error && <PaymentError message={error} />}
            <PrimaryButton onClick={() => void fetchCheckoutParams()}>
              <LockIcon />
              Continuar al pago
            </PrimaryButton>
            <GhostButton onClick={() => setStep("idle")}>← Volver al resumen</GhostButton>
            <div className={styles.divider} />
            <TrustStrip />
            <WompiBadge />
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
            <WompiBadge />
          </>
        )}
    </PaymentFunnelShell>
  );
}

function WompiBadge() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.4rem",
        fontSize: "0.75rem",
        color: "var(--text-3)",
        fontFamily: "var(--font-dm-sans)",
        marginTop: "0.5rem",
      }}
    >
      <span>Procesado por</span>
      <span style={{ fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.03em" }}>
        wompi
      </span>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width={16}
      height={16}
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
