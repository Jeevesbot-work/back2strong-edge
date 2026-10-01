import { contentFingerprint } from "./dedupe";
import type { DraftRecipe, SourcePost } from "./types";

export function sourceCredit(post: SourcePost): string {
  if (post.platform === "instagram") return `Inspired by @${post.creditHandle} on Instagram.`;
  return `Inspired by ${post.creditHandle} on YouTube.`;
}

export function recipeSlug(title: string, sourceKey: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "recipe";
  const suffix = sourceKey.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(-8);
  return suffix ? `${base}-${suffix}` : base;
}

export interface DraftRow {
  title: string;
  slug: string;
  category: DraftRecipe["category"];
  description: string;
  servings: number;
  prep_time_mins: number | null;
  cook_time_mins: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
  method: string[];
  coach_note: string;
  tags: string[];
  image_url: null;
  published: false;
  source_credit: string;
  source_url: string;
  source_platform: SourcePost["platform"];
  source_key: string;
  content_fingerprint: string;
  import_status: "draft" | "flagged";
  review_note: string | null;
  imported_at: string;
}

/** Unpublished insert payload. Nothing in here sets published to true. */
export function toDraftRow(
  recipe: DraftRecipe,
  post: SourcePost,
  review: { status: "draft" | "flagged"; note: string | null },
  importedAt: string = new Date().toISOString(),
): DraftRow {
  const credit = sourceCredit(post);
  const alreadyCredited = recipe.coach_note?.includes(post.creditHandle);
  const coach_note = alreadyCredited ? recipe.coach_note! : [recipe.coach_note, credit].filter(Boolean).join(" ");
  return {
    title: recipe.title,
    slug: recipeSlug(recipe.title, post.sourceKey),
    category: recipe.category,
    description: recipe.description,
    servings: recipe.servings,
    prep_time_mins: recipe.prep_time_mins,
    cook_time_mins: recipe.cook_time_mins,
    calories: recipe.calories,
    protein_g: recipe.protein_g,
    carbs_g: recipe.carbs_g,
    fat_g: recipe.fat_g,
    ingredients: recipe.ingredients,
    method: recipe.method,
    coach_note,
    tags: recipe.tags,
    image_url: null,
    published: false,
    source_credit: credit,
    source_url: post.url,
    source_platform: post.platform,
    source_key: post.sourceKey,
    content_fingerprint: contentFingerprint(recipe.ingredients),
    import_status: review.status,
    review_note: review.note,
    imported_at: importedAt,
  };
}
