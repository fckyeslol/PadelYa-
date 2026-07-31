export const RULE_BASED_VENUE_IDS = ["ace-padel-club", "x3-padel-club", "la-jaula", "padel-zenter-del-rio", "padel-zenter-la-arenosa", "padel-park"] as const;
export type RuleBasedVenueId = (typeof RULE_BASED_VENUE_IDS)[number];

/**
 * Recargo fijo de plataforma por jugador, añadido sobre (precio cancha / 4).
 * Se aplica en los dos puntos donde se calcula la tarifa por jugador:
 * `getPlayerFeeFromRules` (Ace/X3/La Jaula) y `getPlayerFeeCop` (Casa Padel + EasyCancha),
 * de modo que TODOS los partidos suben este monto por persona.
 */
export const PLAYER_FEE_SURCHARGE_COP = 0;

/**
 * Comisión fija de plataforma sumada al precio de cancha crudo de EasyCancha.
 * El precio scrapeado en `easycancha_slots.price_cop` es la cancha SIN comisión;
 * `price_cop + COURT_MARKUP_COP` = courtCop (igual que los `courtCop` de las reglas,
 * que ya la traen incluida). Player = courtCop / 4.
 */
export const COURT_MARKUP_COP = 22_500;

type TimeRange = { from: string; to: string; courtCop: number };
type DayType = "weekday" | "friday" | "saturday" | "sunday";

