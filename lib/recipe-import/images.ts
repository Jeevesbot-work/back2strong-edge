import { addImageAttempt } from "./cost";
import type { DraftRecipe } from "./types";

export function imageCreditsExhausted(error: string): boolean {
  return /insufficient_quota|credit_balance|no credits|billing|429/i.test(error);
}

export interface GeneratedImage {
  base64: string;
  mime: string;
}

/**
 * Original food photo. The creator's image is never downloaded or uploaded.
 * Uses OpenAI image generation because the app has no image model of its own
 * (Claude, already used for text, does not return images).
 */
export async function generateRecipeImage(recipe: DraftRecipe): Promise<GeneratedImage | { error: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: "OPENAI_API_KEY is not set, so this draft has no photo yet" };

  const prompt = [
    `Original food photograph of ${recipe.title}, a ${recipe.category}.`,
    "Dark matte plate, natural side light, shallow depth of field, home-kitchen realism.",
    `Show the food only. Reflect these ingredients without labels or packaging: ${recipe.ingredients.slice(0, 6).join(", ")}.`,
    "No text, no watermark, no logo, no people, no hands, no social-media screenshot, no creator watermark.",
  ].join(" ");

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      n: 1,
      output_format: "jpeg",
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 240);
    addImageAttempt(false);
    return { error: `image generation failed (${res.status}): ${detail}` };
  }

  const body = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = body.data?.[0];
  if (first?.b64_json) {
    addImageAttempt(true);
    return { base64: first.b64_json, mime: "image/jpeg" };
  }
  if (first?.url) {
    const image = await fetch(first.url);
    if (!image.ok) return { error: "image host returned no file" };
    const bytes = Buffer.from(await image.arrayBuffer());
    const mime = image.headers.get("content-type") || "image/jpeg";
    addImageAttempt(true);
    return { base64: bytes.toString("base64"), mime };
  }
  addImageAttempt(false);
  return { error: "image generation returned no file" };
}
