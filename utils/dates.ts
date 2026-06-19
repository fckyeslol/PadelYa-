export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    timeZone: "America/Bogota",
  }).format(new Date(value));
}

/**
 * Format a date-time range like "17/06/2026, 7:00 p. m. - 8:30 p. m."
 * Uses scheduledAt as the start and adds durationMinutes to compute the end.
 */
export function formatDateTimeRange(
  scheduledAt: string,
  durationMinutes: 60 | 90 | 120,
): string {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const dateFmt = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    timeZone: "America/Bogota",
  });

  const timeFmt = new Intl.DateTimeFormat("es-CO", {
    timeStyle: "short",
    hour12: true,
    timeZone: "America/Bogota",
  });

  return `${dateFmt.format(start)} - ${timeFmt.format(end)}`;
}
