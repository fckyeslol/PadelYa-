export const RULE_BASED_VENUE_IDS = ["ace-padel-club", "x3-padel-club", "la-jaula"] as const;
export type RuleBasedVenueId = (typeof RULE_BASED_VENUE_IDS)[number];

/**
 * Recargo fijo de plataforma por jugador, añadido sobre (precio cancha / 4).
 * Se aplica en los dos puntos donde se calcula la tarifa por jugador:
 * `getPlayerFeeFromRules` (Ace/X3/La Jaula) y `getPlayerFeeCop` (Casa Padel + EasyCancha),
 * de modo que TODOS los partidos suben este monto por persona.
 */
export const PLAYER_FEE_SURCHARGE_COP = 1500;

type TimeRange = { from: string; to: string; courtCop: number };
type DayType = "weekday" | "friday" | "saturday" | "sunday";

const RULES: Record<string, Partial<Record<DayType, Partial<Record<60 | 90, TimeRange[]>>>>> = {
  "ace-padel-club": {
    weekday: {
      60: [
        { from: "05:00", to: "15:00", courtCop: 50_000 },
        { from: "15:00", to: "16:00", courtCop: 84_000 },
        { from: "16:00", to: "17:00", courtCop: 97_000 },
        { from: "17:00", to: "21:30", courtCop: 110_000 },
        { from: "21:30", to: "24:00", courtCop: 80_000 },
      ],
      90: [
        { from: "05:00", to: "06:30", courtCop: 50_000 },
        { from: "06:30", to: "12:00", courtCop: 75_000 },
        { from: "12:00", to: "15:00", courtCop: 50_000 },
        { from: "15:00", to: "16:00", courtCop: 75_000 },
        { from: "16:00", to: "17:00", courtCop: 125_000 },
        { from: "17:00", to: "21:30", courtCop: 165_000 },
        { from: "21:30", to: "24:00", courtCop: 120_000 },
      ],
    },
    saturday: {
      60: [
        { from: "05:00", to: "06:00", courtCop: 50_000 },
        { from: "06:00", to: "07:00", courtCop: 70_000 },
        { from: "07:00", to: "17:00", courtCop: 60_000 },
        { from: "17:00", to: "24:00", courtCop: 80_000 },
      ],
      90: [
        { from: "05:00", to: "07:00", courtCop: 50_000 },
        { from: "07:00", to: "17:00", courtCop: 75_000 },
        { from: "17:00", to: "24:00", courtCop: 120_000 },
      ],
    },
    sunday: {
      60: [
        { from: "07:00", to: "17:00", courtCop: 60_000 },
        { from: "17:00", to: "24:00", courtCop: 80_000 },
      ],
      90: [
        { from: "07:00", to: "17:00", courtCop: 80_000 },
        { from: "17:00", to: "24:00", courtCop: 120_000 },
      ],
    },
  },
  "x3-padel-club": {
    weekday: {
      60: [{ from: "05:30", to: "16:00", courtCop: 46_000 }],
      90: [
        { from: "05:30", to: "16:00", courtCop: 69_000 },
        { from: "17:00", to: "21:30", courtCop: 165_000 },
        { from: "21:30", to: "24:00", courtCop: 110_000 },
      ],
    },
    saturday: {
      60: [{ from: "05:30", to: "16:00", courtCop: 60_000 }],
      90: [
        { from: "05:30", to: "16:00", courtCop: 70_000 },
        { from: "17:00", to: "24:00", courtCop: 100_000 },
      ],
    },
    sunday: {
      60: [{ from: "08:00", to: "16:00", courtCop: 60_000 }],
      90: [
        { from: "08:00", to: "16:00", courtCop: 70_000 },
        { from: "17:00", to: "18:30", courtCop: 100_000 },
      ],
    },
  },
  /**
   * La Jaula Padel Barranquilla — precios oficiales de la cancha (junio 2026).
   * courtCop = precio real de cancha + $20k markup (igual que CSV venues),
   * para que getPlayerFeeFromRules (courtCop/4 + $1,500) dé la comisión de $6,500/jugador.
   * Ejemplo: cancha $81k → courtCop $101k → $101k/4 + $1,500 = $26,750/jugador.
   */
  "la-jaula": {
    weekday: {
      60: [
        { from: "05:00", to: "06:30", courtCop: 54_000 },   // cancha $34k + $20k
        { from: "06:30", to: "10:00", courtCop: 60_000 },   // cancha $40k + $20k
      ],
      90: [
        { from: "05:00", to: "06:30", courtCop: 70_000 },   // cancha $50k + $20k
        { from: "06:30", to: "10:00", courtCop: 80_000 },   // cancha $60k + $20k
        { from: "15:00", to: "19:00", courtCop: 71_000 },   // cancha $51k + $20k
        { from: "19:00", to: "22:00", courtCop: 145_000 },  // cancha $125k + $20k
        { from: "22:00", to: "24:00", courtCop: 108_000 },  // cancha $88k + $20k
      ],
    },
    friday: {
      60: [
        { from: "05:00", to: "06:30", courtCop: 54_000 },
        { from: "06:30", to: "10:00", courtCop: 60_000 },
      ],
      90: [
        { from: "05:00", to: "06:30", courtCop: 70_000 },
        { from: "06:30", to: "10:00", courtCop: 80_000 },
        { from: "15:00", to: "19:00", courtCop: 71_000 },
        { from: "19:00", to: "20:30", courtCop: 145_000 },  // cancha $125k + $20k
        { from: "20:30", to: "22:00", courtCop: 130_000 },  // cancha $110k + $20k
        { from: "22:00", to: "24:00", courtCop: 108_000 },
      ],
    },
    saturday: {
      60: [
        { from: "05:00", to: "08:00", courtCop: 54_000 },
      ],
      90: [
        { from: "05:00", to: "08:00", courtCop: 70_000 },
        { from: "08:00", to: "24:00", courtCop: 101_000 },  // cancha $81k + $20k
      ],
    },
    sunday: {
      60: [
        { from: "05:00", to: "08:00", courtCop: 54_000 },
      ],
      90: [
        { from: "05:00", to: "08:00", courtCop: 70_000 },
        { from: "08:00", to: "24:00", courtCop: 101_000 },
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
