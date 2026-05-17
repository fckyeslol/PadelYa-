type KpiProps = {
  title: string;
  value: string;
};

function KpiCard({ title, value }: KpiProps) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm text-zinc-500">{title}</h3>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
    </article>
  );
}

export function AnalyticsKpiCards({
  completedMatches,
  fillRate,
  repeatRate,
}: {
  completedMatches: number;
  fillRate: number;
  repeatRate: number;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <KpiCard title="Partidos completados" value={String(completedMatches)} />
      <KpiCard title="Tasa de llenado" value={`${Math.round(fillRate * 100)}%`} />
      <KpiCard title="Jugadores recurrentes" value={`${Math.round(repeatRate * 100)}%`} />
    </div>
  );
}
