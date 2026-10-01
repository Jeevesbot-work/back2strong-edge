import type { PostKind } from "./types";

const INGREDIENT_UNIT =
  /\d+(?:[./]\d+)?\s*(?:kilograms?|grams?|kg|g|millilitres?|milliliters?|ml|litres?|liters?|l|tablespoons?|teaspoons?|tbsp|tsp|cups?)\b/gi;
const PAYWALL_RE =
  /full recipe[\s\S]{0,48}(app|membership|patreon)|unlock the (full )?recipe|recipe is (only |behind )?(in|on) (my |the )?(app|membership)/i;
const PROMO_RE =
  /download (my |the )?app|\buse code\b|app store|meal[\s-]?plan app|link in bio|\bsubscribe\b|paid partnership|merch drop/i;
const COOKING_HINT =
  /\b(proteins?|calor(?:ie|ies)|ingredients?|grams?|recipes?|serves|tbsp|tablespoons?)\b/i;

function hasCalorieMacro(text: string): boolean {
  return /\d[\d,.]*\s*(?:kcal|calories)\b/i.test(text) || /\bcalories?\s*[:\-]?\s*\d/i.test(text);
}

function hasProteinMacro(text: string): boolean {
  return (
    /\d+(?:\.\d+)?\s*g(?:rams?)?\s*(?:of\s+)?protein\b/i.test(text) ||
    /\bprotein\s*[:\-]?\s*\d+(?:\.\d+)?\s*g(?:rams?)?\b/i.test(text)
  );
}

/** Ingredient amounts anywhere in the caption, including "500 grams" and "1 tbsp". */
export function ingredientUnitCount(text: string): number {
  return text.match(INGREDIENT_UNIT)?.length ?? 0;
}

export function quantityLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => ingredientUnitCount(line) > 0);
}

/**
 * A caption counts as a recipe when it states calories, protein, and at least
 * two measured amounts. Card layouts ("Calories: 520", "Protein: 54g",
 * "500 grams") count, not only "520 kcal" and "54g protein" on their own lines.
 */
export function hasRecipeBody(text: string): boolean {
  return hasCalorieMacro(text) && hasProteinMacro(text) && ingredientUnitCount(text) >= 2;
}

/**
 * Send a post to the rewriter when the caption is a recipe, or when a reel
 * transcript is long enough to be a spoken method. Short gym captions stay out.
 */
export function worthRewriting(text: string, transcript?: string | null): boolean {
  if (hasRecipeBody(text)) return true;
  const spoken = (transcript ?? "").trim();
  return spoken.length >= 280 && COOKING_HINT.test(spoken);
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
