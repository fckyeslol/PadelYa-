import Image from "next/image";

const AVATAR_PALETTE = [
  { bg: "rgba(16,185,129,0.12)", color: "var(--primary)" },
  { bg: "rgba(96,165,250,0.12)", color: "var(--info)" },
  { bg: "rgba(245,158,11,0.12)", color: "var(--gold)" },
  { bg: "rgba(248,113,113,0.12)", color: "var(--danger)" },
];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  colorIndex?: number;
  emptyLabel?: string;
};

export function PlayerAvatar({
  name,
  avatarUrl,
  size = 38,
  colorIndex = 0,
  emptyLabel,
}: Props) {
  const colors = AVATAR_PALETTE[colorIndex % AVATAR_PALETTE.length];
  const label = emptyLabel ?? initials(name);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
        background: colors.bg,
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} fill style={{ objectFit: "cover" }} sizes={`${size}px`} />
      ) : (
        <span
          style={{
            fontSize: size <= 38 ? "0.75rem" : "0.9rem",
            fontWeight: 700,
            fontFamily: "var(--font-dm-sans)",
            color: colors.color,
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
