"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./payment-funnel.module.css";

export type FunnelStepKey = "summary" | "payment" | "done";

const STEPS: { key: FunnelStepKey; label: string; num: number }[] = [
  { key: "summary", label: "Resumen", num: 1 },
  { key: "payment", label: "Pago", num: 2 },
  { key: "done", label: "Confirmación", num: 3 },
];

function stepState(
  stepKey: FunnelStepKey,
  active: FunnelStepKey,
): "done" | "active" | "upcoming" {
  const order: FunnelStepKey[] = ["summary", "payment", "done"];
  const ai = order.indexOf(active);
  const si = order.indexOf(stepKey);
  if (si < ai) return "done";
  if (si === ai) return "active";
  return "upcoming";
}

export function PaymentFunnelShell({
  activeStep,
  children,
}: {
  activeStep: FunnelStepKey;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.headerBadge}>
            <LockIcon size={12} />
            Pago seguro
          </span>
          <ShieldCheckIcon />
        </div>
        <h2 className={styles.headerTitle}>Reserva tu cupo</h2>
        <p className={styles.headerSub}>Checkout protegido · PadelYa</p>
      </header>

      <div className={styles.body}>
        <nav className={styles.stepper} aria-label="Pasos del pago">
          {STEPS.map((s) => {
            const state = stepState(s.key, activeStep);
            return (
              <div
                key={s.key}
                className={[
                  styles.step,
                  state === "active" ? styles.stepActive : "",
                  state === "done" ? styles.stepDone : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className={styles.stepDot} aria-current={state === "active" ? "step" : undefined}>
                  {state === "done" ? <CheckIcon /> : s.num}
                </span>
                <span className={styles.stepLabel}>{s.label}</span>
              </div>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}

export function OrderSummary({ totalLabel }: { totalLabel: string }) {
  return (
    <section className={styles.summary} aria-label="Resumen del pedido">
      <div className={styles.summaryHead}>Tu cupo</div>
      <div className={styles.summaryTotal}>
        <span className={styles.summaryTotalLabel}>Total a pagar</span>
        <span className={styles.summaryTotalValue}>{totalLabel}</span>
      </div>
    </section>
  );
}

export function TrustStrip() {
  return (
    <>
      <div className={styles.trust}>
        <div className={styles.trustItem}>
          <span className={styles.trustIcon}>
            <LockIcon size={14} />
          </span>
          <span className={styles.trustText}>Conexión cifrada SSL</span>
        </div>
        <div className={styles.trustItem}>
          <span className={styles.trustIcon}>
            <CardIcon />
          </span>
          <span className={styles.trustText}>Tarjeta, PSE y más</span>
        </div>
        <div className={styles.trustItem}>
          <span className={styles.trustIcon}>
            <ShieldCheckIcon size={14} />
          </span>
          <span className={styles.trustText}>Procesado por Wompi</span>
        </div>
      </div>
      <p className={styles.legal}>
        Al continuar aceptas nuestros{" "}
        <Link href="/terms" style={{ color: "var(--text-2)", fontWeight: 600 }}>
          términos
        </Link>{" "}
        y{" "}
        <Link href="/refund-policy" style={{ color: "var(--text-2)", fontWeight: 600 }}>
          política de reembolso
        </Link>
        . No almacenamos datos de tu tarjeta.
      </p>
    </>
  );
}

/** @deprecated Use WompiBadge inside WompiCheckout instead. */
export function MercadoPagoBadge() {
  return null;
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} className={styles.btnPrimary} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className={styles.btnGhost} onClick={onClick}>
      {children}
    </button>
  );
}

export function PaymentError({ message }: { message: string }) {
  return (
    <div className={styles.errorBanner} role="alert">
      <AlertIcon />
      <span>{message}</span>
    </div>
  );
}

export function BrickLoadingOverlay({ label }: { label: string }) {
  return (
    <div className={styles.brickLoading} aria-live="polite">
      <div className={styles.spinner} aria-hidden />
      <span style={{ fontSize: "0.82rem", color: "var(--text-2)", fontWeight: 600 }}>{label}</span>
    </div>
  );
}

export function CheckoutSkeleton() {
  return (
    <div className={styles.shell}>
      <div className={styles.header} style={{ minHeight: 88 }} />
      <div className={styles.body}>
        <div className={styles.skeleton}>
          <div className={styles.skeletonLine} />
          <div className={styles.skeletonLine} />
          <div className={styles.skeletonLine} />
        </div>
      </div>
    </div>
  );
}

export function StatusSuccess({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.statusCard}>
      <div className={`${styles.statusIcon} ${styles.statusIconSuccess}`}>
        <CheckIcon size={28} />
      </div>
      <p className={`${styles.statusTitle} ${styles.statusTitleSuccess}`}>{title}</p>
      <p className={styles.statusDesc}>{description}</p>
    </div>
  );
}

export function StatusPending({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.statusCard}>
      <div className={`${styles.statusIcon} ${styles.statusIconPending}`}>
        <ClockIcon />
      </div>
      <p className={`${styles.statusTitle} ${styles.statusTitlePending}`}>{title}</p>
      <p className={styles.statusDesc}>{description}</p>
    </div>
  );
}

export function IdlePriceHero({ totalLabel }: { totalLabel: string }) {
  return (
    <div className={styles.idleHero}>
      <p className={styles.idlePrice}>{totalLabel}</p>
      <p className={styles.idlePriceNote}>IVA incluido · Pago único por cupo</p>
    </div>
  );
}

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function ShieldCheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width={26} height={26} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
