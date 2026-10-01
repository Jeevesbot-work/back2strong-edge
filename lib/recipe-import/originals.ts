import Anthropic from "@anthropic-ai/sdk";
import { addClaudeUsage } from "./cost";
import type { EvaluatedPost } from "./evaluate";
import { finishDraft } from "./ease";
import { normaliseIngredientLine, normaliseMethodStep } from "./ingredients";
import { calculateWithLookup } from "./nutrition";
import type { RecipeCategory } from "./types";
import { filterRecipe } from "./thresholds";
import type { DraftRecipe, SourcePost } from "./types";

const BRIEFS: Record<RecipeCategory, string[]> = {
  breakfast: ["egg whites, porridge oats and berries", "fat-free skyr, oats and a banana"],
  snack: ["fat-free skyr and strawberries", "turkey breast and cherry tomatoes", "cottage cheese and strawberries"],
  lunch: ["chicken breast, rice and broccoli", "turkey mince, potatoes and peas", "cod, potatoes and spinach", "prawns, rice and peppers"],
  dinner: ["chicken breast, potatoes and green beans", "turkey breast and pasta", "white fish, rice and courgette", "lean beef mince and peppers"],
};

function parseJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function weekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function sourceFor(category: RecipeCategory, index: number): SourcePost {
  return {
    platform: "b2s",
    sourceKey: `b2s:${category}-${index}-${weekKey()}`,
    url: "",
    creditHandle: "",
    caption: "",
  };
}

async function draftOriginal(
  category: RecipeCategory,
  brief: string,
  avoid: string[],
  correction: string,
): Promise<DraftRecipe | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const anthropic = new Anthropic({ apiKey });
  const servings = category === "snack" ? 1 : category === "breakfast" ? 2 : 4;
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1400,
    system: `You write an original Back2Strong recipe. It must not copy a creator, a website, or a famous named dish. Return JSON only.
{"title":"","description":"","servings":${servings},"prep_time_mins":10,"cook_time_mins":15,"ingredients":["200g chicken breast"],"method":["Heat the pan.","Serve."],"coach_note":"","simplicity":"simple","batch_cook":false,"family":true}
Rules: about 10 ingredients or fewer, 30 minutes or less, ordinary UK supermarket foods, UK names and grams. One line per ingredient, quantity glued to g or ml ("200g chicken breast", "150g fat-free skyr", "1 tsp salt"). Use only these foods: chicken breast, turkey breast, turkey mince, lean beef mince, cod, white fish, prawns, egg white, eggs, porridge oats, fat-free skyr, cottage cheese, rice, pasta, potato, broccoli, spinach, green beans, pepper, onion, courgette, cherry tomatoes, peas, strawberries, blueberries, banana, honey, olive oil, soy sauce, whey protein, salt, black pepper. No creator credit. Do not invent a brand name.`,
    messages: [
      {
        role: "user",
        content: `Category: ${category}. Build it around ${brief}. Servings: ${servings}. ${correction} Do not repeat these dishes: ${avoid.slice(0, 40).join("; ") || "none"}.`,
      },
    ],
  });
  addClaudeUsage(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0);
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  const parsed = parseJson(text);
  if (!parsed) return null;
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
  const ingredients = asStrings(parsed.ingredients).map(normaliseIngredientLine).filter((line): line is string => !!line);
  const method = asStrings(parsed.method).map(normaliseMethodStep).filter((line): line is string => !!line);
  if (!title || !description || ingredients.length < 3 || method.length < 2) return null;
  const servingsN = asNumber(parsed.servings) ?? servings;
  const draft = finishDraft(
    {
      title: title.slice(0, 120),
      category,
      description,
      servings: Math.round(servingsN),
      prep_time_mins: asNumber(parsed.prep_time_mins) == null ? 10 : Math.round(asNumber(parsed.prep_time_mins)!),
      cook_time_mins: asNumber(parsed.cook_time_mins) == null ? 15 : Math.round(asNumber(parsed.cook_time_mins)!),
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      ingredients,
      method,
      tags: ["high-protein", "family"],
      coach_note: "B2S original.",
      simplicity: "simple",
      niche: false,
    },
    { family: true, simplicity: "simple", batch: parsed.batch_cook === true },
  );
  const calculated = await calculateWithLookup(draft.ingredients, draft.servings);
  if (calculated.unresolved.length) return null;
  return {
    ...draft,
    calories: calculated.perServing.calories,
    protein_g: calculated.perServing.protein_g,
    carbs_g: calculated.perServing.carbs_g,
    fat_g: calculated.perServing.fat_g,
  };
}

/** Original breakfasts, snacks, and any shortfall. Macros come from the USDA table, not the model. */
export async function generateOriginals(
  slots: RecipeCategory[],
  avoidTitles: string[],
): Promise<{ posts: EvaluatedPost[]; errors: string[] }> {
  const posts: EvaluatedPost[] = [];
  const errors: string[] = [];
  const avoid = [...avoidTitles];
  const usedBrief = new Map<RecipeCategory, number>();

  for (let index = 0; index < slots.length; index += 1) {
    const category = slots[index];
    const briefs = BRIEFS[category];
    const brief = briefs[(usedBrief.get(category) ?? 0) % briefs.length];
    usedBrief.set(category, (usedBrief.get(category) ?? 0) + 1);
    let recipe: DraftRecipe | null = null;
    let failure = "";
    for (let attempt = 0; attempt < 2 && !recipe; attempt += 1) {
      try {
        const drafted = await draftOriginal(category, brief, avoid, failure);
        if (!drafted) {
          failure = "Use only foods with a gram amount that a UK supermarket sells, and include protein.";
          continue;
        }
        const filter = filterRecipe({
          category: drafted.category,
          calories: drafted.calories,
          protein_g: drafted.protein_g,
          carbs_g: drafted.carbs_g,
          fat_g: drafted.fat_g,
        });
        if (filter.decision !== "pass") {
          failure = `That draft was ${drafted.calories} kcal, ${drafted.protein_g}g protein, ${drafted.fat_g}g fat and failed: ${filter.reasons.join("; ")}. Adjust the quantities.`;
          continue;
        }
        recipe = drafted;
        const post = sourceFor(category, index);
        posts.push({
          post,
          classification: "recipe",
          recipe,
          filter,
          duplicateOf: null,
          duplicateReason: null,
          selected: true,
          outcome: "draft",
          note: "B2S original. Macros calculated from USDA FoodData Central.",
        });
        avoid.push(recipe.title);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "original recipe failed");
        break;
      }
    }
    if (!recipe) errors.push(`No original ${category} passed the macro check (${brief})`);
  }

  return { posts, errors };
}
