/** Deterministic COP formatting — safe for SSR hydration (no Intl locale drift). */
export function formatCop(value: number): string {
  const n = Math.round(Math.abs(value));
  const digits = n.toString();
  const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$ ${withDots}`;
}
