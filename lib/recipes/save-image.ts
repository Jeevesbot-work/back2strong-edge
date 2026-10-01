import { createServiceClient } from "@/lib/supabase/service";

const BUCKET = "recipe-images";

export type SaveImageResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

/**
 * Upload a generated photo and set recipes.image_url.
 * Shared by POST /api/admin/recipe-images and the weekly import, so both
 * paths write the same bucket and the same cache-busted public URL.
 * The bytes must be an image we generated — never a creator's photo.
 */
export async function saveRecipeImage(
  recipeId: string,
  imageBase64: string,
  mimeType: string = "image/jpeg",
): Promise<SaveImageResult> {
  const admin = createServiceClient();
  const { data: recipe, error: recipeErr } = await admin
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .maybeSingle();
  if (recipeErr) return { ok: false, status: 500, error: recipeErr.message };
  if (!recipe) return { ok: false, status: 404, error: "Recipe not found" };

  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const path = `${recipeId}.${ext}`;
  const bytes = Buffer.from(imageBase64, "base64");

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: true });
  if (uploadErr) return { ok: false, status: 500, error: `Upload failed: ${uploadErr.message}` };

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  const { error: updateErr } = await admin.from("recipes").update({ image_url: url }).eq("id", recipeId);
  if (updateErr) return { ok: false, status: 500, error: `DB update failed: ${updateErr.message}` };
  return { ok: true, url };
}
