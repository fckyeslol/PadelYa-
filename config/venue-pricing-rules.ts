export const RULE_BASED_VENUE_IDS = ["ace-padel-club", "x3-padel-club", "la-jaula"] as const;
export type RuleBasedVenueId = (typeof RULE_BASED_VENUE_IDS)[number];

/**
 * Recargo fijo de plataforma por jugador, añadido sobre (precio cancha / 4).
 * Se aplica en los dos puntos donde se calcula la tarifa por jugador:
 * `getPlayerFeeFromRules` (Ace/X3/La Jaula) y `getPlayerFeeCop` (Casa Padel + EasyCancha),
 * de modo que TODOS los partidos suben este monto por persona.
 */
export const PLAYER_FEE_SURCHARGE_COP = 0;

type TimeRange = { from: string; to: string; courtCop: number };
type DayType = "weekday" | "friday" | "saturday" | "sunday";

const RULES: Record<string, Partial<Record<DayType, Partial<Record<60 | 90, TimeRange[]>>>>> = {
  // courtCop = cancha + $22,500 comisión para todas las canchas.
  // Player = courtCop / 4.
  "ace-padel-club": {
    weekday: {
      60: [
        { from: "05:00", to: "15:00", courtCop: 72_500 },    // cancha $50k
        { from: "15:00", to: "16:00", courtCop: 106_500 },   // cancha $84k
        { from: "16:00", to: "17:00", courtCop: 119_500 },   // cancha $97k
        { from: "17:00", to: "21:30", courtCop: 132_500 },   // cancha $110k
        { from: "21:30", to: "24:00", courtCop: 102_500 },   // cancha $80k
      ],
      90: [
        { from: "05:00", to: "06:30", courtCop: 72_500 },    // cancha $50k
        { from: "06:30", to: "12:00", courtCop: 97_500 },    // cancha $75k
        { from: "12:00", to: "15:00", courtCop: 72_500 },    // cancha $50k
        { from: "15:00", to: "16:00", courtCop: 97_500 },    // cancha $75k
        { from: "16:00", to: "17:00", courtCop: 147_500 },   // cancha $125k
        { from: "17:00", to: "21:30", courtCop: 187_500 },   // cancha $165k
        { from: "21:30", to: "24:00", courtCop: 142_500 },   // cancha $120k
      ],
    },
    saturday: {
      60: [
        { from: "05:00", to: "06:00", courtCop: 72_500 },    // cancha $50k
        { from: "06:00", to: "07:00", courtCop: 92_500 },    // cancha $70k
        { from: "07:00", to: "17:00", courtCop: 82_500 },    // cancha $60k
        { from: "17:00", to: "24:00", courtCop: 102_500 },   // cancha $80k
      ],
      90: [
        { from: "05:00", to: "07:00", courtCop: 72_500 },    // cancha $50k
        { from: "07:00", to: "17:00", courtCop: 97_500 },    // cancha $75k
        { from: "17:00", to: "24:00", courtCop: 142_500 },   // cancha $120k
      ],
    },
    sunday: {
      60: [
        { from: "07:00", to: "17:00", courtCop: 82_500 },    // cancha $60k
        { from: "17:00", to: "24:00", courtCop: 102_500 },   // cancha $80k
      ],
      90: [
        { from: "07:00", to: "17:00", courtCop: 102_500 },   // cancha $80k
        { from: "17:00", to: "24:00", courtCop: 142_500 },   // cancha $120k
      ],
    },
  },
  "x3-padel-club": {
    weekday: {
      60: [{ from: "05:30", to: "16:00", courtCop: 68_500 }],  // cancha $46k
      90: [
        { from: "05:30", to: "16:00", courtCop: 91_500 },    // cancha $69k
        { from: "17:00", to: "21:30", courtCop: 187_500 },   // cancha $165k
        { from: "21:30", to: "24:00", courtCop: 132_500 },   // cancha $110k
      ],
    },
    saturday: {
      60: [{ from: "05:30", to: "16:00", courtCop: 82_500 }],  // cancha $60k
      90: [
        { from: "05:30", to: "16:00", courtCop: 92_500 },    // cancha $70k
        { from: "17:00", to: "24:00", courtCop: 122_500 },   // cancha $100k
      ],
    },
    sunday: {
      60: [{ from: "08:00", to: "16:00", courtCop: 82_500 }],  // cancha $60k
      90: [
        { from: "08:00", to: "16:00", courtCop: 92_500 },    // cancha $70k
        { from: "17:00", to: "18:30", courtCop: 122_500 },   // cancha $100k
      ],
    },
  },
  /**
   * La Jaula Padel Barranquilla — precios oficiales (junio 2026).
   * courtCop = cancha + $22,500 comisión. Player = courtCop / 4.
   * Ej: cancha $34k → courtCop $56,500 → $56,500/4 = $14,125/jugador.
   */
  "la-jaula": {
    weekday: {
      60: [
        { from: "05:00", to: "06:30", courtCop: 56_500 },   // cancha $34k
        { from: "06:30", to: "10:00", courtCop: 62_500 },   // cancha $40k
      ],
      90: [
        { from: "05:00", to: "06:30", courtCop: 72_500 },   // cancha $50k
        { from: "06:30", to: "10:00", courtCop: 82_500 },   // cancha $60k
        { from: "15:00", to: "19:00", courtCop: 73_500 },   // cancha $51k
        { from: "19:00", to: "22:00", courtCop: 147_500 },  // cancha $125k
        { from: "22:00", to: "24:00", courtCop: 110_500 },  // cancha $88k
      ],
    },
    friday: {
      60: [
        { from: "05:00", to: "06:30", courtCop: 56_500 },
        { from: "06:30", to: "10:00", courtCop: 62_500 },
      ],
      90: [
        { from: "05:00", to: "06:30", courtCop: 72_500 },
        { from: "06:30", to: "10:00", courtCop: 82_500 },
        { from: "15:00", to: "19:00", courtCop: 73_500 },
        { from: "19:00", to: "20:30", courtCop: 147_500 },  // cancha $125k
        { from: "20:30", to: "22:00", courtCop: 132_500 },  // cancha $110k
        { from: "22:00", to: "24:00", courtCop: 110_500 },  // cancha $88k
      ],
    },
    saturday: {
      60: [
        { from: "05:00", to: "08:00", courtCop: 56_500 },   // cancha $34k
      ],
      90: [
        { from: "05:00", to: "08:00", courtCop: 72_500 },   // cancha $50k
        { from: "08:00", to: "24:00", courtCop: 103_500 },  // cancha $81k
      ],
    },
    sunday: {
      60: [
        { from: "05:00", to: "08:00", courtCop: 56_500 },
      ],
      90: [
        { from: "05:00", to: "08:00", courtCop: 72_500 },
        { from: "08:00", to: "24:00", courtCop: 103_500 },
      ],
    },
  },
};

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function dayType(dateStr: string): DayType {
  const dow = new Date(`${dateStr}T12:00:00`).getDay();
  if (dow === 0) return "sunday";
  if (dow === 6) return "saturday";
  if (dow === 5) return "friday";
  return "weekday";
}

export function getCourtCopFromRules(
  venueId: string,
  date: string,
  time: string,
  durationMinutes: 60 | 90,
): number | null {
  const dt = dayType(date);
  // Fallback: if venue has no "friday" rules, use "weekday"
  const ranges = RULES[venueId]?.[dt]?.[durationMinutes]
    ?? (dt === "friday" ? RULES[venueId]?.["weekday"]?.[durationMinutes] : undefined);
  if (!ranges) return null;
  const t = toMinutes(time);
  for (const r of ranges) {
    if (t >= toMinutes(r.from) && t < toMinutes(r.to)) return r.courtCop;
  }
  return null;
}

export function getPlayerFeeFromRules(
  venueId: string,
  date: string,
  time: string,
  durationMinutes: 60 | 90,
): number | null {
  const court = getCourtCopFromRules(venueId, date, time, durationMinutes);
  return court === null ? null : Math.round(court / 4) + PLAYER_FEE_SURCHARGE_COP;
}
