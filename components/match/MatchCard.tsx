import Link from "next/link";
import Image from "next/image";
import { MatchStatusBadge } from "@/components/match/MatchStatusBadge";
import { VenuePhoto } from "@/components/venue/VenuePhoto";
import { getVenueImage } from "@/config/venues";
import type { MatchPreview } from "@/types/domain";
import { resolveDisplayFeeCop } from "@/config/pricing";
import { formatCop } from "@/utils/currency";
import { formatDateTime } from "@/utils/dates";

const SKILL_COLOR: Record<string, string> = {
  beginner: "var(--success)",
  intermediate: "var(--gold)",
  advanced: "var(--danger)",
};

const SKILL_LABEL: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0]?.toUpperCase() ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1][0]?.toUpperCase() ?? "") : "";
  return first + last;
}

const AVATAR_COLORS = [
  { bg: "rgba(16,185,129,0.15)", color: "var(--primary)" },
  { bg: "rgba(96,165,250,0.15)", color: "var(--info)" },
  { bg: "rgba(245,158,11,0.15)", color: "var(--gold)" },
  { bg: "rgba(248,113,113,0.15)", color: "var(--danger)" },
];

export function MatchCard({ match }: { match: MatchPreview }) {
  const csvFee = resolveDisplayFeeCop(match.venueName, match.scheduledAt);
  const { paidCount, playerNames, playerAvatars, maxPlayers = 4 } = match;
  const spotsLeft = maxPlayers - paidCount;
  const isOpen = match.status === "open";
  const isFull = match.status === "full";
  const isUrgent = isOpen && spotsLeft <= 1;
  const venueImage = getVenueImage(match.venueName);

  return (
    <article
      className="card-lift group rounded-2xl overflow-hidden"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      {venueImage ? (
        <VenuePhoto venueName={match.venueName} height={130} rounded="0" />
      ) : (
        <div
          style={{
            height: "3px",
            background: isOpen ? "var(--primary)" : isFull ? "var(--info)" : "var(--border)",
          }}
        />
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3
              style={{
                fontFamily: "var(--font-montserrat)",
                fontWeight: 700,
                fontSize: "1.05rem",
                color: "var(--text)",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                marginBottom: "0.25rem",
              }}
              className="truncate"
            >
              {match.venueName}
            </h3>
            <p style={{ color: "var(--text-2)", fontSize: "0.82rem" }}>
              {formatDateTime(match.scheduledAt)}
            </p>
          </div>
          <MatchStatusBadge status={match.status} />
        </div>

        {/* Urgency chip */}
        {isUrgent && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.25)",
              borderRadius: "999px",
              padding: "0.2rem 0.65rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--danger)",
              marginBottom: "0.75rem",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger)", flexShrink: 0 }} />
            {spotsLeft === 0 ? "¡Último cupo!" : "1 cupo disponible"}
          </div>
        )}

        {/* Info row */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "999px",
              padding: "0.25rem 0.7rem",
              fontSize: "0.78rem",
              fontWeight: 500,
              color: "var(--text-2)",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: SKILL_COLOR[match.skillLevel] ?? "var(--text-3)",
                flexShrink: 0,
              }}
            />
            {SKILL_LABEL[match.skillLevel] ?? match.skillLevel}
          </span>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "var(--gold)",
            }}
          >
            <CopIcon />
            {formatCop(csvFee ?? match.orgFeeCop)} / jugador
          </span>
        </div>

        {/* Social proof + slots */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.1rem",
          }}
        >
          {/* Player avatars */}
          <div style={{ display: "flex", alignItems: "center" }}>
            {playerNames.length > 0 ? (
              <>
                <div style={{ display: "flex", marginRight: "0.5rem" }}>
                  {playerNames.map((name, i) => {
                    const avatarUrl = playerAvatars[i] ?? null;
                    const colors = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    return (
                      <span
                        key={i}
                        title={name}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          marginLeft: i === 0 ? 0 : "-8px",
                          border: "2px solid var(--card)",
                          flexShrink: 0,
                          overflow: "hidden",
                          position: "relative",
                          ...(!avatarUrl ? colors : { background: "transparent" }),
                        }}
                      >
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={name}
                            fill
                            style={{ objectFit: "cover" }}
                            sizes="28px"
                          />
                        ) : (
                          initials(name)
                        )}
                      </span>
                    );
                  })}
                </div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>
                  {playerNames.length === 1
                    ? playerNames[0].split(" ")[0]
                    : `${playerNames[0].split(" ")[0]} +${playerNames.length - 1}`}
                </span>
              </>
            ) : (
              <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
                Sé el primero en unirte
              </span>
            )}
          </div>

          {/* Slot bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {Array.from({ length: maxPlayers }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: "22px",
                  height: "5px",
                  borderRadius: "3px",
                  background: i < paidCount ? "var(--primary)" : "var(--border)",
                  transition: "background 0.2s",
                }}
              />
            ))}
            <span style={{ fontSize: "0.72rem", color: "var(--text-3)", marginLeft: "4px" }}>
              {paidCount}/{maxPlayers}
            </span>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={`/matches/${match.id}`}
          className="block text-center"
          style={{
            background: isOpen ? "var(--primary)" : "var(--surface)",
            color: isOpen ? "var(--primary-fg)" : "var(--text-2)",
            borderRadius: "10px",
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            fontFamily: "var(--font-dm-sans)",
            border: isOpen ? "none" : "1px solid var(--border)",
            transition: "opacity 0.15s ease",
          }}
        >
          {isOpen ? "Unirme →" : "Ver partido →"}
        </Link>
      </div>
    </article>
  );
}

function CopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
    </svg>
  );
}
