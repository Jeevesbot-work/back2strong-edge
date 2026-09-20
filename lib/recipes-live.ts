// Live recipe library — read from the Supabase `public.recipes` table using the
// client's authenticated session (RLS policy `recipes_read_all_authenticated`
// allows the `authenticated` role to SELECT rows where published = true).
//
// This replaces the old hard-coded lists (lib/recipes.ts / back2strong_recipes.json)
// as the source of truth for the Fuel tab's recipe library.

export type RecipeCategory = "breakfast" | "lunch" | "dinner" | "snack";

/**
 * One parsed ingredient line.
 *
 * `display` is the original prose and is what the UI shows — the parsed fields
 * sit underneath it for portion scaling, shopping lists and allergens. A line
 * with `section: true` is a heading ("For the sauce:"), not an ingredient.
 *
 * `confidence` records how the quantity was derived:
 *   high    — an explicit gram/ml weight was stated, e.g. "2 tbsp (50g)"
 *   medium  — a leading quantity and a recognised unit, e.g. "96g almond flour"
 *   low     — a bare count with no unit, e.g. "2 large eggs"
 *   none    — no quantity found, e.g. "Salt & black pepper"
 * Treat anything below `medium` as needing a human check before it drives a
 * calculation someone relies on.
 */
export interface StructuredIngredient {
  display: string;
  section: boolean;
  item?: string;
  qty?: number;
  unit?: string;
  note?: string;
  confidence: "high" | "medium" | "low" | "none" | "section";
}

export interface LiveRecipe {
  id: string;
  title: string;
  slug: string;
  category: RecipeCategory;
  description: string | null;
  servings: number | null;
  prep_time_mins: number | null;
  cook_time_mins: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  saturated_fat_g: number | null;
  ingredients: string[];
  /** Parsed form of `ingredients`. Only present when explicitly selected — see RECIPE_COLUMNS_FULL. */
  ingredients_structured?: StructuredIngredient[] | null;
  method: string[];
  coach_note: string | null;
  tags: string[] | null;
  image_url: string | null;
}

// The columns we read — kept explicit so we never pull `published` etc. needlessly.
// `ingredients_structured` is deliberately NOT here: it roughly doubles the row
// size and the library list does not need it. Use RECIPE_COLUMNS_FULL for the
// screens that do (scaling, shopping lists).
export const RECIPE_COLUMNS =
  "id,title,slug,category,description,servings,prep_time_mins,cook_time_mins,calories,protein_g,carbs_g,fat_g,fibre_g,sugar_g,sodium_mg,saturated_fat_g,ingredients,method,coach_note,tags,image_url";

export const RECIPE_COLUMNS_FULL = `${RECIPE_COLUMNS},ingredients_structured`;

/**
 * Net carbs = total carbs minus fibre. Returns null when either figure is
 * unknown, so callers show "—" rather than a wrong number.
 *
 * This is informational only. It is not dosing advice, and anything shown to a
 * Type 1 diabetic should carry that caveat and be signed off clinically.
 */
export function netCarbs(recipe: Pick<LiveRecipe, "carbs_g" | "fibre_g">): number | null {
  if (recipe.carbs_g == null || recipe.fibre_g == null) return null;
  return Math.max(0, recipe.carbs_g - recipe.fibre_g);
}

/** Scale a parsed ingredient to a different number of servings. */
export function scaleIngredient(
  ing: StructuredIngredient,
  fromServings: number,
  toServings: number,
): StructuredIngredient {
  if (ing.section || ing.qty == null || !fromServings || fromServings <= 0) return ing;
  const factor = toServings / fromServings;
  return { ...ing, qty: Math.round(ing.qty * factor * 100) / 100 };
}

export const CATEGORY_ORDER: RecipeCategory[] = ["breakfast", "lunch", "dinner", "snack"];

export const CATEGORY_LABEL: Record<RecipeCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

// Order recipes by the fixed category sequence, then alphabetically by title.
export function sortRecipes(recipes: LiveRecipe[]): LiveRecipe[] {
  return [...recipes].sort((a, b) => {
    const ci = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (ci !== 0) return ci;
    return a.title.localeCompare(b.title);
  });
}

export function totalTimeMins(r: LiveRecipe): number {
  return (r.prep_time_mins ?? 0) + (r.cook_time_mins ?? 0);
}