const RULES: Record<string, Partial<Record<DayType, Partial<Record<60 | 90 | 120, TimeRange[]>>>>> = {
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
      120: [
        { from: "05:00", to: "14:00", courtCop: 122_500 },   // cancha $100k
        { from: "14:30", to: "15:00", courtCop: 146_000 },   // cancha $123.5k
        { from: "15:00", to: "15:30", courtCop: 169_500 },   // cancha $147k
        { from: "15:30", to: "16:00", courtCop: 199_500 },   // cancha $177k
        { from: "16:00", to: "16:30", courtCop: 229_500 },   // cancha $207k
        { from: "16:30", to: "17:00", courtCop: 236_000 },   // cancha $213.5k
        { from: "17:00", to: "19:30", courtCop: 242_500 },   // cancha $220k
        { from: "20:00", to: "20:30", courtCop: 227_500 },   // cancha $205k
        { from: "20:30", to: "21:00", courtCop: 212_500 },   // cancha $190k
        { from: "21:00", to: "22:00", courtCop: 197_500 },   // cancha $175k
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
      120: [
        { from: "05:00", to: "05:30", courtCop: 142_500 },   // cancha $120k
        { from: "05:30", to: "06:00", courtCop: 147_500 },   // cancha $125k
        { from: "06:00", to: "06:30", courtCop: 152_500 },   // cancha $130k
        { from: "06:30", to: "08:00", courtCop: 142_500 },   // cancha $120k
        { from: "18:30", to: "21:00", courtCop: 182_500 },   // cancha $160k
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
      120: [
        { from: "07:00", to: "15:00", courtCop: 142_500 },   // cancha $120k
        { from: "15:30", to: "16:00", courtCop: 152_500 },   // cancha $130k
        { from: "16:00", to: "16:30", courtCop: 162_500 },   // cancha $140k
        { from: "16:30", to: "17:00", courtCop: 172_500 },   // cancha $150k
        { from: "17:00", to: "20:00", courtCop: 182_500 },   // cancha $160k
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
        { from: "05:00", to: "05:30", courtCop: 72_500 },   // cancha $50k
        { from: "05:30", to: "06:00", courtCop: 82_500 },   // cancha $60k
        { from: "06:00", to: "06:30", courtCop: 92_500 },   // cancha $70k
        { from: "06:30", to: "11:00", courtCop: 103_500 },  // cancha $81k
        { from: "11:00", to: "14:00", courtCop: 72_500 },   // cancha $50k
        { from: "14:00", to: "14:30", courtCop: 72_500 },   // cancha $50k
        { from: "14:30", to: "15:00", courtCop: 82_500 },   // cancha $60k
        { from: "15:00", to: "15:30", courtCop: 92_500 },   // cancha $70k
        { from: "15:30", to: "19:00", courtCop: 103_500 },  // cancha $81k
        { from: "19:00", to: "22:00", courtCop: 176_500 },  // cancha $154k
        { from: "22:00", to: "24:00", courtCop: 110_500 },  // cancha $88k
      ],
    },
    sunday: {
      60: [
        { from: "05:00", to: "08:00", courtCop: 56_500 },
      ],
      90: [
        { from: "05:00", to: "05:30", courtCop: 72_500 },   // cancha $50k
        { from: "05:30", to: "06:00", courtCop: 82_500 },   // cancha $60k
        { from: "06:00", to: "06:30", courtCop: 92_500 },   // cancha $70k
        { from: "06:30", to: "11:00", courtCop: 103_500 },  // cancha $81k
        { from: "11:00", to: "14:00", courtCop: 72_500 },   // cancha $50k
        { from: "14:00", to: "14:30", courtCop: 72_500 },   // cancha $50k
        { from: "14:30", to: "15:00", courtCop: 82_500 },   // cancha $60k
        { from: "15:00", to: "15:30", courtCop: 92_500 },   // cancha $70k
        { from: "15:30", to: "19:00", courtCop: 103_500 },  // cancha $81k
        { from: "19:00", to: "22:00", courtCop: 176_500 },  // cancha $154k
        { from: "22:00", to: "24:00", courtCop: 110_500 },  // cancha $88k
      ],
    },
  },
  /**
   * Padel Zenter del Río — precios EasyCancha (junio 2026).
   * Solo 90 min (no ofrecen 60 min). courtCop = cancha + $22,500.
   */
  "padel-zenter-del-rio": {
    weekday: {
      90: [
        { from: "06:00", to: "12:00", courtCop: 82_500 },    // cancha $60k
        { from: "12:00", to: "12:30", courtCop: 75_000 },    // cancha $52.5k
        { from: "12:30", to: "13:00", courtCop: 67_500 },    // cancha $45k
        { from: "13:00", to: "17:00", courtCop: 60_000 },    // cancha $37.5k
        { from: "17:00", to: "18:30", courtCop: 112_500 },   // cancha $90k
        { from: "18:30", to: "21:30", courtCop: 162_500 },   // cancha $140k
        { from: "21:30", to: "23:00", courtCop: 122_500 },   // cancha $100k
      ],
      120: [
        { from: "06:00", to: "11:00", courtCop: 102_500 },   // cancha $80k
        { from: "11:30", to: "12:00", courtCop: 95_000 },    // cancha $72.5k
        { from: "12:00", to: "12:30", courtCop: 87_500 },    // cancha $65k
        { from: "12:30", to: "13:00", courtCop: 80_000 },    // cancha $57.5k
        { from: "13:00", to: "15:00", courtCop: 72_500 },    // cancha $50k
        { from: "16:30", to: "17:00", courtCop: 125_000 },   // cancha $102.5k
      ],
    },
    saturday: {
      90: [
        { from: "06:00", to: "08:00", courtCop: 103_500 },   // cancha $81k
        { from: "11:00", to: "11:30", courtCop: 89_000 },    // cancha $66.5k
        { from: "11:30", to: "12:00", courtCop: 74_500 },    // cancha $52k
        { from: "12:00", to: "16:00", courtCop: 60_000 },    // cancha $37.5k
        { from: "18:00", to: "19:00", courtCop: 97_500 },    // cancha $75k
        { from: "19:00", to: "19:30", courtCop: 92_500 },    // cancha $70k
        { from: "19:30", to: "20:00", courtCop: 87_500 },    // cancha $65k
        { from: "20:00", to: "21:30", courtCop: 82_500 },    // cancha $60k
      ],
      120: [
        { from: "06:00", to: "07:00", courtCop: 130_500 },   // cancha $108k
        { from: "11:00", to: "11:30", courtCop: 101_500 },   // cancha $79k
        { from: "11:30", to: "12:00", courtCop: 87_000 },    // cancha $64.5k
        { from: "12:00", to: "14:00", courtCop: 72_500 },    // cancha $50k
        { from: "18:00", to: "18:30", courtCop: 122_500 },   // cancha $100k
        { from: "18:30", to: "19:00", courtCop: 117_500 },   // cancha $95k
        { from: "19:00", to: "19:30", courtCop: 112_500 },   // cancha $90k
        { from: "19:30", to: "20:00", courtCop: 107_500 },   // cancha $85k
      ],
    },
    sunday: {
      90: [
        { from: "08:00", to: "11:00", courtCop: 97_500 },    // cancha $75k
        { from: "11:00", to: "11:30", courtCop: 92_500 },    // cancha $70k
        { from: "11:30", to: "12:00", courtCop: 87_500 },    // cancha $65k
        { from: "12:00", to: "16:00", courtCop: 82_500 },    // cancha $60k
        { from: "16:00", to: "16:30", courtCop: 87_500 },    // cancha $65k
        { from: "16:30", to: "17:00", courtCop: 92_500 },    // cancha $70k
        { from: "17:00", to: "19:00", courtCop: 97_500 },    // cancha $75k
        { from: "19:00", to: "19:30", courtCop: 92_500 },    // cancha $70k
        { from: "19:30", to: "20:00", courtCop: 87_500 },    // cancha $65k
        { from: "20:00", to: "21:30", courtCop: 82_500 },    // cancha $60k
      ],
      120: [
        { from: "08:00", to: "10:00", courtCop: 122_500 },   // cancha $100k
        { from: "10:30", to: "11:00", courtCop: 117_500 },   // cancha $95k
        { from: "11:00", to: "11:30", courtCop: 112_500 },   // cancha $90k
        { from: "11:30", to: "12:00", courtCop: 107_500 },   // cancha $85k
        { from: "12:00", to: "15:00", courtCop: 102_500 },   // cancha $80k
        { from: "15:30", to: "16:00", courtCop: 107_500 },   // cancha $85k
        { from: "16:00", to: "16:30", courtCop: 112_500 },   // cancha $90k
        { from: "16:30", to: "17:00", courtCop: 117_500 },   // cancha $95k
        { from: "17:00", to: "18:00", courtCop: 122_500 },   // cancha $100k
        { from: "18:30", to: "19:00", courtCop: 117_500 },   // cancha $95k
        { from: "19:00", to: "19:30", courtCop: 112_500 },   // cancha $90k
        { from: "19:30", to: "20:00", courtCop: 107_500 },   // cancha $85k
      ],
    },
  },
  /**
   * Padel Zenter La Arenosa — precios EasyCancha (junio 2026).
   * Solo 90 min. courtCop = cancha + $22,500.
   */
  "padel-zenter-la-arenosa": {
    weekday: {
      90: [
        { from: "06:00", to: "08:00", courtCop: 94_500 },    // cancha $72k
        { from: "08:00", to: "08:30", courtCop: 92_500 },    // cancha $70k
        { from: "08:30", to: "09:00", courtCop: 90_500 },    // cancha $68k
        { from: "09:00", to: "12:00", courtCop: 88_500 },    // cancha $66k
        { from: "12:00", to: "12:30", courtCop: 79_000 },    // cancha $56.5k
        { from: "12:30", to: "13:00", courtCop: 69_500 },    // cancha $47k
        { from: "13:00", to: "17:00", courtCop: 60_000 },    // cancha $37.5k
        { from: "17:00", to: "18:30", courtCop: 122_500 },   // cancha $100k
        { from: "18:30", to: "21:30", courtCop: 162_500 },   // cancha $140k
        { from: "21:30", to: "23:00", courtCop: 122_500 },   // cancha $100k
      ],
      120: [
        { from: "06:00", to: "06:30", courtCop: 118_500 },   // cancha $96k
        { from: "07:30", to: "08:00", courtCop: 116_500 },   // cancha $94k
        { from: "08:00", to: "08:30", courtCop: 114_500 },   // cancha $92k
        { from: "08:30", to: "09:00", courtCop: 112_500 },   // cancha $90k
        { from: "09:00", to: "11:00", courtCop: 110_500 },   // cancha $88k
        { from: "11:30", to: "12:00", courtCop: 101_000 },   // cancha $78.5k
        { from: "12:00", to: "12:30", courtCop: 91_500 },    // cancha $69k
        { from: "12:30", to: "13:00", courtCop: 82_000 },    // cancha $59.5k
        { from: "13:00", to: "15:00", courtCop: 72_500 },    // cancha $50k
        { from: "16:30", to: "17:00", courtCop: 135_000 },   // cancha $112.5k
      ],
    },
    saturday: {
      90: [
        { from: "06:00", to: "07:00", courtCop: 103_500 },   // cancha $81k
        { from: "11:30", to: "12:00", courtCop: 74_500 },    // cancha $52k
        { from: "12:00", to: "16:00", courtCop: 60_000 },    // cancha $37.5k
        { from: "17:30", to: "19:00", courtCop: 97_500 },    // cancha $75k
        { from: "19:00", to: "19:30", courtCop: 92_500 },    // cancha $70k
        { from: "19:30", to: "20:00", courtCop: 87_500 },    // cancha $65k
        { from: "20:00", to: "21:30", courtCop: 82_500 },    // cancha $60k
      ],
      120: [
        { from: "06:00", to: "07:00", courtCop: 130_500 },   // cancha $108k
        { from: "11:30", to: "12:00", courtCop: 87_000 },    // cancha $64.5k
        { from: "12:00", to: "15:00", courtCop: 72_500 },    // cancha $50k
        { from: "17:30", to: "18:00", courtCop: 122_500 },   // cancha $100k
        { from: "18:30", to: "19:00", courtCop: 117_500 },   // cancha $95k
        { from: "19:00", to: "19:30", courtCop: 112_500 },   // cancha $90k
        { from: "19:30", to: "20:00", courtCop: 107_500 },   // cancha $85k
      ],
    },
    sunday: {
      90: [
        { from: "08:00", to: "11:00", courtCop: 103_500 },   // cancha $81k
        { from: "11:00", to: "11:30", courtCop: 96_500 },    // cancha $74k
        { from: "11:30", to: "12:00", courtCop: 89_500 },    // cancha $67k
        { from: "12:00", to: "16:00", courtCop: 82_500 },    // cancha $60k
        { from: "16:00", to: "16:30", courtCop: 89_500 },    // cancha $67k
        { from: "16:30", to: "17:00", courtCop: 96_500 },    // cancha $74k
        { from: "17:00", to: "19:00", courtCop: 103_500 },   // cancha $81k
        { from: "19:00", to: "19:30", courtCop: 96_500 },    // cancha $74k
        { from: "19:30", to: "20:00", courtCop: 89_500 },    // cancha $67k
        { from: "20:00", to: "21:30", courtCop: 82_500 },    // cancha $60k
      ],
      120: [
        { from: "08:00", to: "10:00", courtCop: 130_500 },   // cancha $108k
        { from: "10:30", to: "11:00", courtCop: 123_500 },   // cancha $101k
        { from: "11:00", to: "11:30", courtCop: 116_500 },   // cancha $94k
        { from: "11:30", to: "12:00", courtCop: 109_500 },   // cancha $87k
        { from: "12:00", to: "15:00", courtCop: 102_500 },   // cancha $80k
        { from: "15:30", to: "16:00", courtCop: 109_500 },   // cancha $87k
        { from: "16:00", to: "16:30", courtCop: 116_500 },   // cancha $94k
        { from: "16:30", to: "17:00", courtCop: 123_500 },   // cancha $101k
        { from: "17:00", to: "18:00", courtCop: 130_500 },   // cancha $108k
        { from: "18:30", to: "19:00", courtCop: 123_500 },   // cancha $101k
        { from: "19:00", to: "19:30", courtCop: 116_500 },   // cancha $94k
        { from: "19:30", to: "20:00", courtCop: 109_500 },   // cancha $87k
      ],
    },
  },
  /**
   * Padel Park Barranquilla. courtCop = cancha + $22,500.
   *
   * Los 60 min se congelaron el 2026-07-30 desde la ULTIMA captura buena del scraping
   * (easycancha_slots club 1442, fechas 10–16 jul 2026), justo antes de eliminar el
   * sistema de scraping. Hasta entonces esta duracion NO tenia reglas y dependia del
   * precio en vivo, asi que sin esto Padel Park se habria quedado solo con 120 min.
   * Fuente muerta: revisar a mano cuando el club cambie tarifas.
   */
  "padel-park": {
    weekday: {
      60: [
        { from: "05:00", to: "15:30", courtCop: 72_500 },    // cancha $50k
        { from: "15:30", to: "16:00", courtCop: 89_500 },    // cancha $67k
        { from: "16:00", to: "16:30", courtCop: 106_500 },   // cancha $84k
        { from: "16:30", to: "17:00", courtCop: 119_500 },   // cancha $97k
        { from: "17:00", to: "21:00", courtCop: 132_500 },   // cancha $110k
        { from: "21:00", to: "21:30", courtCop: 117_500 },   // cancha $95k
        { from: "21:30", to: "22:30", courtCop: 102_500 },   // cancha $80k
      ],
      120: [
        { from: "05:00", to: "14:00", courtCop: 122_500 },   // cancha $100k
        { from: "14:30", to: "15:00", courtCop: 139_500 },   // cancha $117k
        { from: "15:00", to: "15:30", courtCop: 156_500 },   // cancha $134k
        { from: "15:30", to: "16:00", courtCop: 186_500 },   // cancha $164k
        { from: "16:00", to: "16:30", courtCop: 216_500 },   // cancha $194k
        { from: "16:30", to: "17:00", courtCop: 229_500 },   // cancha $207k
        { from: "17:00", to: "19:30", courtCop: 242_500 },   // cancha $220k
        { from: "20:00", to: "20:30", courtCop: 227_500 },   // cancha $205k
        { from: "20:30", to: "21:00", courtCop: 212_500 },   // cancha $190k
        { from: "21:00", to: "22:00", courtCop: 197_500 },   // cancha $175k
      ],
    },
    friday: {
      60: [
        { from: "05:00", to: "15:30", courtCop: 72_500 },    // cancha $50k
        { from: "15:30", to: "16:00", courtCop: 96_000 },    // cancha $73.5k
        { from: "16:00", to: "17:00", courtCop: 119_500 },   // cancha $97k
        { from: "17:00", to: "21:00", courtCop: 132_500 },   // cancha $110k
        { from: "21:00", to: "21:30", courtCop: 117_500 },   // cancha $95k
        { from: "21:30", to: "22:30", courtCop: 102_500 },   // cancha $80k
      ],
      // 120 min los viernes cae a las reglas de weekday (ver getCourtCopFromRules).
    },
    saturday: {
      60: [
        { from: "05:00", to: "05:30", courtCop: 72_500 },    // cancha $50k
        { from: "05:30", to: "06:00", courtCop: 82_500 },    // cancha $60k
        { from: "06:00", to: "08:30", courtCop: 92_500 },    // cancha $70k
        { from: "08:30", to: "09:00", courtCop: 82_500 },    // cancha $60k
        { from: "09:00", to: "14:30", courtCop: 72_500 },    // cancha $50k
        { from: "14:30", to: "15:00", courtCop: 82_500 },    // cancha $60k
        { from: "15:00", to: "15:30", courtCop: 92_500 },    // cancha $70k
        { from: "15:30", to: "16:00", courtCop: 99_500 },    // cancha $77k
        { from: "16:00", to: "16:30", courtCop: 106_500 },   // cancha $84k
        { from: "16:30", to: "17:00", courtCop: 104_500 },   // cancha $82k
        { from: "17:00", to: "22:30", courtCop: 102_500 },   // cancha $80k
      ],
      120: [
        { from: "05:00", to: "05:30", courtCop: 142_500 },   // cancha $120k
        { from: "05:30", to: "06:00", courtCop: 152_500 },   // cancha $130k
        { from: "06:00", to: "07:00", courtCop: 162_500 },   // cancha $140k
        { from: "07:30", to: "08:00", courtCop: 152_500 },   // cancha $130k
        { from: "10:30", to: "13:00", courtCop: 122_500 },   // cancha $100k
        { from: "13:30", to: "14:00", courtCop: 132_500 },   // cancha $110k
        { from: "14:00", to: "14:30", courtCop: 142_500 },   // cancha $120k
        { from: "14:30", to: "15:00", courtCop: 159_500 },   // cancha $137k
        { from: "15:00", to: "15:30", courtCop: 176_500 },   // cancha $154k
        { from: "15:30", to: "16:00", courtCop: 181_500 },   // cancha $159k
        { from: "16:00", to: "16:30", courtCop: 186_500 },   // cancha $164k
        { from: "16:30", to: "17:00", courtCop: 184_500 },   // cancha $162k
        { from: "17:00", to: "21:00", courtCop: 182_500 },   // cancha $160k
      ],
    },
    sunday: {
      60: [
        { from: "07:00", to: "16:30", courtCop: 82_500 },    // cancha $60k
        { from: "16:30", to: "17:00", courtCop: 92_500 },    // cancha $70k
        { from: "17:00", to: "21:30", courtCop: 102_500 },   // cancha $80k
      ],
      120: [
        { from: "07:00", to: "15:00", courtCop: 142_500 },   // cancha $120k
        { from: "15:30", to: "16:00", courtCop: 152_500 },   // cancha $130k
        { from: "16:00", to: "16:30", courtCop: 162_500 },   // cancha $140k
        { from: "16:30", to: "17:00", courtCop: 172_500 },   // cancha $150k
        { from: "17:00", to: "20:00", courtCop: 182_500 },   // cancha $160k
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
  durationMinutes: 60 | 90 | 120,
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

export function getAvailableDurations(venueId: string): (60 | 90 | 120)[] {
  const venue = RULES[venueId];
  if (!venue) return [];
  const durations = new Set<60 | 90 | 120>();
  for (const dayRules of Object.values(venue)) {
    if (dayRules?.[60]?.length) durations.add(60);
    if (dayRules?.[90]?.length) durations.add(90);
    if (dayRules?.[120]?.length) durations.add(120);
  }
  return [...durations].sort();
}

export function getPlayerFeeFromRules(
  venueId: string,
  date: string,
  time: string,
  durationMinutes: 60 | 90 | 120,
): number | null {
  const court = getCourtCopFromRules(venueId, date, time, durationMinutes);
  return court === null ? null : Math.round(court / 4) + PLAYER_FEE_SURCHARGE_COP;
}
