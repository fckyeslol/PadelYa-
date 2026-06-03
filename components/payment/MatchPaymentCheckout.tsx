"use client";

import dynamic from "next/dynamic";
import { CheckoutSkeleton } from "@/components/payment/PaymentFunnelUI";

export const MatchPaymentCheckout = dynamic(
  () => import("@/components/payment/WompiCheckout").then((m) => m.WompiCheckout),
  {
    ssr: false,
    loading: () => <CheckoutSkeleton />,
  },
);
