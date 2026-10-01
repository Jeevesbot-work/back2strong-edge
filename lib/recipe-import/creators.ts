/**
 * Creators the weekly import scrapes. Edit this list, or set
 * RECIPE_CREATORS_JSON to override it without a deploy.
 *
 * A string list still works: `{"instagram":["handle"],"youtube":["@handle"]}`.
 * Weights are optional: `{"instagram":[{"handle":"neill_in_vs_out_nutrition","weight":3}]}`.
 * Weight 0 skips a creator. Higher weights scrape more posts and win ties.
 *
 * Handles only — no personal names, emails, or private accounts.
 * Creator websites, BBC Good Food, Edamam, and Spoonacular are not sources.
 */

export interface WeightedHandle {
  handle: string;
  /** 0 skips the creator. 3 is the top of the list. */
  weight: number;
}

export interface CreatorLists {
  instagram: WeightedHandle[];
  youtube: WeightedHandle[];
}

/**
 * Weights from the last live weeks and the 1 Oct sourcing check.
 * Full captions: ingredients, quantities, and macros in the post itself.
 * Jalal was 3 of 3. chlo_fitx was 0 of 3. Neill's captions are full recipes.
 * thebodycoach and sohonutrition rarely post a recipe. risewithteagan and
 * strictlythriving point at a comment code or a paid app.
 */
export const DEFAULT_CREATORS: CreatorLists = {
  instagram: [
    { handle: "neill_in_vs_out_nutrition", weight: 3 },
    { handle: "jalalsamfit", weight: 3 },
    { handle: "beatthebudget", weight: 2 },
    { handle: "chlo_fitx", weight: 1 },
    { handle: "emthenutritionist", weight: 1 },
    { handle: "justinanderson_fit", weight: 1 },
    { handle: "_ryleefoster", weight: 1 },
    { handle: "thebodycoach", weight: 0 },
    { handle: "sohonutrition", weight: 0 },
    { handle: "risewithteagan", weight: 0 },
    { handle: "strictlythriving", weight: 0 },
  ],
  youtube: [
    { handle: "jalalsamfit", weight: 2 },
    { handle: "_aussiefitness", weight: 1 },
    { handle: "theremingtonjames", weight: 1 },
  ],
};

/** How far back each weekly run looks. Passed through to the Apify actors. */
export const SCRAPE_WINDOW = "8 days";

/** Posts kept per Instagram profile when a creator has no weight. */
export const INSTAGRAM_RESULTS_LIMIT = 4;

/** Regular videos per channel, plus a small Shorts cap so a Shorts-only grid cannot fill the week. */
export const YOUTUBE_MAX_RESULTS = 4;
export const YOUTUBE_MAX_SHORTS = 1;

/** Higher-weight creators are scraped more often. Weight 0 is not scraped. */
export function postsPerCreator(weight: number): number {
  if (weight >= 3) return 6;
  if (weight >= 2) return 4;
  if (weight >= 1) return 2;
  return 0;
}

export function activeCreators(lists: CreatorLists = DEFAULT_CREATORS): CreatorLists {
  return {
    instagram: lists.instagram.filter((creator) => creator.weight > 0 && postsPerCreator(creator.weight) > 0),
    youtube: lists.youtube.filter((creator) => creator.weight > 0),
  };
}

function asHandles(value: unknown): WeightedHandle[] {
  if (!Array.isArray(value)) return [];
  const out: WeightedHandle[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      out.push({ handle: item.replace(/^@/, "").trim(), weight: 1 });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as { handle?: unknown; weight?: unknown };
    if (typeof record.handle !== "string" || !record.handle.trim()) continue;
    const weight = typeof record.weight === "number" && Number.isFinite(record.weight) ? record.weight : 1;
    out.push({ handle: record.handle.replace(/^@/, "").trim(), weight });
  }
  return out.filter((creator) => creator.handle);
}

export function getCreators(): CreatorLists {
  const raw = process.env.RECIPE_CREATORS_JSON;
  if (!raw?.trim()) return DEFAULT_CREATORS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("RECIPE_CREATORS_JSON is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error('RECIPE_CREATORS_JSON must look like {"instagram":["handle"],"youtube":["@handle"]}');
  }
  const record = parsed as { instagram?: unknown; youtube?: unknown };
  if (!Array.isArray(record.instagram) || !Array.isArray(record.youtube)) {
    throw new Error('RECIPE_CREATORS_JSON must look like {"instagram":["handle"],"youtube":["@handle"]}');
  }
  return { instagram: asHandles(record.instagram), youtube: asHandles(record.youtube) };
}

/** Shared key so an Instagram handle and a YouTube channel name can match. */
export function creatorFamily(handle: string): string {
  const clean = handle.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9]+/g, "");
  if (clean.includes("jalal")) return "jalal";
  if (clean.includes("aussie")) return "aussie";
  if (clean.includes("remington")) return "remington";
  if (clean.includes("neill") || clean.includes("invsout")) return "neill";
  if (clean.includes("beatthebudget")) return "beatthebudget";
  if (clean.includes("chlofit")) return "chlofit";
  return clean;
}

export function weightForHandle(handle: string, platform: "instagram" | "youtube" | "b2s", lists: CreatorLists = getCreators()): number {
  if (platform === "b2s") return 2;
  const family = creatorFamily(handle);
  const first = platform === "youtube" ? lists.youtube : lists.instagram;
  const second = platform === "youtube" ? lists.instagram : lists.youtube;
  for (const creator of [...first, ...second]) {
    if (creatorFamily(creator.handle) === family) return creator.weight;
  }
  return 1;
}

export function instagramProfileUrl(handle: string): string {
  const clean = handle.replace(/^@/, "").replace(/\/+$/, "");
  return `https://www.instagram.com/${clean}/`;
}

export function youtubeChannelUrl(handle: string): string {
  const clean = handle.replace(/\/+$/, "");
  const withAt = clean.startsWith("@") ? clean : `@${clean}`;
  return `https://www.youtube.com/${withAt}/videos`;
}
