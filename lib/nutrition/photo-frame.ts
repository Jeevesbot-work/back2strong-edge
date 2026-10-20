// Flat black or flat white frames are what a failed iOS canvas draw turns into
// once they are saved as JPEG. Thresholds are tight on purpose: a real photo of
// black coffee or a creatine tub still has edges and a label, so its contrast
// stays above BLANK_SD_MAX even when the scene is dark.

export const BLANK_DARK_MEAN_MAX = 8;
export const BLANK_LIGHT_MEAN_MIN = 250;
export const BLANK_SD_MAX = 4;

export const BLANK_PHOTO_MESSAGE =
  "That photo came through black. Try again, or use barcode or Describe.";

export const NO_FOOD_MESSAGE =
  "Couldn't see any food in that photo. Try again in better light.";

export class BlankPhotoError extends Error {
  constructor() {
    super("BLANK_PHOTO");
    this.name = "BlankPhotoError";
  }
}

/** Meal names that admit the picture could not be read, including made-up calorie guesses. */
const UNREADABLE_NAME_RE =
  /\b(?:unidentif\w*|unable to identify|can(?:not|'|’)t identify|can(?:not|'|’)t make out|(?:blank|black|dark|unreadable) (?:image|photo|picture)|image (?:is |appears )?(?:blank|black|too dark|unreadable|not visible)|no food (?:visible|detected|present|in))\b/i;

/**
 * Coach comments for a real zero-calorie log ("I can't see this adding protein")
 * must not match. Only phrases that mean the picture itself was unreadable.
 */
const UNREADABLE_COMMENT_RE =
  /\b(?:unidentif\w*|unable to identify|no food (?:visible|detected|present)|(?:image|photo|picture) (?:is |appears )?(?:blank|black|too dark|unreadable|not visible)|too dark to (?:see|identify|make out)|can(?:not|'|’)t (?:identify|make out) (?:any )?(?:food|the food|anything))\b/i;

export function isBlankFrame(mean: number, sd: number): boolean {
  if (!Number.isFinite(mean) || !Number.isFinite(sd)) return true;
  return sd < BLANK_SD_MAX && (mean < BLANK_DARK_MEAN_MAX || mean > BLANK_LIGHT_MEAN_MIN);
}

export function luminanceStats(
  data: ArrayLike<number>,
  channels: 1 | 3 | 4,
): { mean: number; sd: number } {
  const n = Math.floor(data.length / channels);
  if (n <= 0) return { mean: 0, sd: 0 };
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const offset = i * channels;
    const y = channels === 1
      ? data[offset]
      : 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
    sum += y;
    sq += y * y;
  }
  const mean = sum / n;
  const variance = sq / n - mean * mean;
  return { mean, sd: Math.sqrt(variance > 0 ? variance : 0) };
}

export function isTransparentFrame(data: ArrayLike<number>): boolean {
  const n = Math.floor(data.length / 4);
  if (n <= 0) return true;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += data[i * 4 + 3];
  return sum / n < 8;
}

export function frameLooksBlank(data: ArrayLike<number>, channels: 1 | 3 | 4): boolean {
  if (channels === 4 && isTransparentFrame(data)) return true;
  const { mean, sd } = luminanceStats(data, channels);
  return isBlankFrame(mean, sd);
}

export function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(body.slice(start, end + 1));
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mealName(analysis: object): string {
  const name = (analysis as { meal_name?: unknown }).meal_name;
  return typeof name === "string" ? name.trim() : "";
}

/**
 * True only when the model says the picture has no food, or the name/comment
 * admits it could not see anything. A named 0 kcal item (creatine, black
 * coffee) returns false and can be saved.
 */
export function isUnreadablePhoto(analysis: unknown): boolean {
  if (!analysis || typeof analysis !== "object") return false;
  const record = analysis as { no_food?: unknown; calories?: unknown; edge_comment?: unknown };
  if (record.no_food === true || record.no_food === "true") return true;

  const name = mealName(analysis);
  if (name && UNREADABLE_NAME_RE.test(name)) return true;

  const calories = asNumber(record.calories);
  const comment = typeof record.edge_comment === "string" ? record.edge_comment : "";
  if (name && !(calories !== null && calories > 0) && UNREADABLE_COMMENT_RE.test(comment)) return true;
  return false;
}

export interface ParsedMeal {
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  edge_comment: string;
}

/** A savable meal, including legitimate 0 kcal entries. Null when fields are missing. */
export function mealFromAnalysis(analysis: unknown): ParsedMeal | null {
  if (!analysis || typeof analysis !== "object") return null;
  const record = analysis as Record<string, unknown>;
  const name = mealName(analysis);
  const calories = asNumber(record.calories);
  const protein_g = asNumber(record.protein_g);
  const carbs_g = asNumber(record.carbs_g);
  const fat_g = asNumber(record.fat_g);
  if (!name || calories === null || protein_g === null || carbs_g === null || fat_g === null) return null;
  return {
    meal_name: name,
    calories: Math.round(calories),
    protein_g,
    carbs_g,
    fat_g,
    edge_comment: typeof record.edge_comment === "string" ? record.edge_comment : "",
  };
}
