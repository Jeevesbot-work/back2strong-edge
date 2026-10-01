import { scrapeCreators } from "./apify";
import { toDraftRow } from "./draft";
import { evaluatePosts, type EvaluatedPost } from "./evaluate";
import { generateRecipeImage, imageCreditsExhausted } from "./images";
import type { LibraryEntry } from "./dedupe";
import { rewriteRecipe } from "./rewrite";
import { saveRecipeImage } from "@/lib/recipes/save-image";
import { createServiceClient } from "@/lib/supabase/service";
import type { DraftRecipe, RecipeCategory } from "./types";

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function loadLiveLibrary(): Promise<LibraryEntry[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("title, ingredients, source_key, content_fingerprint");
  if (error) {
    if (/source_key|content_fingerprint|import_status/i.test(error.message)) {
      throw new Error(
        "Recipe import columns are missing. Apply lib/supabase/migrations/0013_recipe_drafts.sql in the Supabase SQL editor, then rerun. It was not applied automatically.",
      );
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    title: String(row.title ?? ""),
    ingredients: asStrings(row.ingredients),
    sourceKey: typeof row.source_key === "string" ? row.source_key : null,
    fingerprint: typeof row.content_fingerprint === "string" ? row.content_fingerprint : null,
  }));
}

export interface InsertedDraft {
  sourceKey: string;
  id: string;
  image: string;
}

export async function insertDrafts(rows: EvaluatedPost[]): Promise<{ inserted: InsertedDraft[]; errors: string[] }> {
  const supabase = createServiceClient();
  const inserted: InsertedDraft[] = [];
  const errors: string[] = [];
  let imagePause: string | null = null;

  for (const row of rows) {
    if (!row.selected || !row.recipe || !row.filter) continue;
    const status = row.filter.decision === "flag" ? "flagged" : "draft";
    const note = row.filter.decision === "flag" ? row.filter.reasons.join("; ") : null;
    const payload = toDraftRow(row.recipe, row.post, { status, note });
    const { data, error } = await supabase.from("recipes").insert(payload).select("id").single();
    if (error) {
      if (/duplicate|source_key|23505/i.test(error.message)) {
        errors.push(`${row.post.sourceKey} skipped: already imported`);
        continue;
      }
      errors.push(`${row.post.sourceKey} was not saved: ${error.message}`);
      continue;
    }
    const id = String(data.id);
    let image = "pending";
    if (imagePause) {
      image = imagePause;
    } else {
      const generated = await generateRecipeImage(row.recipe);
      if ("error" in generated) {
        image = generated.error;
        if (imageCreditsExhausted(generated.error)) {
          imagePause = "image generation skipped: OpenAI has no credits yet";
          errors.push(imagePause);
        } else {
          errors.push(`${row.post.sourceKey} saved without a photo: ${generated.error}`);
        }
      } else {
        const saved = await saveRecipeImage(id, generated.base64, generated.mime);
        image = saved.ok ? saved.url : saved.error;
        if (!saved.ok) errors.push(`${row.post.sourceKey} saved without a photo: ${saved.error}`);
      }
    }
    inserted.push({ sourceKey: row.post.sourceKey, id, image });
  }

  return { inserted, errors };
}

const CATEGORIES: RecipeCategory[] = ["breakfast", "lunch", "dinner", "snack"];

function rowToRecipe(row: Record<string, unknown>): DraftRecipe | null {
  const category = String(row.category ?? "");
  if (!CATEGORIES.includes(category as RecipeCategory)) return null;
  const title = String(row.title ?? "").trim();
  if (!title) return null;
  return {
    title,
    category: category as RecipeCategory,
    description: String(row.description ?? title),
    servings: Number(row.servings ?? 1) || 1,
    prep_time_mins: row.prep_time_mins == null ? null : Number(row.prep_time_mins),
    cook_time_mins: row.cook_time_mins == null ? null : Number(row.cook_time_mins),
    calories: Number(row.calories ?? 0),
    protein_g: Number(row.protein_g ?? 0),
    carbs_g: Number(row.carbs_g ?? 0),
    fat_g: Number(row.fat_g ?? 0),
    ingredients: asStrings(row.ingredients),
    method: asStrings(row.method),
    tags: asStrings(row.tags),
    coach_note: null,
    simplicity: "ok",
    niche: false,
  };
}

export interface ImageBackfill {
  filled: number;
  skipped: string | null;
}

/** Photos for unpublished drafts that were saved before image credit was available. */
export async function backfillDraftImages(): Promise<ImageBackfill> {
  if (!process.env.OPENAI_API_KEY) {
    return { filled: 0, skipped: "OPENAI_API_KEY is not set, so existing drafts were left without photos" };
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, category, description, servings, prep_time_mins, cook_time_mins, calories, protein_g, carbs_g, fat_g, ingredients, method, tags, image_url, published, import_status")
    .eq("published", false)
    .in("import_status", ["draft", "flagged"])
    .order("imported_at", { ascending: true });
  if (error) return { filled: 0, skipped: error.message };

  const pending = (data ?? []).filter((row) => !row.image_url);
  let filled = 0;
  let skipped: string | null = null;
  for (const row of pending) {
    const recipe = rowToRecipe(row);
    if (!recipe) continue;
    const generated = await generateRecipeImage(recipe);
    if ("error" in generated) {
      if (imageCreditsExhausted(generated.error)) {
        return { filled, skipped: "OpenAI has no credits yet, so the photo backfill stopped" };
      }
      skipped = skipped ?? generated.error;
      continue;
    }
    const saved = await saveRecipeImage(String(row.id), generated.base64, generated.mime);
    if (!saved.ok) {
      skipped = skipped ?? saved.error;
      continue;
    }
    filled += 1;
  }
  return { filled, skipped };
}

export async function prepareLivePosts(): Promise<{ posts: Awaited<ReturnType<typeof scrapeCreators>>["posts"]; errors: string[] }> {
  for (const name of ["APIFY_TOKEN", "ANTHROPIC_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[name]) throw new Error(`${name} is not set`);
  }
  return scrapeCreators();
}

export async function rewriteForImport(text: string) {
  return rewriteRecipe(text);
}
