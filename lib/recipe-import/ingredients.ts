/** Turn a free-text ingredient into the shape the shopping-list merge already parses. */

const GLUED_UNITS = new Set(["g", "kg", "ml", "l"]);

export function normaliseIngredientLine(raw: string): string | null {
  let line = raw.trim().replace(/^[-•*]\s+/, "");
  // Drop a leading "1." step number, but leave "1.5 tbsp" and "500g" alone.
  line = line.replace(/^\d+[.)]\s+(?=[A-Za-z])/, "");
  if (!line) return null;
  // A bare heading ("For the sauce:") is not a shopping line.
  if (/:$/.test(line) && !/\d/.test(line)) return null;

  line = line.replace(/^(\d+(?:\.\d+)?)\s+(g|kg|ml|l)\b/i, (_, n: string, unit: string) => {
    return `${n}${unit.toLowerCase()}`;
  });
  line = line.replace(/^(\d+(?:\.\d+)?)(g|kg|ml|l)\b/i, (_, n: string, unit: string) => {
    return GLUED_UNITS.has(unit.toLowerCase()) ? `${n}${unit.toLowerCase()}` : `${n}${unit}`;
  });
  return line.replace(/\s+/g, " ").trim();
}

export function normaliseMethodStep(raw: string): string | null {
  const line = raw
    .trim()
    .replace(/^[-•*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return line || null;
}

/** Name used for cross-recipe dedupe, with the quantity and unit removed. */
export function ingredientName(line: string): string {
  let rest = line.trim().toLowerCase();
  rest = rest.replace(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*/, "");
  rest = rest.replace(/^(g|kg|ml|l|tsp|tbsp|tbsp|cups?|cup)\b\s*/, "");
  return rest.replace(/[^a-z0-9% ]+/g, " ").replace(/\s+/g, " ").trim();
}
