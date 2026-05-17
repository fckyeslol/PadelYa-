export const APP_CONFIG = {
  appName: "Padel BAQ",
  city: "Barranquilla",
  defaultFeeCop: 6000,
  platformFeeCop: 5000,
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
