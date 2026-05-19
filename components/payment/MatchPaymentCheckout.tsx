"use client";

import dynamic from "next/dynamic";
import { CheckoutSkeleton } from "@/components/payment/PaymentFunnelUI";

export const MatchPaymentCheckout = dynamic(
  () =>
    import("@/components/payment/MercadoPagoCheckout").then((m) => m.MercadoPagoCheckout),
  {
    ssr: false,
    loading: () => <CheckoutSkeleton />,
  },
);
