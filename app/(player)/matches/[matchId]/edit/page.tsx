import { notFound, redirect } from "next/navigation";
import { getMatchById } from "@/services/matches/service";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { EditMatchForm } from "./EditMatchForm";
import type { Metadata } from "next";

type Props = { params: Promise<{ matchId: string }> };

export const metadata: Metadata = { title: "Editar partido — PadelYa!" };
export const dynamic = "force-dynamic";

export default async function EditMatchPage({ params }: Props) {
  const { matchId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const match = await getMatchById(matchId).catch(() => null);
  if (!match) return notFound();
  if (match.hostPlayerId !== user.id) redirect(`/matches/${matchId}`);
  if (!["pending_court", "open"].includes(match.status)) redirect(`/matches/${matchId}`);

  return (
    <div
      className="flex flex-1 items-start justify-center px-6 py-12"
      style={{ background: "var(--bg)" }}
    >
      <div style={{ width: "100%", maxWidth: "520px" }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1
            style={{
              fontFamily: "var(--font-syne)",
              fontWeight: 800,
              fontSize: "1.75rem",
              letterSpacing: "-0.025em",
              color: "var(--text)",
              marginBottom: "0.4rem",
            }}
          >
            Editar partido
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>
            {match.venueName} · cambios limitados según el estado actual
          </p>
        </div>

        <EditMatchForm match={match} />
      </div>
    </div>
  );
}
