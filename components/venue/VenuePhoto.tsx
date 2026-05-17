import Image from "next/image";
import { getVenueImage, getVenueInfo } from "@/config/venues";

type Props = {
  venueName: string;
  height?: number;
  className?: string;
  rounded?: string;
  showLabel?: boolean;
};

export function VenuePhoto({
  venueName,
  height = 120,
  className = "",
  rounded = "12px",
  showLabel = false,
}: Props) {
  const image = getVenueImage(venueName);
  const info = getVenueInfo(venueName);

  if (!image) {
    return (
      <div
        className={className}
        style={{
          height,
          borderRadius: rounded,
          background: "linear-gradient(135deg, #0d3a9e 0%, #2563eb 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <span
          style={{
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "0.9rem",
            textAlign: "center",
            fontFamily: "var(--font-syne)",
          }}
        >
          {venueName}
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        height,
        borderRadius: rounded,
        position: "relative",
        overflow: "hidden",
        background: "#0d3a9e",
      }}
    >
      <Image
        src={image}
        alt={venueName}
        fill
        sizes="(max-width: 768px) 100vw, 400px"
        style={{ objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(15,22,41,0.55) 0%, transparent 45%)",
        }}
      />
      {showLabel ? (
        <span
          style={{
            position: "absolute",
            bottom: "0.65rem",
            left: "0.75rem",
            right: "0.75rem",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "0.85rem",
            fontFamily: "var(--font-syne)",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          {info?.name ?? venueName}
        </span>
      ) : null}
    </div>
  );
}
