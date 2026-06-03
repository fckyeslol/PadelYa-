import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { WompiReferenceChip } from "@/components/payment/WompiReferenceChip";
import {
  getPlayerPaymentHistory,
  type PaymentHistoryItem,
} from "@/services/payments/player-history";
import { formatCop } from "@/utils/currency";
import { formatDateTime } from "@/utils/dates";

export const dynamic = "force-dynamic";

type StatusKey = PaymentHistoryItem["status"];

const STATUS_LABEL: Record<StatusKey, string> = {
  approved: "Aprobado",
  pending: "En proceso",
  declined: "Rechazado",
  voided: "Anulado",
  refunded: "Reembolsado",
};

/** Visual treatment per status — matches the dark warm palette. */
const STATUS_STYLE: Record<
  StatusKey,
  { bg: string; color: string; border: string; dot: string }
> = {
  approved: {
    bg: "rgba(0, 201, 167, 0.10)",
    color: "var(--success)",
    border: "rgba(0, 201, 167, 0.28)",
    dot: "var(--success)",
  },
  pending: {
    bg: "rgba(255, 90, 31, 0.10)",
    color: "var(--gold)",
    border: "rgba(255, 90, 31, 0.28)",
    dot: "var(--gold)",
  },
  declined: {
    bg: "rgba(255, 68, 68, 0.10)",
    color: "var(--danger)",
    border: "rgba(255, 68, 68, 0.28)",
    dot: "var(--danger)",
  },
  voided: {
    bg: "rgba(94, 85, 73, 0.18)",
    color: "var(--text-2)",
    border: "rgba(94, 85, 73, 0.45)",
    dot: "var(--text-3)",
  },
  refunded: {
    bg: "rgba(77, 163, 255, 0.10)",
    color: "var(--info)",
    border: "rgba(77, 163, 255, 0.28)",
    dot: "var(--info)",
  },
};

const METHOD_LABEL: Record<string, string> = {
  CARD: "Tarjeta",
  NEQUI: "Nequi",
  BANCOLOMBIA_TRANSFER: "Bancolombia",
  PSE: "PSE",
  BANCOLOMBIA_COLLECT: "Bancolombia",
};

