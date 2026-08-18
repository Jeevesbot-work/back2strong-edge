// "For You" — ranks the recipe library against what a client still needs
// today, so the Fuel tab can prompt meals that actually fit, instead of
// making them scroll a flat list and do the maths themselves.

export interface SuggestableRecipe {
  id: string;
  calories: number | null;
  protein_g: number | null;
}

export interface Remaining {
  protein: number; // grams still needed today (can be <= 0 if already hit)
  calories: number; // kcal still available today (can be <= 0 if already hit)
}

const CALORIE_BUDGET_SLACK = 1.15; // a recipe a little over "remaining" is still fine

/**
 * Returns recipe ids ranked best-first. Recipes with no calorie/protein data
 * are excluded — we're not going to guess a fit for a meal we can't measure.
 */
export function rankRecipesForRemaining<T extends SuggestableRecipe>(recipes: T[], remaining: Remaining): T[] {
  const measurable = recipes.filter((r) => r.calories != null && r.protein_g != null && r.calories > 0);
  const proteinDensity = (r: T) => (r.protein_g as number) / (r.calories as number);

  const hasRoom = remaining.calories > 0 && remaining.protein > 0;
  if (!hasRoom) {
    // Targets already hit (or day's basically done) — still surface the most
    // protein-efficient options rather than showing nothing.
    return [...measurable].sort((a, b) => proteinDensity(b) - proteinDensity(a));
  }

  const withinBudget = measurable.filter((r) => (r.calories as number) <= remaining.calories * CALORIE_BUDGET_SLACK);
  const pool = withinBudget.length > 0 ? withinBudget : measurable; // relax rather than show nothing

  return [...pool].sort((a, b) => {
    // Primary: how much of the remaining protein need it closes, without
    // overshooting it more than the other option does.
    const aFit = Math.min((a.protein_g as number) / remaining.protein, 1.5);
    const bFit = Math.min((b.protein_g as number) / remaining.protein, 1.5);
    if (Math.abs(aFit - bFit) > 0.05) return bFit - aFit;
    // Tiebreak: protein density (more protein per calorie wins).
    return proteinDensity(b) - proteinDensity(a);
  });
}
