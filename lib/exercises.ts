// Exercise library — read from the Supabase `public.exercises` table.
//
// The table (1,500 rows) is world-readable (RLS policy "Exercises are viewable
// by everyone", SELECT to PUBLIC), so the browser client reads it directly the
// same way the Fuel tab reads `public.recipes`. Because the library is large and
// each row carries an animated GIF, the /exercises screen queries server-side
// with `ilike` search, array `overlaps` filters and paginated `range()` rather
// than pulling everything into the client at once.

export interface Exercise {
  exercise_id: string;
  name: string;
  gif_url: string;
  body_parts: string[];
  target_muscles: string[];
  secondary_muscles: string[];
  equipments: string[];
  instructions: string[];
}

// Columns read for the grid + detail view — kept explicit so the query never
// pulls anything the screen doesn't use.
export const EXERCISE_COLUMNS =
  "exercise_id,name,gif_url,body_parts,target_muscles,secondary_muscles,equipments,instructions";

// How many rows per page (infinite-scroll). Small enough to keep the GIF
// payload light on mobile, large enough to fill a couple of scrolls.
export const PAGE_SIZE = 24;

// Facet vocabularies, in the order they should appear as filter chips. Scoped to
// the values that actually occur in the curated in-library set (55 exercises), so
// no chip ever returns an empty result. If the curated set grows to include a new
// body part or equipment type, add it here.
export const BODY_PARTS: string[] = [
  "upper legs",
  "lower legs",
  "back",
  "chest",
  "shoulders",
  "upper arms",
  "waist",
];

export const EQUIPMENTS: string[] = [
  "barbell",
  "dumbbell",
  "cable",
  "leverage machine",
  "kettlebell",
  "trap bar",
  "band",
  "body weight",
];

// Instructions are stored as "Step:1 Lie flat on your back…" — strip the
// "Step:N " prefix so the UI can render its own numbered list.
export function stripStepPrefix(instruction: string): string {
  return instruction.replace(/^\s*Step:\s*\d+\s*/i, "").trim();
}

// Facet values are lowercase in the DB ("upper arms", "ez barbell"). Present
// them capitalised, preserving the acronym-ish "EZ".
export function labelCase(value: string): string {
  return value
    .split(" ")
    .map((w) => (w.toLowerCase() === "ez" ? "EZ" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}
