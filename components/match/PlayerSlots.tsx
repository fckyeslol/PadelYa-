import type { CSSProperties } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/player/PlayerAvatar";
import { sanitizeDisplayName } from "@/utils/name";
import type { MatchPlayerRow } from "@/services/matches/operations";

const STATUS_LABEL: Record<string, string> = {
  paid: "Confirmado",
  pending_payment: "Pendiente de pago",
};

const STATUS_DOT: Record<string, string> = {
  paid: "slot-dot-filled",
  pending_payment: "slot-dot-pending",
};

function getDisplayName(player: MatchPlayerRow) {
  return sanitizeDisplayName(player.profiles?.full_name, "Jugador");
}

function slotContent(player: MatchPlayerRow | null, index: number) {
  const name = player ? getDisplayName(player) : "";
  const avatarUrl = player?.profiles?.avatar_url ?? null;

  return (
    <>
      {player ? (
        <PlayerAvatar name={name} avatarUrl={avatarUrl} colorIndex={index} />
      ) : (
        <PlayerAvatar name="" avatarUrl={null} colorIndex={index} emptyLabel={(index + 1).toString()} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontWeight: 600,
            fontSize: "0.85rem",
            color: player ? "var(--text)" : "var(--text-3)",
            fontFamily: "var(--font-dm-sans)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textDecoration: player?.player_id ? "underline" : "none",
          }}
        >
          {player ? (
            <>
              {name}
              {player.is_host ? (
                <span style={{ color: "var(--text-3)", fontWeight: 500, marginLeft: "0.35rem" }}>
                  · Anfitrión
                </span>
              ) : null}
            </>
          ) : (
            `Cupo ${index + 1}`
          )}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.15rem" }}>
          <span
            className={`slot-dot ${player ? (STATUS_DOT[player.status] ?? "slot-dot-empty") : "slot-dot-empty"}`}
            style={{ width: "7px", height: "7px" }}
          />
          <span style={{ fontSize: "0.7rem", color: player ? "var(--text-2)" : "var(--text-3)" }}>
            {player ? (STATUS_LABEL[player.status] ?? player.status) : "Disponible"}
          </span>
        </div>
      </div>
    </>
  );
}

const slotStyle = (filled: boolean): CSSProperties => ({
  background: filled ? "var(--card)" : "var(--surface)",
  border: filled ? "1px solid var(--border)" : "1px dashed var(--border)",
  borderRadius: "12px",
  padding: "0.75rem 0.875rem",
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  // Allow the grid item to shrink so long names truncate (ellipsis) instead
  // of overflowing the card.
  minWidth: 0,
  overflow: "hidden",
  transition: "border-color 0.2s ease, background 0.2s ease",
  textDecoration: "none",
  color: "inherit",
  cursor: filled ? "pointer" : "default",
});

/** Solo estos estados ocupan un cupo visible; cancelados/no-show se ocultan. */
const ACTIVE_SLOT_STATUSES = new Set(["paid", "pending_payment"]);

export function PlayerSlots({ players }: { players: MatchPlayerRow[] }) {
  // Cancelled / cancelled_late / no_show players stay in the DB for history,
  // but must not occupy a visible slot — the spot shows as "Disponible".
  const activePlayers = players.filter((p) => ACTIVE_SLOT_STATUSES.has(p.status));
  const slots = Array.from({ length: 4 }).map((_, i) => activePlayers[i] ?? null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
      {slots.map((player, index) => {
        const filled = Boolean(player?.player_id);

        if (filled && player) {
          return (
            <Link
              key={player.id}
              href={`/players/${player.player_id}`}
              style={slotStyle(true)}
              className="player-slot-link"
            >
              {slotContent(player, index)}
            </Link>
          );
        }

        return (
          <div key={index} style={slotStyle(false)}>
            {slotContent(player, index)}
          </div>
        );
      })}
    </div>
  );
}
