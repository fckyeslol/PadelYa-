import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CancellationPolicyNotice } from "@/components/match/CancellationPolicyNotice";
import { CancelSpotButton } from "@/components/match/CancelSpotButton";
import { MatchRealtimeRefresher } from "@/components/match/MatchRealtimeRefresher";
import { MatchStatusBadge } from "@/components/match/MatchStatusBadge";
import { PlayerSlots } from "@/components/match/PlayerSlots";
import { OrganizerMatchActions } from "@/components/organizer/OrganizerMatchActions";
import { NoShowMarkControl } from "@/components/organizer/NoShowMarkControl";
import { PaymentStatusBanner } from "@/components/payment/PaymentStatusBanner";
import { WompiCheckoutButton } from "@/components/payment/WompiCheckoutButton";
import { WhatsAppShareButton } from "@/components/match/WhatsAppShareButton";
import { getPlayersForMatch } from "@/services/matches/operations";
import { getMatchById } from "@/services/matches/service";
import { getCurrentProfile } from "@/services/profiles/service";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatCop } from "@/utils/currency";
import { formatDateTime } from "@/utils/dates";
import { MatchChat } from "@/components/match/MatchChat";
import { MatchResultForm } from "@/components/match/MatchResultForm";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ payment?: string }>;
};

const SKILL_META: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { matchId } = await params;
  const match = await getMatchById(matchId).catch(() => null);
  if (!match) return { title: "Partido — PadelYa!" };

  const date = new Date(match.scheduledAt).toLocaleDateString("es-CO", { dateStyle: "medium" });
  const skill = SKILL_META[match.skillLevel] ?? match.skillLevel;
  const total = match.orgFeeCop + 5000;
  const description = `Partido de pádel en ${match.venueName} el ${date}. Nivel ${skill}. Únete por $${total.toLocaleString("es-CO")} COP en PadelYa!`;

  return {
    title: `${match.venueName} · ${date} — PadelYa!`,
    description,
    openGraph: {
      title: `${match.venueName} — PadelYa!`,
      description,
      siteName: "PadelYa!",
    },
  };
}

const SKILL_LABEL: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

const SKILL_COLOR: Record<string, string> = {
  beginner: "var(--success)",
  intermediate: "var(--gold)",
  advanced: "var(--danger)",
};

