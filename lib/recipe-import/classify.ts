import type { PostKind } from "./types";

const UNIT_LINE = /\d+(?:[./]\d+)?\s*(g|kg|ml|l|tsp|tbsp|cups?)\b/i;
const PAYWALL_RE =
  /full recipe[\s\S]{0,48}(app|membership|patreon)|unlock the (full )?recipe|recipe is (only |behind )?(in|on) (my |the )?(app|membership)/i;
const PROMO_RE =
  /download (my |the )?app|\buse code\b|app store|meal[\s-]?plan app|link in bio|\bsubscribe\b|paid partnership|merch drop/i;

export function quantityLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => UNIT_LINE.test(line));
}

/** A caption counts as a recipe when it actually contains gram-style ingredients and macros. */
export function hasRecipeBody(text: string): boolean {
  const hasMacros = /\d+\s*k?cal\b/i.test(text) && /\d+(?:\.\d+)?\s*g\s*protein\b/i.test(text);
  return quantityLines(text).length >= 3 && hasMacros;
}

/**
 * Promos and paywalled posts are dropped even if they mention food.
 * A post that also contains a full ingredient list and macros is kept —
 * "link in bio" on an otherwise complete recipe is not a paywall.
 */
export function classifyPost(text: string): PostKind {
  if (hasRecipeBody(text)) return "recipe";
  if (PAYWALL_RE.test(text)) return "paywall";
  if (PROMO_RE.test(text)) return "promo";
  return "not_a_recipe";
}
