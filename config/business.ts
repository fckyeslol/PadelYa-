export const APP_CONFIG = {
  appName: "Padel BAQ",
  city: "Barranquilla",
  /** @deprecated Usar resolveOrgFeeCopForMatch; solo fallback legacy en DB. */
  defaultFeeCop: 0,
  /** Incluido en tarifa CSV (+$20k cancha); no se suma al checkout. */
  platformFeeCop: 0,
  maxPlayersPerMatch: 4,
  organizerResponseHours: 24,
  refundWindowHours: 3,
  pendingPaymentTimeoutMinutes: 15,
} as const;

export const MATCH_STATUS = {
  open: "open",
  full: "full",
  confirmed: "confirmed",
  completed: "completed",
  cancelledUnfilled: "cancelled_unfilled",
  cancelledByOrganizer: "cancelled_by_organizer",
} as const;