export default async function MatchDetailPage({ params, searchParams }: Props) {
  const [{ matchId }, query] = await Promise.all([params, searchParams]);
  let user: { id: string } | null = null;
  let match = null;
  let players: Array<{
    id: string;
    player_id: string;
    profiles?: { full_name?: string } | Array<{ full_name?: string }>;
    status: string;
  }> = [];
  let profile: Awaited<ReturnType<typeof getCurrentProfile>> = null;
  let setupError: string | null = null;
  let initialMessages: Array<{
    id: string;
    playerId: string;
    playerName: string;
    playerAvatar: string | null;
    content: string;
    createdAt: string;
  }> = [];
  let existingResult: {
    set1_team1: number; set1_team2: number;
    set2_team1: number; set2_team2: number;
    set3_team1?: number | null; set3_team2?: number | null;
    winner_team: number;
  } | null = null;

  try {
    const supabase = await getSupabaseServerClient();
    const authResponse = await supabase.auth.getUser();
    user = authResponse.data.user ? { id: authResponse.data.user.id } : null;
    [match, players, profile] = await Promise.all([
      getMatchById(matchId),
      getPlayersForMatch(matchId),
      getCurrentProfile(),
    ]);

    // Load chat messages
    const { data: msgs } = await supabase
      .from("match_messages")
      .select("id, player_id, content, created_at, profiles(full_name, avatar_url)")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (msgs) {
      initialMessages = msgs.map((m) => ({
        id: m.id,
        playerId: m.player_id,
        playerName: (Array.isArray(m.profiles) ? m.profiles[0]?.full_name : (m.profiles as { full_name?: string } | null)?.full_name) ?? "Jugador",
        playerAvatar: (Array.isArray(m.profiles) ? m.profiles[0]?.avatar_url : (m.profiles as { avatar_url?: string | null } | null)?.avatar_url) ?? null,
        content: m.content,
        createdAt: m.created_at,
      }));
    }

    // Load existing result
    const { data: res } = await supabase
      .from("match_results")
      .select("set1_team1,set1_team2,set2_team1,set2_team2,set3_team1,set3_team2,winner_team")
      .eq("match_id", matchId)
      .maybeSingle();

    existingResult = res ?? null;
  } catch (error) {
    setupError =
      error instanceof Error ? error.message : "Supabase is not configured yet.";
  }

  if (!match && !setupError) return notFound();

  if (setupError) {
    return (
      <div
        className="mx-auto w-full max-w-3xl px-6 py-10"
        style={{ background: "var(--bg)", minHeight: "100vh" }}
      >
        <div
          style={{
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.25)",
            borderRadius: "12px",
            padding: "1.25rem",
            color: "var(--warning)",
            fontSize: "0.9rem",
          }}
        >
          <strong>Configuración pendiente:</strong> {setupError}.
        </div>
      </div>
    );
  }

  const myPlayer = players.find((p) => p.player_id === user?.id);
  const isParticipant = !!myPlayer;
  const isOpen = match!.status === "open";
  const isCompleted = match!.status === "completed";
  const isConfirmed = match!.status === "confirmed";
  const paidCount = players.filter((p) => p.status === "paid").length;
  const canChat =
    match!.hostPlayerId === user?.id ||
    (!!myPlayer &&
      (myPlayer.status === "paid" || myPlayer.status === "pending_payment"));
  const canRecordResult = (isCompleted || isConfirmed) && canChat;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <MatchRealtimeRefresher matchId={match!.id} />

      {/* Back link */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl px-6 py-3">
          <Link
            href="/matches"
            style={{
              color: "var(--text-2)",
              fontSize: "0.82rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontFamily: "var(--font-dm-sans)",
              transition: "color 0.15s ease",
            }}
            className="hover:text-[var(--text)]"
          >
            ← Volver a partidos
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* Payment status banner */}
        <PaymentStatusBanner status={query.payment} />

        {/* Match hero card */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            overflow: "hidden",
          }}
        >
          {/* Accent bar */}
          <div
            style={{
              height: "4px",
              background: isOpen
                ? "linear-gradient(90deg, var(--primary), var(--primary-dim))"
                : "var(--border)",
            }}
          />

          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h1
                  style={{
                    fontFamily: "var(--font-syne)",
                    fontWeight: 800,
                    fontSize: "clamp(1.4rem, 3vw, 1.9rem)",
                    letterSpacing: "-0.025em",
                    color: "var(--text)",
                    marginBottom: "0.3rem",
                  }}
                >
                  {match!.venueName}
                </h1>
                <p style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>
                  {formatDateTime(match!.scheduledAt)}
                </p>
              </div>
              <MatchStatusBadge status={match!.status} />
            </div>

            {/* Meta chips */}
            <div className="flex flex-wrap gap-3">
              <Chip>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: SKILL_COLOR[match!.skillLevel] ?? "var(--text-3)",
                    flexShrink: 0,
                  }}
                />
                {SKILL_LABEL[match!.skillLevel] ?? match!.skillLevel}
              </Chip>
              <Chip style={{ color: "var(--gold)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                </svg>
                Cuota base: {formatCop(match!.orgFeeCop)}
              </Chip>
              <Chip>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                {paidCount}/4 confirmados
              </Chip>
            </div>
          </div>
        </div>

        {/* Player slots */}
        <Section title="Cupos del partido" subtitle={`${paidCount} de 4 jugadores confirmados`}>
          <PlayerSlots players={players} />
          <p style={{ color: "var(--text-3)", fontSize: "0.78rem", marginTop: "0.6rem" }}>
            Toca el nombre de un jugador para ver su perfil público y conectar.
          </p>
        </Section>

        {/* Join / payment */}
        <Section title="Reserva tu cupo">
          {isOpen ? (
            !user ? (
              /* ── Anon gate ──────────────────────────────── */
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center", textAlign: "center", padding: "0.5rem 0" }}>
                  <span
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--primary)",
                    }}
                  >
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.3rem" }}>
                      Crea tu cuenta para unirte
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-2)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.5 }}>
                      Es gratis. Agrega tu foto, elige tu nivel y reserva tu cupo en segundos.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/login?next=/matches/${match!.id}`}
                  style={{
                    display: "block",
                    background: "var(--primary)",
                    color: "#ffffff",
                    borderRadius: "12px",
                    padding: "0.875rem",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    fontFamily: "var(--font-dm-sans)",
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Crear cuenta o iniciar sesión →
                </Link>
                <p style={{ fontSize: "0.75rem", color: "var(--text-3)", textAlign: "center", fontFamily: "var(--font-dm-sans)" }}>
                  Ya tienes cuenta? El link te lleva directo al partido.
                </p>
              </div>
            ) : (
              /* ── Auth user ──────────────────────────────── */
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                <WompiCheckoutButton matchId={match!.id} orgFeeCop={match!.orgFeeCop} />
                {isParticipant && (
                  <div style={{ marginTop: "0.25rem" }}>
                    <CancelSpotButton matchId={match!.id} />
                  </div>
                )}
              </div>
            )
          ) : (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "1.25rem",
                textAlign: "center",
                color: "var(--text-2)",
                fontSize: "0.9rem",
              }}
            >
              Este partido ya no está disponible para nuevas inscripciones.
            </div>
          )}
        </Section>

        {/* Chat del partido */}
        {canChat && (
          <Section title="Chat del partido">
            <MatchChat
              matchId={match!.id}
              currentUserId={user?.id ?? null}
              currentUserName={profile?.fullName ?? "Yo"}
              currentUserAvatar={profile?.avatarUrl ?? null}
              initialMessages={initialMessages}
            />
          </Section>
        )}

        {/* Resultado post-partido */}
        {canRecordResult && (
          <Section title="Resultado del partido">
            {existingResult ? (
              <ResultDisplay result={existingResult} />
            ) : (
              <MatchResultForm matchId={match!.id} />
            )}
          </Section>
        )}

        {/* WhatsApp share */}
        {(isOpen || isParticipant) && (
          <WhatsAppShareButton
            matchId={match!.id}
            venueName={match!.venueName}
            scheduledAt={match!.scheduledAt}
            orgFeeCop={match!.orgFeeCop}
            spotsLeft={(match!.maxPlayers ?? 4) - paidCount}
            isParticipant={isParticipant}
          />
        )}

        {/* Cancellation policy */}
        <CancellationPolicyNotice />

        {/* Organizer panel */}
        {profile?.role === "organizer" && (
          <Section
            title="Panel organizador"
            style={{ borderColor: "rgba(30,58,110,0.2)" }}
          >
            <OrganizerMatchActions matchId={match!.id} />
            {players.length > 0 && (
              <div style={{ marginTop: "1.25rem" }}>
                <p
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "var(--text-2)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: "0.75rem",
                  }}
                >
                  Marcar no-show
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {players.map((player) => (
                    <div
                      key={player.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        padding: "0.6rem 0.875rem",
                      }}
                    >
                      <span style={{ fontSize: "0.875rem", color: "var(--text)" }}>
                        {(Array.isArray(player.profiles)
                          ? player.profiles[0]?.full_name
                          : player.profiles?.full_name) ?? "Jugador"}
                      </span>
                      <NoShowMarkControl matchPlayerId={player.id} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function Section({
  title,
  subtitle,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "20px",
        padding: "1.5rem",
        ...style,
      }}
    >
      <div style={{ marginBottom: "1rem" }}>
        <h2
          style={{
            fontFamily: "var(--font-syne)",
            fontWeight: 700,
            fontSize: "1.05rem",
            color: "var(--text)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ color: "var(--text-2)", fontSize: "0.82rem", marginTop: "0.15rem" }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function ResultDisplay({ result }: {
  result: {
    set1_team1: number; set1_team2: number;
    set2_team1: number; set2_team2: number;
    set3_team1?: number | null; set3_team2?: number | null;
    winner_team: number;
  }
}) {
  const sets = [
    [result.set1_team1, result.set1_team2],
    [result.set2_team1, result.set2_team2],
    ...(result.set3_team1 != null ? [[result.set3_team1, result.set3_team2 ?? 0]] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {sets.map(([t1, t2], i) => (
          <div
            key={i}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "0.5rem 1rem",
              textAlign: "center",
              minWidth: "80px",
            }}
          >
            <p style={{ fontSize: "0.68rem", color: "var(--text-3)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.2rem" }}>
              Set {i + 1}
            </p>
            <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-syne)", letterSpacing: "-0.02em" }}>
              {t1}–{t2}
            </p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--primary)", fontFamily: "var(--font-dm-sans)" }}>
        Ganó Pareja {result.winner_team}
      </p>
    </div>
  );
}

function Chip({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "999px",
        padding: "0.3rem 0.75rem",
        fontSize: "0.8rem",
        fontWeight: 500,
        color: "var(--text-2)",
        fontFamily: "var(--font-dm-sans)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
