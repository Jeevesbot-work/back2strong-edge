import { classifyPost } from "./classify";
import { findDuplicate, type LibraryEntry } from "./dedupe";
import { selectWeekly } from "./select";
import type { DraftRecipe, FilterResult, PostKind, SourcePost } from "./types";
import { filterRecipe } from "./thresholds";

export type Outcome =
  | "dropped_promo"
  | "dropped_paywall"
  | "dropped_not_a_recipe"
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

export function postText(post: SourcePost): string {
  return [post.caption?.trim(), post.transcript?.trim()].filter(Boolean).join("\n\n");
}

export async function evaluatePosts(
  posts: SourcePost[],
  library: LibraryEntry[],
  extract: (post: SourcePost, text: string) => Promise<ExtractResult>,
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
    if (kind !== "recipe") {
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

    const recipe = extracted.recipe;
    const filter = filterRecipe({
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
      note: filter.reasons.join("; "),
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
    })),
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
