import Link from "next/link";
import Image from "next/image";
import { MatchStatusBadge } from "@/components/match/MatchStatusBadge";
import { VenuePhoto } from "@/components/venue/VenuePhoto";
import { getVenueImage } from "@/config/venues";
import type { MatchPreview } from "@/types/domain";
import { formatCop } from "@/utils/currency";
import { formatDateTime } from "@/utils/dates";

const SKILL_COLOR: Record<string, string> = {
  beginner:     "var(--success)",
  intermediate: "var(--gold)",
  advanced:     "var(--danger)",
};

const SKILL_LABEL: Record<string, string> = {
  beginner:     "Principiante",
  intermediate: "Intermedio",
  advanced:     "Avanzado",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0]?.toUpperCase() ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1][0]?.toUpperCase() ?? "") : "";
  return first + last;
}

const AVATAR_COLORS = [
  { bg: "rgba(0,201,167,0.15)",  color: "var(--success)" },
  { bg: "rgba(77,163,255,0.15)", color: "var(--info)" },
  { bg: "rgba(255,90,31,0.15)",  color: "var(--gold)" },
  { bg: "rgba(233,255,71,0.15)", color: "var(--primary)" },
];

export function MatchCard({ match }: { match: MatchPreview }) {
  const { paidCount, playerNames, playerAvatars, maxPlayers = 4 } = match;
  const spotsLeft = maxPlayers - paidCount;
  const isOpen = match.status === "open";
  const isFull = match.status === "full";
  const isUrgent = isOpen && spotsLeft <= 1;
  const venueImage = getVenueImage(match.venueName);

  const statusBorderColor = isOpen
    ? "var(--primary)"
    : isFull
      ? "var(--success)"
      : "var(--border)";

  return (
    <article
      className="card-lift group rounded-md overflow-hidden"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${statusBorderColor}`,
      }}
    >
      {venueImage && (
        <VenuePhoto venueName={match.venueName} height={120} rounded="0" />
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3
              style={{
                fontFamily: "var(--font-barlow, 'Barlow Condensed', sans-serif)",
                fontWeight: 700,
                fontSize: "1.15rem",
                color: "var(--text)",
                letterSpacing: "0.01em",
                textTransform: "uppercase",
                lineHeight: 1.1,
                marginBottom: "0.25rem",
              }}
              className="truncate"
            >
              {match.venueName}
            </h3>
            <p style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>
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
              background: "rgba(255,68,68,0.1)",
              border: "1px solid rgba(255,68,68,0.25)",
              borderRadius: "2px",
              padding: "0.2rem 0.65rem",
              fontSize: "0.72rem",
              fontWeight: 600,
              color: "var(--danger)",
              marginBottom: "0.75rem",
              fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
              letterSpacing: "0.05em",
            }}
          >
            {spotsLeft === 0 ? "¡Último cupo!" : "1 cupo libre"}
          </div>
        )}

        {/* Info row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "var(--surface-2, #1F1C17)",
              border: "1px solid var(--border)",
              borderRadius: "2px",
              padding: "0.2rem 0.65rem",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "var(--text-2)",
            }}
          >
            <span
              style={{
                width: "6px", height: "6px", borderRadius: "50%",
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
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "var(--primary)",
              fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
            }}
          >
            {formatCop(match.orgFeeCop)}
          </span>
        </div>

        {/* Players + slots */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
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
                          width: "26px", height: "26px",
                          borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.6rem", fontWeight: 700,
                          marginLeft: i === 0 ? 0 : "-7px",
                          border: "2px solid var(--card)",
                          flexShrink: 0, overflow: "hidden", position: "relative",
                          ...(!avatarUrl ? colors : { background: "transparent" }),
                        }}
                      >
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt={name} fill style={{ objectFit: "cover" }} sizes="26px" />
                        ) : (
                          initials(name)
                        )}
                      </span>
                    );
                  })}
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                  {playerNames.length === 1
                    ? playerNames[0].split(" ")[0]
                    : `${playerNames[0].split(" ")[0]} +${playerNames.length - 1}`}
                </span>
              </>
            ) : (
              <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                Sé el primero
              </span>
            )}
          </div>

          {/* Slot count — scoreboard style */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {Array.from({ length: maxPlayers }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: "20px", height: "4px", borderRadius: "2px",
                  background: i < paidCount ? "var(--primary)" : "var(--border)",
                  transition: "background 0.2s",
                }}
              />
            ))}
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--text-3)",
                marginLeft: "2px",
                fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
              }}
            >
              {paidCount}/{maxPlayers}
            </span>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={`/matches/${match.id}`}
          className="block text-center"
          style={{
            background: isOpen ? "var(--primary)" : "var(--surface-2, #1F1C17)",
            color: isOpen ? "var(--primary-fg)" : "var(--text-2)",
            borderRadius: "4px",
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.85rem",
            fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
            border: isOpen ? "none" : "1px solid var(--border)",
            transition: "opacity 0.15s ease",
            textDecoration: "none",
          }}
        >
          {isOpen ? "Unirme →" : "Ver partido →"}
        </Link>
      </div>
    </article>
  );
}
