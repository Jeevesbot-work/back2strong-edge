import { RECIPES } from "@/lib/recipes";
import type { LibraryEntry } from "./dedupe";

/**
 * Offline stand-in for public.recipes. Live runs load the real table
 * (title, ingredients, source_key) instead of this list.
 */
export function bundledLibrary(): LibraryEntry[] {
  return RECIPES.map((recipe) => ({
    title: recipe.title,
    ingredients: recipe.ingredient_groups.flatMap((group) => group.items),
    sourceKey: null,
  }));
}
