import Anthropic from "@anthropic-ai/sdk";
import { addClaudeUsage } from "./cost";
import { calculateWithLookup } from "./nutrition";
import { filterRecipe } from "./thresholds";
import type { DraftRecipe } from "./types";

/** Lunch and dinner whose stated fat sits in the 15–20g review band. */
export function isLeanSwapCandidate(recipe: DraftRecipe): boolean {
  if (recipe.category !== "lunch" && recipe.category !== "dinner") return false;
  return recipe.fat_g > 15 && recipe.fat_g <= 20;
}

function parseJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * One swap, then macros recomputed from the ingredient table.
 * Returns null when the swap still misses the pass line, so the flagged original stands.
 */
export async function leanSwapRecipe(recipe: DraftRecipe): Promise<DraftRecipe | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system:
      'You make one lean swap so a lunch or dinner drops to 15g of fat or less per serving. Return JSON only: {"from":"chicken thigh","to":"chicken breast","ingredients":["500g chicken breast"]}. Change one ingredient to a leaner UK supermarket version (thigh to breast, full-fat cheese to reduced-fat cheddar, full-fat yoghurt to 0% Greek yoghurt). Keep the same weight. Do not add ingredients.',
    messages: [
      {
        role: "user",
        content: `Fat is ${recipe.fat_g}g per serving. Ingredients:\n${recipe.ingredients.join("\n")}`,
      },
    ],
  });
  addClaudeUsage(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0);
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  const parsed = parseJson(text);
  const from = typeof parsed?.from === "string" ? parsed.from.trim() : "";
  const to = typeof parsed?.to === "string" ? parsed.to.trim() : "";
  const ingredients = Array.isArray(parsed?.ingredients) ? parsed.ingredients.filter((line): line is string => typeof line === "string") : [];
  if (!from || !to || ingredients.length < 3) return null;

  const calculated = await calculateWithLookup(ingredients, recipe.servings);
  if (calculated.unresolved.length) return null;
  const next: DraftRecipe = {
    ...recipe,
    ingredients,
    calories: calculated.perServing.calories,
    protein_g: calculated.perServing.protein_g,
    carbs_g: calculated.perServing.carbs_g,
    fat_g: calculated.perServing.fat_g,
    coach_note: `Lean swap: ${from} → ${to}. Macros recomputed from USDA FoodData Central.`,
  };
  const filter = filterRecipe({
    category: next.category,
    calories: next.calories,
    protein_g: next.protein_g,
    carbs_g: next.carbs_g,
    fat_g: next.fat_g,
  });
  return filter.decision === "pass" ? next : null;
}
