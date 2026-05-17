/** Canchas de Barranquilla con foto y nombre canónico */

export type VenueInfo = {
  id: string;
  name: string;
  /** Foto en la sección de clubes (landing arriba) */
  clubImage: string;
  /** Foto en tarjetas de partidos (landing abajo y listados) */
  matchCardImage: string;
  bookingHint?: string;
};

export const BARRANQUILLA_VENUES: VenueInfo[] = [
  {
    id: "padel-zenter-del-rio",
    name: "Padel Zenter del Rio",
    clubImage: "/venues/club-padel-zenter-del-rio.jpg",
    matchCardImage: "/venues/padel-zenter-del-rio.jpg",
    bookingHint: "EasyCancha",
  },
  {
    id: "casa-padel",
    name: "Casa Padel",
    clubImage: "/venues/club-casa-padel.jpg",
    matchCardImage: "/venues/casa-padel.jpg",
    bookingHint: "ReservaDeportes",
  },
  {
    id: "padel-zenter",
    name: "Padel Zenter",
    clubImage: "/venues/club-padel-zenter.jpg",
    matchCardImage: "/venues/padel-zenter.jpg",
    bookingHint: "EasyCancha",
  },
];

/** Nombres para el formulario de crear partido (incluye otras canchas sin foto propia) */
export const ALL_VENUE_NAMES = [
  ...BARRANQUILLA_VENUES.map((v) => v.name),
  "Padel Zenter La Arenosa",
  "La Jaula",
  "Pádel Park",
  "Ace Padel Club",
  "X3 Pádel Club",
];

function normalizeVenueKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const VENUE_LOOKUP: { keys: string[]; venue: VenueInfo }[] = [
  {
    keys: ["padel zenter del rio", "padel zenter del rio barranquilla"],
    venue: BARRANQUILLA_VENUES[0],
  },
  {
    keys: ["casa padel", "casapadel"],
    venue: BARRANQUILLA_VENUES[1],
  },
  {
    keys: [
      "padel zenter",
      "padel zenter la arenosa",
      "padel center",
      "padel zenter arenosa",
    ],
    venue: BARRANQUILLA_VENUES[2],
  },
];

export function getVenueInfo(venueName: string): VenueInfo | null {
  const normalized = normalizeVenueKey(venueName);

  for (const entry of VENUE_LOOKUP) {
    if (entry.keys.some((k) => normalized === k)) {
      return entry.venue;
    }
  }

  // Del Rio antes que "zenter" genérico
  if (normalized.includes("del rio")) {
    return BARRANQUILLA_VENUES[0];
  }
  if (normalized.includes("casa") && normalized.includes("padel")) {
    return BARRANQUILLA_VENUES[1];
  }
  if (normalized.includes("zenter") || normalized.includes("center")) {
    return BARRANQUILLA_VENUES[2];
  }

  return null;
}

export type VenueImageVariant = "club" | "match";

export function getVenueImage(
  venueName: string,
  variant: VenueImageVariant = "match",
): string | null {
  const info = getVenueInfo(venueName);
  if (!info) return null;
  return variant === "club" ? info.clubImage : info.matchCardImage;
}
