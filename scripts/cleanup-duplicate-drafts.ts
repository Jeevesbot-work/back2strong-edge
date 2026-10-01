/**
 * One-off cleanup for the accidental second import on 1 Oct 2026.
 * Deletes only the 10 unpublished drafts from run 36922908807, plus their
 * stored photos. Does not publish, and does not touch any other recipe.
 */
import { generateRecipeImage, imageCreditsExhausted } from "../lib/recipe-import/images";
import type { DraftRecipe, RecipeCategory } from "../lib/recipe-import/types";
import { saveRecipeImage } from "../lib/recipes/save-image";
import { createServiceClient } from "../lib/supabase/service";

const DELETE_DRAFTS: Array<{ id: string; sourceKey: string }> = [
  { id: "55756673-ed2c-4bca-a792-d781d47b12dd", sourceKey: "b2s:breakfast-0-20261001-8x00" },
  { id: "7da9f8a9-0a4a-4ff9-a6cf-5377fa2983d9", sourceKey: "b2s:breakfast-1-20261001-ed5w" },
  { id: "b1dd3bf5-6c66-4843-b0f7-b10c4d4a63c4", sourceKey: "b2s:snack-2-20261001-tco6" },
  { id: "0a552a63-49ce-47b7-a393-13fb899e8d2e", sourceKey: "b2s:snack-3-20261001-94pa" },
  { id: "88fe0c13-a5dc-45ac-8df2-c1edf02d9a40", sourceKey: "b2s:lunch-4-20261001-chzg" },
  { id: "d9ccb092-a165-4b67-9872-3c2ea4969dbf", sourceKey: "b2s:dinner-5-20261001-tua7" },
  { id: "7e955cd9-6a75-40eb-9ea7-f921ab1a9729", sourceKey: "b2s:lunch-6-20261001-g9yq" },
  { id: "7b587afb-6214-4779-ac8c-49a06eba13a8", sourceKey: "b2s:dinner-7-20261001-a8vm" },
  { id: "1c25f552-33d8-475a-8256-123002b59af7", sourceKey: "b2s:lunch-8-20261001-by10" },
  { id: "07a06bf7-1866-4abc-828c-375164f7f526", sourceKey: "b2s:dinner-9-20261001-dl2z" },
];

const KEEP_IDS = [
  "378bbe16-4bd5-43e9-9228-6b7fafc89e04",
  "3a026d92-4c3e-46af-ae30-674bdf4082ae",
  "748191f8-de73-4eca-986d-f3a2fff6e543",
  "565a43a1-b707-4c4d-96d3-39e3fdfd4fbb",
  "736489dc-165b-4e00-ac54-c87717ba0da3",
  "ba4f6d5b-9283-43c4-b325-0c3f2eb1751b",
  "087974f2-383c-4085-8372-cd387eecf11a",
  "6adf86fa-f585-4c03-9700-b6abfbf3f3fa",
  "54535af4-6441-4c8d-b3b1-164504b1995f",
  "6e24f594-1fce-4c95-be07-c47747e8f09e",
];

const CREATOR_KEYS = ["ig:Ddy_sGEqtNU", "ig:Dd1V-CWI0Vb", "yt:BwODLfT2pto", "yt:UTxh16lShkE"];

