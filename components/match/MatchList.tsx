import type { MatchPreview } from "@/types/domain";
import { MatchCard } from "@/components/match/MatchCard";

export function MatchList({ matches }: { matches: MatchPreview[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </div>
  );
}
