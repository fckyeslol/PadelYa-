"use client";

import dynamic from "next/dynamic";

export const MatchPaymentCheckout = dynamic(
  () =>
    import("@/components/payment/MercadoPagoCheckout").then((m) => m.MercadoPagoCheckout),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "1.25rem",
          textAlign: "center",
          color: "var(--text-2)",
          fontSize: "0.875rem",
        }}
      >
        Cargando formulario de pago...
      </div>
    ),
  },
);
