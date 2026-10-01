import type { RecipeCategory } from "@/lib/recipes-live";
import { normaliseIngredientLine, normaliseMethodStep } from "./ingredients";
import type { DraftRecipe } from "./types";

const CATEGORIES: RecipeCategory[] = ["breakfast", "lunch", "dinner", "snack"];

function section(text: string, start: RegExp, end: RegExp | null): string[] {
  const lines = text.split(/\r?\n/);
  let on = false;
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!on) {
      if (start.test(line)) on = true;
      continue;
    }
    if (end && end.test(line)) break;
    if (line) out.push(line);
  }
  return out;
}

function categoryOf(text: string): RecipeCategory | null {
  const explicit = text.match(/^category:\s*(breakfast|lunch|dinner|snack)\s*$/im);
  if (explicit && CATEGORIES.includes(explicit[1].toLowerCase() as RecipeCategory)) {
    return explicit[1].toLowerCase() as RecipeCategory;
  }
  const blob = text.toLowerCase();
  if (/\bbreakfast\b|\bovernight oats\b|\bomelette\b/.test(blob)) return "breakfast";
  if (/\bsnack\b/.test(blob)) return "snack";
  if (/\blunch\b|\bpitta\b/.test(blob)) return "lunch";
  if (/\bdinner\b|\btray\b|\bchilli\b|\bchili\b/.test(blob)) return "dinner";
  return null;
}

function firstNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function titleOf(text: string, titleHint?: string | null): string | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  // A reel caption is often a one-line tease; the recipe card starts on the line above "Category:".
  const categoryAt = lines.findIndex((line) => /^category:\s*(breakfast|lunch|dinner|snack)\s*$/i.test(line));
  if (categoryAt > 0) return lines[categoryAt - 1].replace(/\s+/g, " ").slice(0, 120);

  const meta = /^(category|serves?|prep|cook|per serving|ingredients|method|steps|directions|instructions)\b/i;
  for (const line of lines) {
    if (meta.test(line) || /^\d+\s*k?cal\b/i.test(line)) continue;
    return line.replace(/\s+/g, " ").slice(0, 120);
  }
  const hint = titleHint?.trim();
  return hint ? hint.slice(0, 120) : null;
}

function tagsFor(ingredients: string[], servings: number): string[] {
  const blob = ingredients.join(" ").toLowerCase();
  const tags = ["high-protein"];
  const pairs: Array<[RegExp, string]> = [
    [/chicken/, "chicken"],
    [/beef|mince/, "beef"],
    [/turkey/, "turkey"],
    [/salmon|cod|prawn|tuna|fish/, "fish"],
    [/tofu/, "tofu"],
    [/egg/, "eggs"],
    [/yoghurt|yogurt/, "yoghurt"],
    [/cottage cheese/, "cottage-cheese"],
    [/oat/, "oats"],
  ];
  for (const [pattern, tag] of pairs) if (pattern.test(blob) && !tags.includes(tag)) tags.push(tag);
  if (servings >= 4 && !tags.includes("meal-prep")) tags.push("meal-prep");
  return tags;
}

/**
 * Deterministic parse for captions that already look like a recipe card
 * (servings, per-serving macros, an ingredients list, a method).
 * Live imports still send the source through Claude so the saved wording
 * is rewritten; this parser is what the dry-run uses, and the gate that
 * decides a caption is complete enough to be worth a rewrite.
 */
export function extractRecipe(text: string, titleHint?: string | null): DraftRecipe | null {
  const title = titleOf(text, titleHint);
  const category = categoryOf(text);
  const servings = firstNumber(text, /serves?:?\s*(\d+)/i);
  const calories = firstNumber(text, /(\d+(?:\.\d+)?)\s*k?cal\b/i);
  const protein = firstNumber(text, /(\d+(?:\.\d+)?)\s*g\s*protein\b/i);
  const carbs = firstNumber(text, /(\d+(?:\.\d+)?)\s*g\s*carbs?\b/i);
  const fat = firstNumber(text, /(\d+(?:\.\d+)?)\s*g\s*fat\b/i);
  const prep = firstNumber(text, /prep(?:\s*time)?:?\s*(\d+)/i);
  const cook = firstNumber(text, /cook(?:\s*time)?:?\s*(\d+)/i);

  const ingredients = section(text, /^ingredients\b/i, /^(method|steps|directions|instructions)\b/i)
    .map(normaliseIngredientLine)
    .filter((line): line is string => !!line);
  const method = section(text, /^(method|steps|directions|instructions)\b/i, null)
    .map(normaliseMethodStep)
    .filter((line): line is string => !!line);

  if (!title || !category || !servings || calories == null || protein == null || carbs == null || fat == null) {
    return null;
  }
  if (ingredients.length < 3 || method.length < 2) return null;

  return {
    title,
    category,
    description: `${title}. A ${category} with ${Math.round(protein)}g of protein a serving.`,
    servings: Math.round(servings),
    prep_time_mins: prep == null ? null : Math.round(prep),
    cook_time_mins: cook == null ? null : Math.round(cook),
    calories: Math.round(calories),
    protein_g: Math.round(protein),
    carbs_g: Math.round(carbs),
    fat_g: Math.round(fat),
    ingredients,
    method,
    tags: tagsFor(ingredients, Math.round(servings)),
    coach_note: null,
  };
}
