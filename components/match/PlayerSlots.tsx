import Image from "next/image";
import Link from "next/link";
import { sanitizeDisplayName } from "@/utils/name";

type ProfileData = { full_name?: string; avatar_url?: string | null } | null;

type PlayerRow = {
  id: string;
  player_id?: string;
  status: string;
  profiles?: ProfileData | ProfileData[];
};

function getProfile(player: PlayerRow): { name: string; avatar: string | null } {
  const p = Array.isArray(player.profiles) ? player.profiles[0] : player.profiles;
  return {
    name: sanitizeDisplayName(p?.full_name ?? "Jugador", "Jugador"),
    avatar: p?.avatar_url ?? null,
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_BG = [
  { bg: "rgba(16,185,129,0.12)", color: "var(--primary)" },
  { bg: "rgba(96,165,250,0.12)", color: "var(--info)" },
  { bg: "rgba(245,158,11,0.12)", color: "var(--gold)" },
  { bg: "rgba(248,113,113,0.12)", color: "var(--danger)" },
];

const STATUS_LABEL: Record<string, string> = {
  paid: "Confirmado",
  pending_payment: "Pendiente de pago",
};

const STATUS_DOT: Record<string, string> = {
  paid: "slot-dot-filled",
  pending_payment: "slot-dot-pending",
};

export function PlayerSlots({ players }: { players: PlayerRow[] }) {
  const slots = Array.from({ length: 4 }).map((_, i) => players[i] ?? null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
      {slots.map((player, index) => {
        const { name, avatar } = player ? getProfile(player) : { name: "", avatar: null };
        const colors = AVATAR_BG[index % AVATAR_BG.length];

        return (
          <div
            key={index}
            style={{
              background: player ? "var(--card)" : "var(--surface)",
              border: player ? "1px solid var(--border)" : "1px dashed var(--border)",
              borderRadius: "12px",
              padding: "0.75rem 0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              transition: "border-color 0.2s ease",
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                flexShrink: 0,
                overflow: "hidden",
                position: "relative",
                background: player ? colors.bg : "var(--border)",
                border: `1px solid ${player ? "var(--border)" : "var(--border)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {player && avatar ? (
                <Image
                  src={avatar}
                  alt={name}
                  fill
                  style={{ objectFit: "cover" }}
                  sizes="38px"
                />
              ) : (
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-dm-sans)",
                    color: player ? colors.color : "var(--text-3)",
                    lineHeight: 1,
                  }}
                >
                  {player ? initials(name) : (index + 1).toString()}
                </span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {player?.player_id ? (
                <Link
                  href={`/players/${player.player_id}`}
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "var(--text)",
                    fontFamily: "var(--font-dm-sans)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "underline",
                    display: "inline-block",
                    maxWidth: "100%",
                  }}
                >
                  {name}
                </Link>
              ) : (
                <p
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: player ? "var(--text)" : "var(--text-3)",
                    fontFamily: "var(--font-dm-sans)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {player ? name : `Cupo ${index + 1}`}
                </p>
              )}
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
          </div>
        );
      })}
    </div>
  );
}
