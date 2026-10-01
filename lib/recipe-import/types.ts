import type { RecipeCategory } from "@/lib/recipes-live";

export type { RecipeCategory };

export type Platform = "instagram" | "youtube" | "b2s";

/** One scraped post or video. Creator photos are never stored on this type. */
export interface SourcePost {
  platform: Platform;
  /** Stable dedupe key: `ig:<shortCode>` or `yt:<videoId>`. */
  sourceKey: string;
  url: string;
  /** Instagram ownerUsername, or the YouTube channel name. */
  creditHandle: string;
  caption: string;
  transcript?: string | null;
  /** Where a spoken method came from. YouTube subtitles are free; Instagram transcripts are capped. */
  transcriptSource?: "youtube" | "instagram" | null;
  isReel?: boolean;
  titleHint?: string | null;
}

export type Simplicity = "simple" | "ok" | "fiddly";

export interface DraftRecipe {
  title: string;
  category: RecipeCategory;
  description: string;
  servings: number;
  prep_time_mins: number | null;
  cook_time_mins: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** One shopping-list line each, e.g. "500g chicken breast". */
  ingredients: string[];
  method: string[];
  tags: string[];
  coach_note: string | null;
  /** Simple meals are chosen before fiddly ones when the week is full. */
  simplicity: Simplicity;
  /** Niche ingredients are dropped rather than saved as drafts. */
  niche: boolean;
}

export type PostKind = "recipe" | "promo" | "paywall" | "not_a_recipe";

export type FilterDecision = "pass" | "flag" | "reject";

export interface FilterResult {
  decision: FilterDecision;
  reasons: string[];
}
