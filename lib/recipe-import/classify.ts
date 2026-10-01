import type { PostKind } from "./types";

const INGREDIENT_UNIT =
  /\d+(?:[./]\d+)?\s*(?:kilograms?|grams?|kg|g|millilitres?|milliliters?|ml|litres?|liters?|l|tablespoons?|teaspoons?|tbsp|tsp|cups?)\b/gi;
const PAYWALL_RE =
  /full recipe[\s\S]{0,60}(app|membership|patreon|ebook|e-book|recipe book|book|guide)|unlock the (full )?recipe|recipe is (only |behind )?(in|on) (my |the )?(app|membership|book|ebook)|comment\s+[‘'"]?[a-z0-9]{2,}[’'"]?\s+(and |to )?(get|for|i['’]ll send)|\brecipe book\b/i;
const DISH_NAME =
  /\b(oats?|pancake|muffin|waffle|yogh?urt|skyr|smoothie|omelette|scrambled eggs|porridge|granola|chicken|turkey|beef mince|salmon|cod|prawn|tofu|burrito|tacos?|pitta|pita|flatbread|pizza|brownie|protein bars?|salad|soup|curry|noodles|pasta|wraps?|toast|frittata|egg bites?|cheesecake|overnight)\b/i;
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

export function captionHasMacros(text: string): boolean {
  return hasCalorieMacro(text) || hasProteinMacro(text);
}

export function captionHasDishName(text: string): boolean {
  return DISH_NAME.test(text);
}

/** A written method is already in the caption, so a transcript would be wasted. */
export function captionHasMethod(text: string): boolean {
  const steps = text.split(/\n/).filter((line) => /^\s*(?:\d+[.)]|step\s+\d+)\s+\S+/i.test(line.trim()));
  if (steps.length >= 2) return true;
  const split = text.split(/\b(?:method|directions|instructions|how to make it|how to make)\b/i);
  if (split.length < 2) return false;
  const after = split.slice(1).join(" ");
  const lines = after.split(/\n/).map((line) => line.trim()).filter((line) => line.length > 12);
  if (lines.length >= 2) return true;
  const sentences = after.split(/[.!?]/).map((line) => line.trim()).filter((line) => line.length > 30);
  return sentences.length >= 2;
}

function captionWithoutTranscript(text: string, transcript?: string | null): string {
  const spoken = (transcript ?? "").trim();
  if (!spoken) return text;
  if (text.endsWith(spoken)) return text.slice(0, -spoken.length).trim();
  return text;
}

/**
 * Send a post to the rewriter when the caption is a recipe, when a reel
 * transcript is a spoken method, or when the caption names a dish or shows
 * macros and a transcript is attached. Short gym captions stay out.
 */
export function worthRewriting(text: string, transcript?: string | null): boolean {
  if (hasRecipeBody(text)) return true;
  const spoken = (transcript ?? "").trim();
  if (!spoken) return false;
  if (spoken.length >= 280 && COOKING_HINT.test(spoken)) return true;
  const caption = captionWithoutTranscript(text, spoken);
  return spoken.length >= 80 && (captionHasMacros(caption) || captionHasDishName(caption));
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
