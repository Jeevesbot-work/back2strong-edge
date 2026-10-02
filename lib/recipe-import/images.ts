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
 * Phone photo of a home-cooked meal. The creator's image is never downloaded.
 * gpt-image-1 at medium quality: about the same price as the previous $0.04 estimate, and below high quality.
 */
export function recipeImagePrompt(recipe: Pick<DraftRecipe, "title" | "category" | "ingredients">): string {
  const foods = recipe.ingredients.slice(0, 6).join(", ");
  return [
    `Casual phone photo of a home-cooked ${recipe.category}: ${recipe.title}.`,
    "Ordinary UK family kitchen or dining table. Everyday plate, bowl, or a family-sized dish, not a restaurant plate.",
    "Natural window light, a realistic portion, slightly imperfect plating. A little messy, still appetising.",
    "No dark moody backdrop, no restaurant styling, no garnish theatre, no perfect symmetry, no glossy food-magazine look.",
    foods ? `Show the cooked food, without labels or packaging: ${foods}.` : "Show the cooked food, without labels or packaging.",
    "No text, no watermark, no logo, no people, no hands.",
  ].join(" ");
}

export async function generateRecipeImage(recipe: DraftRecipe): Promise<GeneratedImage | { error: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: "OPENAI_API_KEY is not set, so this draft has no photo yet" };

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: recipeImagePrompt(recipe),
      size: "1024x1024",
      quality: "medium",
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
