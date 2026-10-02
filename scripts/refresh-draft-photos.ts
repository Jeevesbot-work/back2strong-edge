/**
 * Replace photos on the current unpublished import drafts.
 * Does not scrape, rewrite, or insert recipes.
 */
import { importCost, resetImportCost } from "../lib/recipe-import/cost";
import { generateRecipeImage, imageCreditsExhausted } from "../lib/recipe-import/images";
import type { DraftRecipe, RecipeCategory } from "../lib/recipe-import/types";
import { saveRecipeImage } from "../lib/recipes/save-image";
import { createServiceClient } from "../lib/supabase/service";

const CATEGORIES: RecipeCategory[] = ["breakfast", "lunch", "dinner", "snack"];
const EXPECTED = 17;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function main() {
  resetImportCost();
  const admin = createServiceClient();
  const { count: publishedBefore, error: publishedError } = await admin
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("published", true);
  if (publishedError) fail(publishedError.message);

  const { data, error } = await admin
    .from("recipes")
    .select("id, title, category, description, servings, prep_time_mins, cook_time_mins, calories, protein_g, carbs_g, fat_g, ingredients, method, tags, image_url, published, import_status")
    .eq("published", false)
    .in("import_status", ["draft", "flagged"])
    .order("category");
  if (error) fail(error.message);
  const rows = data ?? [];
  if (rows.length !== EXPECTED) {
    fail(`Expected ${EXPECTED} unpublished drafts, found ${rows.length}. No photos were replaced.`);
  }
  if (rows.some((row) => row.published !== false)) fail("A published recipe was included. No photos were replaced.");

  let replaced = 0;
  for (const row of rows) {
    const category = String(row.category ?? "");
    if (!CATEGORIES.includes(category as RecipeCategory)) fail(`Unexpected category on ${row.id}. Stopped.`);
    const recipe: DraftRecipe = {
      title: String(row.title ?? ""),
      category: category as RecipeCategory,
      description: String(row.description ?? row.title ?? ""),
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
    const generated = await generateRecipeImage(recipe);
    if ("error" in generated) {
      if (imageCreditsExhausted(generated.error)) fail(generated.error);
      console.log(`FAILED ${row.id} ${row.title}: ${generated.error}`);
      continue;
    }
    const saved = await saveRecipeImage(String(row.id), generated.base64, generated.mime);
    if (!saved.ok) {
      console.log(`FAILED ${row.id} ${row.title}: ${saved.error}`);
      continue;
    }
    replaced += 1;
    console.log(`Replaced ${row.category} ${row.import_status} ${row.title}`);
  }

  const { count: publishedAfter, error: afterError } = await admin
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("published", true);
  if (afterError) fail(afterError.message);
  if (publishedBefore !== publishedAfter) fail(`Published count changed from ${publishedBefore} to ${publishedAfter}`);

  const cost = importCost();
  console.log(`Replaced ${replaced} of ${rows.length} draft photos. Published recipes unchanged at ${publishedAfter}.`);
  console.log(
    `Image cost: about $${cost.imageUsd.toFixed(2)} (${cost.imagesGenerated} generated at medium quality, ${cost.imagesFailed} failed).`,
  );
  if (replaced !== EXPECTED) fail(`Only ${replaced} photos were replaced.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