export default async function PaymentsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/payments");

  let payments: PaymentHistoryItem[] = [];
  let setupError: string | null = null;
  try {
    payments = await getPlayerPaymentHistory(100);
  } catch (error) {
    setupError =
      error instanceof Error ? error.message : "No se pudo cargar tu historial de pagos.";
  }

  const totals = aggregate(payments);

  return (
    <div className="app-page-shell">
      {/* Header — accent bar matches /players page */}
      <div className="app-top-section px-6 pt-8 pb-6">
        <div className="mx-auto max-w-3xl">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div style={{ width: 3, height: 52, background: "var(--primary)", flexShrink: 0 }} />
            <div>
              <p
                style={{
                  color: "var(--primary)",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)",
                  marginBottom: "0.45rem",
                }}
              >
                Cuenta · Wompi
              </p>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 900,
                  fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  color: "var(--text)",
                  lineHeight: 0.95,
                }}
              >
                Mis pagos
              </h1>
              <p style={{ color: "var(--text-2)", marginTop: "0.35rem", fontSize: "0.9rem" }}>
                Todos los pagos vinculados a tus partidos, del más reciente al más antiguo.
              </p>
            </div>
          </div>

          {/* Compact totals strip — only when there is history */}
          {payments.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "0.5rem",
              }}
            >
              <Stat label="Aprobados" value={String(totals.approvedCount)} accent="var(--success)" />
              <Stat label="En proceso" value={String(totals.pendingCount)} accent="var(--gold)" />
              <Stat
                label="Total pagado"
                value={formatCop(totals.approvedAmountCop)}
                accent="var(--primary)"
              />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-8">
        {setupError ? (
          <div className="banner-warning">
            <strong>Configuración pendiente:</strong> {setupError}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState />
        ) : (
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.75rem", listStyle: "none", padding: 0, margin: 0 }}>
            {payments.map((p) => (
              <li key={p.id}>
                <PaymentRow payment={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */

function PaymentRow({ payment }: { payment: PaymentHistoryItem }) {
  const styleSet = STATUS_STYLE[payment.status];
  const methodLabel = payment.paymentMethod
    ? (METHOD_LABEL[payment.paymentMethod] ?? payment.paymentMethod)
    : null;

  return (
    <article
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "1rem 1.1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem",
        transition: "border-color 0.18s ease",
      }}
      className="hover:border-[var(--primary)]"
    >
      {/* Row 1: venue + amount */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.85rem",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <Link
            href={`/matches/${payment.matchId}`}
            style={{
              color: "var(--text)",
              fontWeight: 700,
              fontSize: "0.95rem",
              fontFamily: "var(--font-dm-sans)",
              textDecoration: "none",
              display: "inline-block",
              lineHeight: 1.25,
            }}
            className="hover:text-[var(--primary)]"
          >
            {payment.venueName}
          </Link>
          <p
            style={{
              color: "var(--text-2)",
              fontSize: "0.8rem",
              marginTop: "0.2rem",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            {formatDateTime(payment.scheduledAt)}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "1.1rem",
              letterSpacing: "-0.01em",
              color: "var(--text)",
              lineHeight: 1,
            }}
          >
            {formatCop(payment.amountCop)}
          </p>
          <p
            style={{
              fontSize: "0.68rem",
              color: "var(--text-3)",
              marginTop: "0.25rem",
              fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            COP
          </p>
        </div>
      </div>

      {/* Row 2: status badge + meta + reference */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.55rem 0.75rem",
          paddingTop: "0.55rem",
          borderTop: "1px dashed var(--border)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            background: styleSet.bg,
            border: `1px solid ${styleSet.border}`,
            color: styleSet.color,
            borderRadius: "999px",
            padding: "0.22rem 0.6rem 0.22rem 0.55rem",
            fontSize: "0.72rem",
            fontWeight: 700,
            fontFamily: "var(--font-dm-sans)",
            letterSpacing: "0.01em",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: styleSet.dot,
              boxShadow: `0 0 6px ${styleSet.dot}`,
              flexShrink: 0,
            }}
          />
          {STATUS_LABEL[payment.status]}
        </span>

        <span
          style={{
            color: "var(--text-3)",
            fontSize: "0.74rem",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          {formatPaidOn(payment)}
          {methodLabel ? ` · ${methodLabel}` : ""}
        </span>

        {payment.wompiReference && (
          <span style={{ marginLeft: "auto", minWidth: 0 }}>
            <WompiReferenceChip reference={payment.wompiReference} />
          </span>
        )}
      </div>
    </article>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "0.65rem 0.85rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.18rem",
      }}
    >
      <span
        style={{
          fontSize: "0.65rem",
          fontWeight: 600,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "1.05rem",
          color: accent,
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "2.5rem 1.5rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--primary)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1rem",
        }}
      >
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      </div>
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "1.15rem",
          color: "var(--text)",
          textTransform: "uppercase",
          letterSpacing: "-0.01em",
          marginBottom: "0.4rem",
        }}
      >
        Aún no tienes pagos
      </h3>
      <p style={{ color: "var(--text-2)", fontSize: "0.9rem", marginBottom: "1.25rem", maxWidth: "26rem", marginInline: "auto" }}>
        Cuando confirmes tu cupo en un partido aparecerá aquí — con su estado y referencia Wompi.
      </p>
      <Link
        href="/matches"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.45rem",
          background: "var(--primary)",
          color: "var(--primary-fg)",
          borderRadius: "6px",
          padding: "0.6rem 1.15rem",
          fontWeight: 700,
          fontSize: "0.85rem",
          fontFamily: "var(--font-dm-sans)",
          textDecoration: "none",
        }}
      >
        Buscar un partido →
      </Link>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────── */

function formatPaidOn(payment: PaymentHistoryItem): string {
  const when = payment.approvedAt ?? payment.createdAt;
  return formatDateTime(when);
}

function aggregate(payments: PaymentHistoryItem[]): {
  approvedCount: number;
  pendingCount: number;
  approvedAmountCop: number;
} {
  let approvedCount = 0;
  let pendingCount = 0;
  let approvedAmountCop = 0;
  for (const p of payments) {
    if (p.status === "approved") {
      approvedCount += 1;
      approvedAmountCop += p.amountCop;
    } else if (p.status === "pending") {
      pendingCount += 1;
    }
  }
  return { approvedCount, pendingCount, approvedAmountCop };
}
