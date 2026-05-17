import Link from "next/link";
import type { Match } from "@/types/domain";
import { formatDateTime } from "@/utils/dates";

export function OrganizerMatchTable({ matches }: { matches: Match[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-3 py-2 text-left">Cancha</th>
            <th className="px-3 py-2 text-left">Fecha</th>
            <th className="px-3 py-2 text-left">Estado</th>
            <th className="px-3 py-2 text-left">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {matches.map((match) => (
            <tr key={match.id}>
              <td className="px-3 py-2">{match.venueName}</td>
              <td className="px-3 py-2">{formatDateTime(match.scheduledAt)}</td>
              <td className="px-3 py-2">{match.status}</td>
              <td className="px-3 py-2">
                <Link href={`/matches/${match.id}`} className="text-emerald-700 hover:underline">
                  Gestionar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
