import type { RecipeCategory } from "@/lib/recipes-live";
import { CATEGORY_QUOTA, WEEKLY_TARGET } from "./select";

export function originalSlots(counts: Record<RecipeCategory, number>): RecipeCategory[] {
  const next = {
    breakfast: counts.breakfast ?? 0,
    lunch: counts.lunch ?? 0,
    dinner: counts.dinner ?? 0,
    snack: counts.snack ?? 0,
  };
  const slots: RecipeCategory[] = [];
  const total = () => next.breakfast + next.lunch + next.dinner + next.snack;
  const take = (category: RecipeCategory) => {
    slots.push(category);
    next[category] += 1;
  };

  while (next.breakfast < CATEGORY_QUOTA.breakfast) take("breakfast");
  while (next.snack < CATEGORY_QUOTA.snack) take("snack");

  const order: RecipeCategory[] = ["lunch", "dinner", "breakfast", "snack"];
  let turn = 0;
  while (total() < WEEKLY_TARGET && turn < 16) {
    const category = order[turn % order.length];
    if (next[category] < CATEGORY_QUOTA[category]) take(category);
    turn += 1;
  }
  return slots;
}
