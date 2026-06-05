const COMMON_FIRST_NAMES = [
  "mateo",
  "juan",
  "pedro",
  "carlos",
  "david",
  "andres",
  "luis",
  "jose",
  "maria",
  "ana",
  "paula",
  "laura",
  "camila",
  "sofia",
  "isabella",
];

export function sanitizeDisplayName(
  rawName: string | null | undefined,
  fallback = "Jugador",
): string {
  const value = (rawName ?? "").trim();
  if (!value) return fallback;

  if (!value.includes("@")) {
    return toTitleWords(value) || fallback;
  }

  const localPart = value.split("@")[0]?.trim() ?? "";
  if (!localPart) return fallback;

  const separated = localPart
    .replace(/[0-9]+/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (separated) {
    return toTitleWords(separated);
  }

  const lettersOnly = localPart.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (!lettersOnly) return fallback;

  for (const firstName of COMMON_FIRST_NAMES) {
    if (lettersOnly.startsWith(firstName) && lettersOnly.length > firstName.length + 2) {
      const rest = lettersOnly.slice(firstName.length);
      return `${capitalize(firstName)} ${capitalize(rest)}`;
    }
  }

  return capitalize(lettersOnly);
}

function toTitleWords(value: string) {
  return value
    // Drop stray symbols (backticks, quotes, numbers…) but keep Unicode
    // letters (incl. tildes/ñ), spaces, hyphens and apostrophes.
    .replace(/[^\p{L}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => capitalize(word))
    .join(" ");
}

function capitalize(value: string) {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1).toLowerCase();
}
