/**
 * Creators the weekly import scrapes. Edit this list, or set
 * RECIPE_CREATORS_JSON to `{"instagram":["handle"],"youtube":["@handle"]}`
 * in the environment (GitHub Actions or Vercel) to override it without a deploy.
 *
 * Handles only — no personal names, emails, or private accounts.
 */

export interface CreatorLists {
  instagram: string[];
  youtube: string[];
}

export const DEFAULT_CREATORS: CreatorLists = {
  instagram: [
    "jalalsamfit",
    "chlo_fitx",
    "beatthebudget",
    "emthenutritionist",
    "thebodycoach",
    "sohonutrition",
    "justinanderson_fit",
    // Breakfast and snack accounts that put the ingredients and method in the
    // caption. scottbaptie is left off: the last live week was seven posts that
    // all pointed at his paid recipe app.
    "neill_in_vs_out_nutrition",
    "_ryleefoster",
    "strictlythriving",
    "risewithteagan",
  ],
  youtube: ["@jalalsamfit", "@_aussiefitness", "@theremingtonjames"],
};

/** How far back each weekly run looks. Passed through to the Apify actors. */
export const SCRAPE_WINDOW = "8 days";

/** Posts kept per Instagram profile (`resultsLimit` on apify/instagram-scraper). */
export const INSTAGRAM_RESULTS_LIMIT = 8;

/** Regular videos per channel, plus a small Shorts cap so a Shorts-only grid cannot fill the week. */
export const YOUTUBE_MAX_RESULTS = 5;
export const YOUTUBE_MAX_SHORTS = 2;

export function getCreators(): CreatorLists {
  const raw = process.env.RECIPE_CREATORS_JSON;
  if (!raw?.trim()) return DEFAULT_CREATORS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("RECIPE_CREATORS_JSON is not valid JSON");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as CreatorLists).instagram) ||
    !Array.isArray((parsed as CreatorLists).youtube)
  ) {
    throw new Error('RECIPE_CREATORS_JSON must look like {"instagram":["handle"],"youtube":["@handle"]}');
  }
  const lists = parsed as CreatorLists;
  return {
    instagram: lists.instagram.map((h) => String(h).replace(/^@/, "").trim()).filter(Boolean),
    youtube: lists.youtube.map((h) => String(h).trim()).filter(Boolean),
  };
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
