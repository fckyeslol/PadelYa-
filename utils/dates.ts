export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    timeZone: "America/Bogota",
  }).format(new Date(value));
}
