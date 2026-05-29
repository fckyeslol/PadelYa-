/** Canchas físicas por sede (slug = venue id en config/venues.ts). */

export type VenueCourtConfig = {
  courts: number;
  labels?: string[];
};

export const VENUE_COURT_COUNTS: Record<string, VenueCourtConfig> = {
  "padel-zenter-del-rio": { courts: 2 },
  "casa-padel": { courts: 2 },
  "padel-zenter-la-arenosa": { courts: 2 },
  "la-jaula": { courts: 3 },
  "padel-park": { courts: 2 },
  "ace-padel-club": { courts: 2 },
  "x3-padel-club": { courts: 2 },
};

export function courtLabelsForVenue(venueId: string): string[] {
  const cfg = VENUE_COURT_COUNTS[venueId];
  if (!cfg) return [];
  if (cfg.labels?.length) return cfg.labels;
  return Array.from({ length: cfg.courts }, (_, i) => `Cancha ${i + 1}`);
}

export const ALL_VENUE_PORTAL_IDS = Object.keys(VENUE_COURT_COUNTS);
