import Anthropic from "@anthropic-ai/sdk";
import { addClaudeUsage } from "./cost";
import { finishDraft } from "./ease";
import { normaliseIngredientLine, normaliseMethodStep } from "./ingredients";
import type { DraftRecipe, PostKind, RecipeCategory, Simplicity } from "./types";
import type { ExtractResult } from "./evaluate";

const CATEGORIES: RecipeCategory[] = ["breakfast", "lunch", "dinner", "snack"];

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function longSpanCopied(text: string, source: string): boolean {
  const needle = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (needle.length < 80) return false;
  return source.toLowerCase().replace(/\s+/g, " ").includes(needle);
}

function looksCopied(recipe: DraftRecipe, source: string): boolean {
  if (longSpanCopied(recipe.description, source)) return true;
  return recipe.method.some((step) => longSpanCopied(step, source));
}

function toRecipe(parsed: Record<string, unknown>): DraftRecipe | PostKind | null {
  const kind = typeof parsed.kind === "string" ? parsed.kind : "";
  if (kind === "promo" || kind === "paywall" || kind === "not_a_recipe") return kind;
  if (kind !== "recipe") return null;

  const category = parsed.category;
  if (typeof category !== "string" || !CATEGORIES.includes(category as RecipeCategory)) return null;
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
  const servings = asNumber(parsed.servings);
  const calories = asNumber(parsed.calories);
  const protein = asNumber(parsed.protein_g);
  const carbs = asNumber(parsed.carbs_g);
  const fat = asNumber(parsed.fat_g);
  const ingredients = asStringArray(parsed.ingredients).map(normaliseIngredientLine).filter((line): line is string => !!line);
  const method = asStringArray(parsed.method).map(normaliseMethodStep).filter((line): line is string => !!line);
  const tags = asStringArray(parsed.tags).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  const coach = typeof parsed.coach_note === "string" ? parsed.coach_note.trim() : "";
  if (!title || !description || servings == null || calories == null || protein == null || carbs == null || fat == null) {
    return null;
  }
  if (ingredients.length < 3 || method.length < 2) return null;

  const hinted = typeof parsed.simplicity === "string" ? parsed.simplicity : "";
  const simplicity: Simplicity = hinted === "simple" || hinted === "fiddly" ? hinted : "ok";

  return finishDraft(
    {
      title: title.slice(0, 120),
      category: category as RecipeCategory,
      description,
      servings: Math.round(servings),
      prep_time_mins: asNumber(parsed.prep_time_mins) == null ? null : Math.round(asNumber(parsed.prep_time_mins)!),
      cook_time_mins: asNumber(parsed.cook_time_mins) == null ? null : Math.round(asNumber(parsed.cook_time_mins)!),
      calories: Math.round(calories),
      protein_g: Math.round(protein),
      carbs_g: Math.round(carbs),
      fat_g: Math.round(fat),
      ingredients,
      method,
      tags: tags.length ? tags : ["high-protein"],
      coach_note: coach || null,
      simplicity,
      niche: parsed.niche === true,
    },
    {
      batch: parsed.batch_cook === true,
      family: parsed.family === true,
      simplicity,
      niche: parsed.niche === true,
    },
  );
}

const SYSTEM = `You turn a public social-media recipe into an original Back2Strong Edge recipe. Return JSON only — no markdown fences, no commentary.

The saved recipe must be in Edge's own words: plain British English, direct, warm, no hype, no emojis, no hashtags, no "hey guys". Do not copy the source's sentences, jokes, or step order word for word. Keep the dish the same and keep every quantity. Do not invent ingredients or macros that are not in the source.

If the text is an app promo, a merch plug, or a training update with no cookable recipe, return {"kind":"promo"}.
If it tells the reader the full recipe is in an app, membership, or link and the ingredients and method are not actually in the text, return {"kind":"paywall"}.
If it is not a recipe, return {"kind":"not_a_recipe"}.
If macros are not stated (per serving or as a total you can divide by the servings), return {"kind":"not_a_recipe"}. Do not estimate macros.

When it is a recipe, return:
{"kind":"recipe","title":"","category":"breakfast|lunch|dinner|snack","description":"","servings":4,"prep_time_mins":10,"cook_time_mins":20,"calories":500,"protein_g":40,"carbs_g":35,"fat_g":12,"ingredients":["500g chicken breast"],"method":["Heat the oven to 200C."],"tags":["high-protein","quick","family"],"coach_note":"","simplicity":"simple","niche":false,"batch_cook":false,"family":true}

Rules for those fields:
- calories, protein_g, carbs_g and fat_g are per serving. If the source gives a batch total, divide by servings and round.
- ingredients is one line per item and nothing else. Grams and millilitres are glued to the number: "500g chicken breast", "200ml milk". Spoons stay separate: "1 tbsp soy sauce". No section headings.
- method is short original steps. Do not mention the creator, their account, or "link in bio".
- coach_note is one sentence of practical coaching, or an empty string. Do not put the source credit there — the app adds that.
- category is the meal the dish is, not the time of day it was posted.
- Write for a UK kitchen. Use grams and millilitres, and UK names: courgette not zucchini, coriander not cilantro, aubergine not eggplant, rocket not arugula, spring onion not scallion, mince not ground meat, plain flour not all-purpose flour.
- Prefer a simple family meal: about 10 ingredients or fewer, 30 minutes or less in total, ordinary UK supermarket food. A longer batch cook is fine when you mark it.
- simplicity is "simple" for that kind of meal, "fiddly" for lots of steps, special equipment, or hard-to-find ingredients, otherwise "ok".
- niche is true only when a key ingredient is not in a normal UK supermarket.
- batch_cook is true when the dish is meant to be cooked once and eaten over several meals.
- family is true when it suits a household, not a single niche diet plate.
- tags should include "quick" when it is about 30 minutes or less, "batch-cook" when batch_cook is true, and "family" when family is true.

Add those fields to the recipe JSON: "simplicity":"simple","niche":false,"batch_cook":false,"family":true`;

async function complete(source: string, stricter: boolean): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${stricter ? "Your previous draft copied the source. Rewrite every step and the description so no sentence of 80 characters or more appears in the source. Keep the quantities.\n\n" : ""}SOURCE:\n${source}`,
      },
    ],
  });
  addClaudeUsage(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0);
  return parseJson(textOf(response));
}

/** Rewrite one source in Edge's words. Refuses a draft that still copies a long source sentence. */
export async function rewriteRecipe(source: string): Promise<ExtractResult> {
  let parsed = await complete(source, false);
  if (!parsed) return { ok: false, error: "the model did not return JSON" };
  let recipe = toRecipe(parsed);
  if (typeof recipe === "string") return { ok: false, kind: recipe, error: `model marked this as ${recipe}` };
  if (!recipe) {
    parsed = await complete(source, true);
    if (!parsed) return { ok: false, error: "the model did not return JSON" };
    recipe = toRecipe(parsed);
    if (typeof recipe === "string") return { ok: false, kind: recipe, error: `model marked this as ${recipe}` };
    if (!recipe) return { ok: false, error: "the model returned an incomplete recipe" };
  }
  if (looksCopied(recipe, source)) {
    parsed = await complete(source, true);
    recipe = parsed ? toRecipe(parsed) : null;
    if (!recipe || typeof recipe === "string") {
      return { ok: false, error: "rewrite stayed too close to the source, so it was not saved" };
    }
    if (looksCopied(recipe, source)) {
      return { ok: false, error: "rewrite stayed too close to the source, so it was not saved" };
    }
  }
  return { ok: true, recipe };
}
