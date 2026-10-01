import { scrapeCreators } from "./apify";
import { toDraftRow } from "./draft";
import { evaluatePosts, type EvaluatedPost } from "./evaluate";
import { generateRecipeImage } from "./images";
import type { LibraryEntry } from "./dedupe";
import { rewriteRecipe } from "./rewrite";
import { saveRecipeImage } from "@/lib/recipes/save-image";
import { createServiceClient } from "@/lib/supabase/service";

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
    const generated = await generateRecipeImage(row.recipe);
    if ("error" in generated) {
      image = generated.error;
      errors.push(`${row.post.sourceKey} saved without a photo: ${generated.error}`);
    } else {
      const saved = await saveRecipeImage(id, generated.base64, generated.mime);
      image = saved.ok ? saved.url : saved.error;
      if (!saved.ok) errors.push(`${row.post.sourceKey} saved without a photo: ${saved.error}`);
    }
    inserted.push({ sourceKey: row.post.sourceKey, id, image });
  }

  return { inserted, errors };
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
