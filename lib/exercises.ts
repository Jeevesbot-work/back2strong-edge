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

// Facet vocabularies, in the order they should appear as filter chips. These
// mirror the distinct values present in the table today; if new values are ever
// added they simply won't have a chip until this list is updated (the data still
// loads fine — it just isn't filterable by the new value).
export const BODY_PARTS: string[] = [
  "back",
  "chest",
  "shoulders",
  "upper arms",
  "lower arms",
  "upper legs",
  "lower legs",
  "waist",
  "neck",
  "cardio",
];

export const EQUIPMENTS: string[] = [
  "body weight",
  "dumbbell",
  "barbell",
  "cable",
  "kettlebell",
  "leverage machine",
  "smith machine",
  "resistance band",
  "band",
  "ez barbell",
  "olympic barbell",
  "trap bar",
  "medicine ball",
  "stability ball",
  "bosu ball",
  "roller",
  "wheel roller",
  "rope",
  "sled machine",
  "hammer",
  "tire",
  "weighted",
  "assisted",
  "stationary bike",
  "elliptical machine",
  "stepmill machine",
  "skierg machine",
  "upper body ergometer",
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
