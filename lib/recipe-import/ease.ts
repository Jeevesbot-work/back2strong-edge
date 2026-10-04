import type { DraftRecipe, Simplicity } from "./types";

const UK_NAMES: Array<[RegExp, string]> = [
  [/\bzucchini\b/gi, "courgette"],
  [/\bcilantro\b/gi, "coriander"],
  [/\beggplant\b/gi, "aubergine"],
  [/\barugula\b/gi, "rocket"],
  [/\bscallions?\b/gi, "spring onion"],
  [/\bgreen onions?\b/gi, "spring onion"],
  [/\bground turkey\b/gi, "turkey mince"],
  [/\bground beef\b/gi, "beef mince"],
  [/\bheavy cream\b/gi, "double cream"],
  [/\ball-purpose flour\b/gi, "plain flour"],
  [/\bbell peppers?\b/gi, "pepper"],
  [/\byogurt\b/gi, "yoghurt"],
];

const NICHE =
  /\b(saffron|truffle|yuzu|gochujang|nduja|n['’]duja|kala namak)\b/i;

export function toUk(text: string): string {
  let next = text;
  for (const [pattern, name] of UK_NAMES) next = next.replace(pattern, name);
  return next;
}

/** UK names, and oven temperatures written as fan centigrade. */
export function styleMethodStep(step: string): string {
  let line = toUk(step);
  line = line.replace(/(\d+(?:\.\d+)?)\s*(?:degrees?)?\s*°?\s*C\b(?!\s*fan)/gi, "$1°C fan");
  line = line.replace(/(\d+(?:\.\d+)?)\s*°?\s*F\b/gi, (_match, raw: string) => {
    const fan = Math.round((((Number(raw) - 32) * 5) / 9 - 20) / 5) * 5;
    return `${fan}°C fan`;
  });
  return line.replace(/\s+/g, " ").trim();
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const clean = tag.trim().toLowerCase();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

/**
 * Prefer ordinary weeknight food: about 10 ingredients, half an hour, or a
 * marked batch cook. Fiddly recipes stay in the pool but lose to simpler ones.
 */
export function finishDraft(
  recipe: DraftRecipe,
  hints?: { batch?: boolean; family?: boolean; simplicity?: Simplicity; niche?: boolean },
): DraftRecipe {
  const title = toUk(recipe.title);
  const description = toUk(recipe.description);
  const ingredients = recipe.ingredients.map(toUk);
  const method = recipe.method.map(styleMethodStep);
  const minutes = (recipe.prep_time_mins ?? 0) + (recipe.cook_time_mins ?? 0);
  const blob = [title, description, ...ingredients, ...method].join(" ");
  const niche = recipe.niche || !!hints?.niche || NICHE.test(blob);

  const tags = uniqueTags(recipe.tags);
  const batch =
    !!hints?.batch ||
    tags.includes("batch-cook") ||
    /\b(batch cook|meal prep|meal-prep)\b/i.test(blob);
  if (batch && !tags.includes("batch-cook")) tags.push("batch-cook");
  if ((hints?.family || recipe.servings >= 4) && !tags.includes("family")) tags.push("family");
  if (minutes > 0 && minutes <= 30 && !tags.includes("quick")) tags.push("quick");

  let simplicity: Simplicity = hints?.simplicity ?? recipe.simplicity ?? "ok";
  if (simplicity === "fiddly" || (ingredients.length > 12 && !batch) || (minutes > 45 && !batch)) {
    simplicity = "fiddly";
  } else if (ingredients.length <= 10 && (minutes === 0 || minutes <= 30 || batch)) {
    simplicity = "simple";
  } else if (simplicity !== "simple") {
    simplicity = "ok";
  }

  return {
    ...recipe,
    title,
    description,
    ingredients,
    method,
    tags: uniqueTags(tags),
    niche,
    simplicity,
  };
}
