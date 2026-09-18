// Meal plan — the Fuel "Week" view's data model and pure helpers.
// A plan is 7 days x 4 slots. Each cell points at a recipe from the live
// library (or is empty). Nothing here talks to the network; the component
// and the API route do that.

import type { LiveRecipe, RecipeCategory } from "@/lib/recipes-live";
import type { ShoppingListSource } from "@/lib/shopping-list";

export const SLOTS: RecipeCategory[] = ["breakfast", "lunch", "dinner", "snack"];
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LABELS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface PlanCell {
  day: number; // 0 = Monday … 6 = Sunday
  slot: RecipeCategory;
  recipe_id: string | null;
  custom_title: string | null;
}

export type Plan = PlanCell[];

/** Monday of the week containing `d`, as YYYY-MM-DD (local). */
export function weekStartOf(d: Date = new Date()): string {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addWeeks(weekStart: string, n: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + n * 7);
  return weekStartOf(d);
}

export function todayDayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

export function emptyPlan(): Plan {
  const cells: Plan = [];
  for (let day = 0; day < 7; day++) for (const slot of SLOTS) cells.push({ day, slot, recipe_id: null, custom_title: null });
  return cells;
}

export function getCell(plan: Plan, day: number, slot: RecipeCategory): PlanCell | undefined {
  return plan.find((c) => c.day === day && c.slot === slot);
}

export function setCell(plan: Plan, day: number, slot: RecipeCategory, recipe_id: string | null, custom_title: string | null = null): Plan {
  const next = plan.filter((c) => !(c.day === day && c.slot === slot));
  next.push({ day, slot, recipe_id, custom_title });
  return next;
}

/**
 * Fill every empty slot from the library, spreading recipes out so the same
 * dinner doesn't land three days running. Deterministic given the same
 * inputs; `seed` shifts the rotation so "regenerate" gives a different week.
 */
export function autoFillWeek(plan: Plan, recipes: LiveRecipe[], seed = 0): Plan {
  let next = [...plan];
  for (const slot of SLOTS) {
    const pool = recipes.filter((r) => r.category === slot);
    if (!pool.length) continue;
    // Prefer higher-protein options first, then rotate through them.
    const ranked = [...pool].sort((a, b) => (b.protein_g ?? 0) - (a.protein_g ?? 0));
    const rotation = ranked.slice(0, Math.min(ranked.length, 5));
    for (let day = 0; day < 7; day++) {
      const cell = getCell(next, day, slot);
      if (cell?.recipe_id || cell?.custom_title) continue;
      const pick = rotation[(day + seed) % rotation.length];
      next = setCell(next, day, slot, pick.id);
    }
  }
  return next;
}

export function planDayTotals(plan: Plan, recipes: LiveRecipe[], day: number): { calories: number; protein: number } {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  let calories = 0, protein = 0;
  for (const slot of SLOTS) {
    const cell = getCell(plan, day, slot);
    const r = cell?.recipe_id ? byId.get(cell.recipe_id) : undefined;
    if (r) { calories += r.calories ?? 0; protein += r.protein_g ?? 0; }
  }
  return { calories, protein };
}

/** Every recipe the week uses, counted once per occurrence, ready for buildShoppingList. */
export function planToShoppingSources(plan: Plan, recipes: LiveRecipe[]): ShoppingListSource[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const sources: ShoppingListSource[] = [];
  for (const cell of plan) {
    const r = cell.recipe_id ? byId.get(cell.recipe_id) : undefined;
    if (r) sources.push({ recipeTitle: r.title, ingredients: r.ingredients ?? [] });
  }
  return sources;
}

export function countFilled(plan: Plan): number {
  return plan.filter((c) => c.recipe_id || c.custom_title).length;
}
