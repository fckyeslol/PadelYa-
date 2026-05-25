export const RULE_BASED_VENUE_IDS = ["ace-padel-club", "x3-padel-club"] as const;
export type RuleBasedVenueId = (typeof RULE_BASED_VENUE_IDS)[number];

type TimeRange = { from: string; to: string; courtCop: number };
type DayType = "weekday" | "saturday" | "sunday";

const RULES: Record<string, Record<DayType, Partial<Record<60 | 90, TimeRange[]>>>> = {
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
};

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function dayType(dateStr: string): DayType {
  const dow = new Date(`${dateStr}T12:00:00`).getDay();
  if (dow === 0) return "sunday";
  if (dow === 6) return "saturday";
  return "weekday";
}

export function getCourtCopFromRules(
  venueId: string,
  date: string,
  time: string,
  durationMinutes: 60 | 90,
): number | null {
  const ranges = RULES[venueId]?.[dayType(date)]?.[durationMinutes];
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
  return court === null ? null : Math.round(court / 4);
}