const CATEGORIES: RecipeCategory[] = ["breakfast", "lunch", "dinner", "snack"];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const admin = createServiceClient();
  const deleteIds = DELETE_DRAFTS.map((row) => row.id);
  const deleteKeys = DELETE_DRAFTS.map((row) => row.sourceKey);
  if (new Set(deleteIds).size !== 10 || new Set(deleteKeys).size !== 10) fail("Delete list is not 10 unique drafts");
  if (deleteIds.some((id) => KEEP_IDS.includes(id))) fail("Refusing to delete a draft from the kept run");

  const { count: publishedBefore, error: publishedError } = await admin
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("published", true);
  if (publishedError) fail(publishedError.message);

  const { data: targets, error: targetError } = await admin
    .from("recipes")
    .select("id, title, source_key, published, import_status, image_url")
    .in("id", deleteIds);
  if (targetError) fail(targetError.message);
  if ((targets ?? []).length !== 10) {
    fail(`Expected 10 accidental drafts, found ${(targets ?? []).length}. Nothing was deleted.`);
  }
  for (const expected of DELETE_DRAFTS) {
    const row = (targets ?? []).find((item) => item.id === expected.id);
    if (!row) fail(`Missing ${expected.sourceKey}. Nothing was deleted.`);
    if (row.published !== false) fail(`${expected.sourceKey} is published. Nothing was deleted.`);
    if (row.source_key !== expected.sourceKey) fail(`${expected.id} source_key is ${row.source_key}, not ${expected.sourceKey}. Nothing was deleted.`);
    if (row.import_status !== "draft" && row.import_status !== "flagged") {
      fail(`${expected.sourceKey} import_status is ${row.import_status}. Nothing was deleted.`);
    }
  }

  const paths = deleteIds.flatMap((id) => [`${id}.jpg`, `${id}.png`, `${id}.webp`]);
  const { error: storageError } = await admin.storage.from("recipe-images").remove(paths);
  if (storageError) fail(`Image delete failed, rows left in place: ${storageError.message}`);
  console.log(`Removed stored images for ${deleteIds.length} accidental drafts.`);

  const { data: deleted, error: deleteError } = await admin
    .from("recipes")
    .delete()
    .in("id", deleteIds)
    .in("source_key", deleteKeys)
    .eq("published", false)
    .in("import_status", ["draft", "flagged"])
    .select("id, source_key, title");
  if (deleteError) fail(deleteError.message);
  if ((deleted ?? []).length !== 10) {
    fail(`Delete returned ${(deleted ?? []).length} rows, expected 10.`);
  }
  console.log("Deleted unpublished drafts:");
  for (const row of deleted ?? []) console.log(`- ${row.source_key} ${row.title}`);

  const { count: publishedAfter, error: publishedAfterError } = await admin
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("published", true);
  if (publishedAfterError) fail(publishedAfterError.message);
  if (publishedBefore !== publishedAfter) fail(`Published count changed from ${publishedBefore} to ${publishedAfter}`);

  const { data: kept, error: keptError } = await admin.from("recipes").select("id, published").in("id", KEEP_IDS);
  if (keptError) fail(keptError.message);
  if ((kept ?? []).length !== 10 || (kept ?? []).some((row) => row.published !== false)) {
    fail("The 10 drafts from the kept run are no longer all present and unpublished.");
  }

  const { data: creators, error: creatorError } = await admin
    .from("recipes")
    .select("id, title, category, description, servings, prep_time_mins, cook_time_mins, calories, protein_g, carbs_g, fat_g, ingredients, method, tags, image_url, published, import_status, source_key")
    .in("source_key", CREATOR_KEYS)
    .eq("published", false);
  if (creatorError) fail(creatorError.message);

  let photosAdded = 0;
  for (const row of creators ?? []) {
    if (row.import_status !== "draft" && row.import_status !== "flagged") {
      console.log(`Skipped photo for ${row.source_key}: import_status ${row.import_status}`);
      continue;
    }
    if (row.image_url) {
      console.log(`Photo already set for ${row.source_key}`);
      continue;
    }
    const category = String(row.category ?? "");
    if (!CATEGORIES.includes(category as RecipeCategory)) {
      console.log(`Skipped photo for ${row.source_key}: category ${category}`);
      continue;
    }
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
      ingredients: Array.isArray(row.ingredients) ? row.ingredients.filter((item): item is string => typeof item === "string") : [],
      method: Array.isArray(row.method) ? row.method.filter((item): item is string => typeof item === "string") : [],
      tags: Array.isArray(row.tags) ? row.tags.filter((item): item is string => typeof item === "string") : [],
      coach_note: null,
      simplicity: "ok",
      niche: false,
    };
    const generated = await generateRecipeImage(recipe);
    if ("error" in generated) {
      if (imageCreditsExhausted(generated.error)) fail(generated.error);
      console.log(`Photo failed for ${row.source_key}: ${generated.error}`);
      continue;
    }
    const saved = await saveRecipeImage(String(row.id), generated.base64, generated.mime);
    if (!saved.ok) {
      console.log(`Photo upload failed for ${row.source_key}: ${saved.error}`);
      continue;
    }
    photosAdded += 1;
    console.log(`Photo added for ${row.source_key}`);
  }

  const { data: pending, error: pendingError } = await admin
    .from("recipes")
    .select("id, title, category, import_status, source_key, image_url, published")
    .eq("published", false)
    .or("import_status.is.null,import_status.eq.draft,import_status.eq.flagged")
    .order("category");
  if (pendingError) fail(pendingError.message);

  const counts = new Map<string, number>();
  console.log("Pending screen:");
  for (const row of pending ?? []) {
    const key = `${row.category}|${row.import_status ?? "none"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    console.log(`- ${row.category} ${row.import_status ?? "no-status"} ${row.source_key ?? "no-source"} photo=${row.image_url ? "yes" : "no"} ${row.title}`);
  }
  console.log("Counts:");
  counts.forEach((count, key) => console.log(`${key} ${count}`));
  console.log(`Photos added to creator drafts: ${photosAdded}`);
  console.log(`Published recipes unchanged at ${publishedAfter}.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
