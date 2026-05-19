import Image from "next/image";
import {
  getVenueImage,
  getVenueInfo,
  type VenueImageVariant,
} from "@/config/venues";

type Props = {
  venueName: string;
  height?: number;
  className?: string;
  rounded?: string;
  showLabel?: boolean;
  imageVariant?: VenueImageVariant;
};

export function VenuePhoto({
  venueName,
  height = 120,
  className = "",
  rounded = "12px",
  showLabel = false,
  imageVariant = "match",
}: Props) {
  const image = getVenueImage(venueName, imageVariant);
  const info = getVenueInfo(venueName);
  const objectFit = info?.imageFit ?? "cover";
  const objectPositionDesktop =
    imageVariant === "club"
      ? (info?.clubImagePosition ?? "center")
      : (info?.matchImagePosition ?? "center");
  const objectPositionMobile =
    imageVariant === "club"
      ? (info?.clubImagePositionMobile ?? objectPositionDesktop)
      : (info?.matchImagePositionMobile ?? objectPositionDesktop);

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
        ["--venue-object-position-desktop" as string]: objectPositionDesktop,
        ["--venue-object-position-mobile" as string]: objectPositionMobile,
      }}
    >
      <Image
        className="venue-photo-image"
        src={image}
        alt={venueName}
        fill
        sizes="(max-width: 768px) 100vw, 400px"
        style={{
          objectFit,
          background: objectFit === "contain" ? "#0F1629" : undefined,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(15,22,41,0.82) 0%, rgba(15,22,41,0.25) 55%, transparent 100%)",
        }}
      />
      {showLabel ? (
        <span className="venue-photo-overlay-title">
          {info?.name ?? venueName}
        </span>
      ) : null}
    </div>
  );
}
