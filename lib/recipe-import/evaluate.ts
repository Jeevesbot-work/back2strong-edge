import { classifyPost, worthRewriting } from "./classify";
import { weightForHandle } from "./creators";
import { findDuplicate, type LibraryEntry } from "./dedupe";
import { isLeanSwapCandidate } from "./lean-swap";
import { statedMacroMismatch } from "./nutrition";
import { selectWeekly } from "./select";
import type { DraftRecipe, FilterResult, PostKind, SourcePost } from "./types";
import { filterRecipe } from "./thresholds";

export type Outcome =
  | "dropped_promo"
  | "dropped_paywall"
  | "dropped_not_a_recipe"
  | "dropped_niche"
  | "extract_failed"
  | "rejected_filter"
  | "duplicate"
  | "over_cap"
  | "draft"
  | "flagged_draft";

export interface EvaluatedPost {
  post: SourcePost;
  classification: PostKind | "extract_failed";
  recipe: DraftRecipe | null;
  filter: FilterResult | null;
  duplicateOf: string | null;
  duplicateReason: string | null;
  selected: boolean;
  outcome: Outcome;
  note: string | null;
}

export type ExtractResult =
  | { ok: true; recipe: DraftRecipe }
  | { ok: false; kind?: PostKind; error: string };

export interface EvaluateOptions {
  /** When false, stop at the category quotas so originals can fill breakfast, snack, and any gap. */
  pad?: boolean;
  leanSwap?: (recipe: DraftRecipe) => Promise<DraftRecipe | null>;
  /** Compare stated macros with the USDA table and flag a large gap. */
  checkMacros?: boolean;
}

export function postText(post: SourcePost): string {
  return [post.caption?.trim(), post.transcript?.trim()].filter(Boolean).join("\n\n");
}

export async function evaluatePosts(
  posts: SourcePost[],
  library: LibraryEntry[],
  extract: (post: SourcePost, text: string) => Promise<ExtractResult>,
  options?: EvaluateOptions,
): Promise<EvaluatedPost[]> {
  const seen: LibraryEntry[] = library.map((entry) => ({
    ...entry,
    ingredients: [...entry.ingredients],
  }));
  const evaluated: EvaluatedPost[] = [];
  const candidates: EvaluatedPost[] = [];

  for (const post of posts) {
    const text = postText(post);
    const kind = classifyPost(text);
    // Spoken reels often fail the caption pattern. A long cooking transcript
    // still goes to the rewriter. Promos and paywalls without one are dropped.
    if (kind !== "recipe" && !worthRewriting(text, post.transcript)) {
      const outcome: Outcome =
        kind === "promo" ? "dropped_promo" : kind === "paywall" ? "dropped_paywall" : "dropped_not_a_recipe";
      evaluated.push({
        post,
        classification: kind,
        recipe: null,
        filter: null,
        duplicateOf: null,
        duplicateReason: null,
        selected: false,
        outcome,
        note: null,
      });
      continue;
    }

    const extracted = await extract(post, text);
    if (!extracted.ok) {
      if (extracted.kind && extracted.kind !== "recipe") {
        const outcome: Outcome =
          extracted.kind === "promo"
            ? "dropped_promo"
            : extracted.kind === "paywall"
              ? "dropped_paywall"
              : "dropped_not_a_recipe";
        evaluated.push({
          post,
          classification: extracted.kind,
          recipe: null,
          filter: null,
          duplicateOf: null,
          duplicateReason: null,
          selected: false,
          outcome,
          note: extracted.error,
        });
        continue;
      }
      evaluated.push({
        post,
        classification: "extract_failed",
        recipe: null,
        filter: null,
        duplicateOf: null,
        duplicateReason: null,
        selected: false,
        outcome: "extract_failed",
        note: extracted.error,
      });
      continue;
    }

    let recipe = extracted.recipe;
    if (recipe.niche) {
      evaluated.push({
        post,
        classification: "recipe",
        recipe,
        filter: null,
        duplicateOf: null,
        duplicateReason: null,
        selected: false,
        outcome: "dropped_niche",
        note: "niche ingredients",
      });
      continue;
    }

    let filter = filterRecipe({
      category: recipe.category,
      calories: recipe.calories,
      protein_g: recipe.protein_g,
      carbs_g: recipe.carbs_g,
      fat_g: recipe.fat_g,
    });
    if (filter.decision === "reject") {
      evaluated.push({
        post,
        classification: "recipe",
        recipe,
        filter,
        duplicateOf: null,
        duplicateReason: null,
        selected: false,
        outcome: "rejected_filter",
        note: filter.reasons.join("; "),
      });
      continue;
    }

    let swapped = false;
    if (filter.decision === "flag" && options?.leanSwap && isLeanSwapCandidate(recipe)) {
      const next = await options.leanSwap(recipe);
      if (next) {
        const again = filterRecipe({
          category: next.category,
          calories: next.calories,
          protein_g: next.protein_g,
          carbs_g: next.carbs_g,
          fat_g: next.fat_g,
        });
        if (again.decision === "pass") {
          recipe = next;
          filter = again;
          swapped = true;
        }
      }
    }

    if (!swapped && options?.checkMacros) {
      const mismatch = statedMacroMismatch(recipe);
      if (mismatch) {
        filter = {
          decision: "flag",
          reasons: filter.decision === "flag" ? [...filter.reasons, mismatch] : [mismatch],
        };
      }
    }

    const duplicate = findDuplicate(
      { title: recipe.title, ingredients: recipe.ingredients, sourceKey: post.sourceKey },
      seen,
    );
    if (duplicate) {
      evaluated.push({
        post,
        classification: "recipe",
        recipe,
        filter,
        duplicateOf: duplicate.title,
        duplicateReason: duplicate.reason,
        selected: false,
        outcome: "duplicate",
        note: duplicate.reason,
      });
      continue;
    }

    const row: EvaluatedPost = {
      post,
      classification: "recipe",
      recipe,
      filter,
      duplicateOf: null,
      duplicateReason: null,
      selected: false,
      outcome: filter.decision === "flag" ? "flagged_draft" : "draft",
      note: swapped ? recipe.coach_note : filter.reasons.join("; "),
    };
    evaluated.push(row);
    candidates.push(row);
    seen.push({
      title: recipe.title,
      ingredients: recipe.ingredients,
      sourceKey: post.sourceKey,
    });
  }

  const { picked, overflow } = selectWeekly(
    candidates.map((row) => ({
      row,
      category: row.recipe!.category,
      decision: row.filter!.decision as "pass" | "flag",
      protein_g: row.recipe!.protein_g,
      simplicity: row.recipe!.simplicity,
      weight: weightForHandle(row.post.creditHandle, row.post.platform),
    })),
    { pad: options?.pad !== false },
  );
  const pickedSet = new Set(picked.map((item) => item.row));
  const overflowSet = new Set(overflow.map((item) => item.row));
  for (const row of candidates) {
    if (pickedSet.has(row)) row.selected = true;
    else if (overflowSet.has(row)) {
      row.selected = false;
      row.outcome = "over_cap";
      row.note = "passed the filter but the weekly mix is already full";
    }
  }

  return evaluated;
}
