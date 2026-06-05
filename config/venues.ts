/** Canchas de Barranquilla con foto y nombre canónico */

export type VenueInfo = {
  id: string;
  name: string;
  /** Foto en la sección de clubes (landing arriba) */
  clubImage: string;
  /** Foto en tarjetas de partidos (landing abajo y listados) */
  matchCardImage: string;
  /** Ajuste de imagen para mantener composición elegante por sede. */
  imageFit?: "cover" | "contain";
  /** Posición de recorte para la imagen del club (ej: "center 40%"). */
  clubImagePosition?: string;
  /** Posición móvil para la imagen del club. */
  clubImagePositionMobile?: string;
  /** Posición de recorte para banner de partido (ej: "center 35%"). */
  matchImagePosition?: string;
  /** Posición móvil para banner de partido. */
  matchImagePositionMobile?: string;
  bookingHint?: string;
  /** Número de canchas disponibles en la sede. */
  courts?: number;
};

export const BARRANQUILLA_VENUES: VenueInfo[] = [
  {
    id: "padel-zenter-del-rio",
    name: "Padel Zenter del Rio",
    clubImage: "/venues/padel-zenter-del-rio.jpg",
    matchCardImage: "/venues/padel-zenter-del-rio.jpg",
    clubImagePosition: "center 48%",
    clubImagePositionMobile: "center 52%",
    matchImagePosition: "center 46%",
    matchImagePositionMobile: "center 50%",
    bookingHint: "EasyCancha",
  },
  {
    id: "casa-padel",
    name: "Casa Padel",
    clubImage: "/venues/casa-padel.png",
    matchCardImage: "/venues/casa-padel.png",
    clubImagePosition: "center 62%",
    clubImagePositionMobile: "center 68%",
    matchImagePosition: "center 60%",
    matchImagePositionMobile: "center 66%",
    bookingHint: "ReservaDeportes",
    courts: 3,
  },
  {
    id: "padel-zenter-la-arenosa",
    name: "Padel Zenter La Arenosa",
    clubImage: "/venues/padel-zenter-la-arenosa.png",
    matchCardImage: "/venues/padel-zenter-la-arenosa.png",
    clubImagePosition: "center 45%",
    clubImagePositionMobile: "center 50%",
    matchImagePosition: "center 44%",
    matchImagePositionMobile: "center 48%",
    bookingHint: "EasyCancha",
  },
  {
    id: "la-jaula",
    name: "La Jaula",
    clubImage: "/venues/la-jaula.png",
    matchCardImage: "/venues/la-jaula.png",
    clubImagePosition: "center 34%",
    clubImagePositionMobile: "center 40%",
    matchImagePosition: "center 30%",
    matchImagePositionMobile: "center 36%",
    courts: 4,
  },
  {
    id: "padel-park",
    name: "Pádel Park",
    clubImage: "/venues/padel-park.png",
    matchCardImage: "/venues/padel-park.png",
    imageFit: "contain",
    clubImagePosition: "center",
    clubImagePositionMobile: "center",
    matchImagePosition: "center",
    matchImagePositionMobile: "center",
  },
  {
    id: "ace-padel-club",
    name: "Ace Padel Club",
    clubImage: "/venues/ace-padel-club.png",
    matchCardImage: "/venues/ace-padel-club.png",
    imageFit: "contain",
    clubImagePosition: "center",
    clubImagePositionMobile: "center",
    matchImagePosition: "center",
    matchImagePositionMobile: "center",
  },
  {
    id: "x3-padel-club",
    name: "X3 Pádel Club",
    clubImage: "/venues/x3-padel-club.png",
    matchCardImage: "/venues/x3-padel-club.png",
    imageFit: "contain",
    clubImagePosition: "center",
    clubImagePositionMobile: "center",
    matchImagePosition: "center",
    matchImagePositionMobile: "center",
  },
];

/** Nombres para el formulario de crear partido (incluye otras canchas sin foto propia) */
export const ALL_VENUE_NAMES = [...BARRANQUILLA_VENUES.map((v) => v.name)];

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
    keys: [
      "del rio",
      "padel del rio",
      "padel zenter del rio",
      "padel zenter del rio barranquilla",
    ],
    venue: BARRANQUILLA_VENUES[0],
  },
  {
    keys: ["casa padel", "casapadel"],
    venue: BARRANQUILLA_VENUES[1],
  },
  {
    keys: [
      "la arenosa",
      "padel la arenosa",
      "padel zenter la arenosa",
      "padel zenter arenosa",
      "padel zenter la arenoza",
      "padel center la arenosa",
    ],
    venue: BARRANQUILLA_VENUES[2],
  },
  {
    keys: ["la jaula"],
    venue: BARRANQUILLA_VENUES[3],
  },
  {
    keys: ["padel park", "padelpark", "padel park barranquilla", "padel park baq"],
    venue: BARRANQUILLA_VENUES[4],
  },
  {
    keys: ["ace padel club", "ace padel", "aceclub"],
    venue: BARRANQUILLA_VENUES[5],
  },
  {
    keys: ["x3 padel club", "x3 padel", "x3"],
    venue: BARRANQUILLA_VENUES[6],
  },
];

export function getVenueInfo(venueName: string): VenueInfo | null {
  const normalized = normalizeVenueKey(venueName);

  for (const entry of VENUE_LOOKUP) {
    if (entry.keys.some((k) => normalized === k)) {
      return entry.venue;
    }
  }

  if (normalized === "padel zenter" || normalized === "padel zenter barranquilla") {
    return null;
  }
  if (normalized.includes("del rio")) {
    return BARRANQUILLA_VENUES[0];
  }
  if (normalized.includes("casa") && normalized.includes("padel")) {
    return BARRANQUILLA_VENUES[1];
  }
  if (normalized.includes("arenosa")) {
    return BARRANQUILLA_VENUES[2];
  }
  if (normalized.includes("zenter") && !normalized.includes("del rio") && !normalized.includes("arenosa")) {
    return null;
  }
  if (normalized.includes("la jaula")) {
    return BARRANQUILLA_VENUES[3];
  }
  if (normalized.includes("park")) {
    return BARRANQUILLA_VENUES[4];
  }
  if (normalized.includes("ace")) {
    return BARRANQUILLA_VENUES[5];
  }
  if (normalized.includes("x3")) {
    return BARRANQUILLA_VENUES[6];
  }

  return null;
}

export function getVenueById(venueId: string): VenueInfo | null {
  return BARRANQUILLA_VENUES.find((v) => v.id === venueId) ?? null;
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
