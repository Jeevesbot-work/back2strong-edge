import type { RecipeCategory } from "@/lib/recipes-live";
import { CATEGORY_ORDER } from "@/lib/recipes-live";
import type { FilterDecision, Simplicity } from "./types";

/** About ten recipes a week, mixed across the four Fuel categories. */
export const WEEKLY_TARGET = 10;

export const CATEGORY_QUOTA: Record<RecipeCategory, number> = {
  breakfast: 2,
  lunch: 3,
  dinner: 3,
  snack: 2,
};

export interface Selectable {
  category: RecipeCategory;
  decision: Extract<FilterDecision, "pass" | "flag">;
  protein_g: number;
  simplicity?: Simplicity;
}

/**
 * Fill each category up to its quota, taking clean passes before fat-band
 * flags, and higher protein first. If a category is short, leftover recipes
 * fill the remaining slots up to WEEKLY_TARGET.
 */
export function selectWeekly<T extends Selectable>(items: T[]): { picked: T[]; overflow: T[] } {
  const ease = (item: T) => (item.simplicity === "fiddly" ? 2 : item.simplicity === "ok" ? 1 : 0);
  const rank = (a: T, b: T) => {
    if (a.decision !== b.decision) return a.decision === "pass" ? -1 : 1;
    const byEase = ease(a) - ease(b);
    if (byEase !== 0) return byEase;
    return b.protein_g - a.protein_g;
  };

  const grouped = new Map<RecipeCategory, T[]>();
  for (const item of items) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  const picked: T[] = [];
  let overflow: T[] = [];
  for (const category of CATEGORY_ORDER) {
    const pool = (grouped.get(category) ?? []).slice().sort(rank);
    const quota = CATEGORY_QUOTA[category];
    picked.push(...pool.slice(0, quota));
    overflow.push(...pool.slice(quota));
  }

  if (picked.length < WEEKLY_TARGET && overflow.length > 0) {
    const ranked = overflow.slice().sort(rank);
    const need = WEEKLY_TARGET - picked.length;
    const extra = ranked.slice(0, need);
    const extraSet = new Set(extra);
    picked.push(...extra);
    overflow = overflow.filter((item) => !extraSet.has(item));
  }

  return { picked: picked.slice(0, WEEKLY_TARGET), overflow };
}
