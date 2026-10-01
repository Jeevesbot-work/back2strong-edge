import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeReelTranscripts, needsReelTranscript, subtitlesToText } from "./apify";
import { classifyPost, hasRecipeBody } from "./classify";
import { contentFingerprint, findDuplicate, titleSimilarity } from "./dedupe";
import { toDraftRow } from "./draft";
import { extractRecipe } from "./extract";
import { FIXTURE_POSTS } from "./fixture";
import { buildShoppingList } from "../shopping-list";
import { normaliseIngredientLine } from "./ingredients";
import { buildDryRunReport } from "./run";
import { CATEGORY_QUOTA, selectWeekly, WEEKLY_TARGET } from "./select";
import { filterRecipe, THRESHOLDS } from "./thresholds";
import type { SourcePost } from "./types";

describe("macro thresholds", () => {
  it("documents the main-meal, breakfast, and snack gates", () => {
    assert.equal(THRESHOLDS.lunch.minProteinG, 30);
    assert.equal(THRESHOLDS.dinner.minProteinCalorieShare, 0.25);
    assert.equal(THRESHOLDS.lunch.fatPassG, 15);
    assert.equal(THRESHOLDS.dinner.fatFlagG, 20);
    assert.equal(THRESHOLDS.breakfast.minProteinG, 20);
    assert.equal(THRESHOLDS.breakfast.minProteinCalorieShare, 0.2);
    assert.equal(THRESHOLDS.breakfast.fatPassG, 12);
    assert.equal(THRESHOLDS.breakfast.fatFlagG, 18);
    assert.equal(THRESHOLDS.snack.minProteinG, 15);
    assert.equal(THRESHOLDS.snack.minProteinCalorieShare, 0.3);
    assert.equal(THRESHOLDS.snack.fatPassG, 8);
    assert.equal(THRESHOLDS.snack.fatFlagG, 12);
    assert.equal(CATEGORY_QUOTA.breakfast + CATEGORY_QUOTA.lunch + CATEGORY_QUOTA.dinner + CATEGORY_QUOTA.snack, WEEKLY_TARGET);
  });

  it("passes, flags, and rejects a main meal on the fat band", () => {
    const base = { category: "dinner" as const, carbs_g: 40, protein_g: 40, calories: 500 };
    assert.equal(filterRecipe({ ...base, fat_g: 15 }).decision, "pass");
    assert.equal(filterRecipe({ ...base, calories: 600, fat_g: 18 }).decision, "flag");
    assert.equal(filterRecipe({ ...base, fat_g: 18 }).decision, "reject");
    assert.equal(filterRecipe({ ...base, calories: 700, protein_g: 45, fat_g: 20 }).decision, "flag");
    assert.equal(filterRecipe({ ...base, fat_g: 21 }).decision, "reject");
    assert.equal(filterRecipe({ ...base, protein_g: 29, fat_g: 10 }).decision, "reject");
  });

  it("scales breakfast and snack floors", () => {
    assert.equal(filterRecipe({ category: "breakfast", calories: 400, protein_g: 20, carbs_g: 40, fat_g: 12 }).decision, "pass");
    assert.equal(filterRecipe({ category: "breakfast", calories: 500, protein_g: 20, carbs_g: 50, fat_g: 10 }).decision, "reject");
    assert.equal(filterRecipe({ category: "breakfast", calories: 560, protein_g: 30, carbs_g: 40, fat_g: 18 }).decision, "flag");
    assert.equal(filterRecipe({ category: "breakfast", calories: 560, protein_g: 30, carbs_g: 40, fat_g: 19 }).decision, "reject");
    assert.equal(filterRecipe({ category: "snack", calories: 200, protein_g: 15, carbs_g: 8, fat_g: 8 }).decision, "pass");
    assert.equal(filterRecipe({ category: "snack", calories: 250, protein_g: 15, carbs_g: 20, fat_g: 6 }).decision, "reject");
    assert.equal(filterRecipe({ category: "snack", calories: 360, protein_g: 27, carbs_g: 36, fat_g: 12 }).decision, "flag");
    assert.equal(filterRecipe({ category: "snack", calories: 360, protein_g: 27, carbs_g: 36, fat_g: 13 }).decision, "reject");
  });
});

describe("classify and extract", () => {
  it("drops promos and paywalls, and keeps a complete caption", () => {
    assert.equal(classifyPost("Download my meal plan app and use code STRONG. Link in bio."), "promo");
    assert.equal(classifyPost("The full recipe is in my app. Unlock the recipe from the link in bio."), "paywall");
    assert.equal(classifyPost("Leg day done."), "not_a_recipe");
    const complete = FIXTURE_POSTS.find((post) => post.sourceKey === "ig:lemon-tray")!;
    assert.equal(classifyPost(complete.caption), "recipe");
    const recipe = extractRecipe(complete.caption);
    assert.ok(recipe);
    assert.equal(recipe?.ingredients[0], "500g chicken breast");
    assert.equal(recipe?.protein_g, 54);
    assert.equal(recipe?.fat_g, 11);
  });

  it("glues gram amounts the way the shopping list expects", () => {
    assert.equal(normaliseIngredientLine("500 g chicken breast"), "500g chicken breast");
    assert.equal(normaliseIngredientLine("1 tbsp soy sauce"), "1 tbsp soy sauce");
    const merged = buildShoppingList([
      { recipeTitle: "A", ingredients: ["500g chicken breast"] },
      { recipeTitle: "B", ingredients: ["200g chicken breast"] },
    ]);
    assert.equal(merged[0]?.display, "700g chicken breast");
  });

  it("uses a reel transcript only when the caption has no recipe", () => {
    const reel: SourcePost = {
      platform: "instagram",
      sourceKey: "ig:ABC123",
      url: "https://www.instagram.com/reel/ABC123/",
      creditHandle: "someone",
      caption: "Lunch idea. Grams are in the voiceover.",
      isReel: true,
    };
    assert.equal(hasRecipeBody(reel.caption), false);
    assert.equal(needsReelTranscript(reel), true);
    const merged = mergeReelTranscripts([reel], [{ shortCode: "ABC123", transcript: "200g chicken breast\n200g rice\n100g yoghurt\n460 kcal\n47g protein" }]);
    assert.match(merged[0].transcript ?? "", /200g chicken breast/);
    assert.equal(subtitlesToText("1\n00:00:01,000 --> 00:00:02,000\nCook the rice"), "Cook the rice");
  });
});

describe("dedupe and drafts", () => {
  it("matches a reposted dish by ingredients even when the title differs", () => {
    const ingredients = ["400g turkey mince", "1 tbsp soy sauce", "200g lettuce", "100g cucumber", "80g 0% Greek yoghurt"];
    assert.ok(titleSimilarity("Turkey mince lettuce cups", "Speedy turkey lettuce wraps") < 0.75);
    assert.equal(contentFingerprint(ingredients), contentFingerprint(ingredients));
    const match = findDuplicate(
      { title: "Speedy turkey lettuce wraps", ingredients, sourceKey: "yt:1" },
      [{ title: "Turkey mince lettuce cups", ingredients, sourceKey: "ig:1" }],
    );
    assert.equal(match?.reason, "same ingredients as an existing recipe");
  });

  it("never marks a draft published", () => {
    const recipe = extractRecipe(FIXTURE_POSTS[0].caption)!;
    const row = toDraftRow(recipe, FIXTURE_POSTS[0], { status: "draft", note: null });
    assert.equal(row.published, false);
    assert.match(row.source_credit, /Inspired by @examplecook on Instagram/);
    assert.match(row.ingredients[0], /^\d+g /);
  });
});

describe("dry run", () => {
  it("selects a mixed unpublished week and shows each filter result", async () => {
    const report = await buildDryRunReport();
    assert.equal(report.mode, "dry-run");
    assert.equal(report.wrote, false);
    assert.equal(report.publishesAutomatically, false);
    assert.equal(report.selectedCount, WEEKLY_TARGET);

    const byKey = new Map(report.rows.map((row) => [row.sourceKey, row]));
    assert.equal(byKey.get("ig:lemon-tray")?.outcome, "draft");
    assert.equal(byKey.get("ig:lemon-tray")?.filter?.decision, "pass");
    assert.equal(byKey.get("ig:burrito-bowl")?.outcome, "flagged_draft");
    assert.equal(byKey.get("ig:burrito-bowl")?.selected, true);
    assert.equal(byKey.get("ig:salmon-pasta")?.outcome, "rejected_filter");
    assert.equal(byKey.get("ig:app-promo")?.outcome, "dropped_promo");
    assert.equal(byKey.get("ig:app-paywall")?.outcome, "dropped_paywall");
    assert.equal(byKey.get("ig:gym-day")?.outcome, "dropped_not_a_recipe");
    assert.equal(byKey.get("ig:honey-garlic")?.outcome, "duplicate");
    assert.match(byKey.get("ig:honey-garlic")?.duplicateOf ?? "", /Honey Garlic Chicken Fried Rice/);
    assert.equal(byKey.get("ig:turkey-cups")?.selected, true);
    assert.equal(byKey.get("yt:turkey-cups")?.outcome, "duplicate");
    assert.equal(byKey.get("ig:voiceover-lunch")?.transcriptUsed, true);
    assert.equal(byKey.get("ig:voiceover-lunch")?.selected, true);
    assert.equal(byKey.get("ig:banana-muffins")?.outcome, "over_cap");

    const selected = report.rows.filter((row) => row.selected);
    const categories = selected.map((row) => row.category);
    assert.equal(categories.filter((category) => category === "breakfast").length, 2);
    assert.equal(categories.filter((category) => category === "lunch").length, 3);
    assert.equal(categories.filter((category) => category === "dinner").length, 3);
    assert.equal(categories.filter((category) => category === "snack").length, 2);
    assert.ok(selected.every((row) => row.filter?.decision === "pass" || row.filter?.decision === "flag"));
  });
});

describe("weekly mix", () => {
  it("prefers a clean pass over a flagged recipe when the quota is full", () => {
    const fill = (category: "breakfast" | "lunch" | "dinner", count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `${category}-${index}`,
        category,
        decision: "pass" as const,
        protein_g: 40,
      }));
    const items = [
      ...fill("breakfast", 2),
      ...fill("lunch", 3),
      ...fill("dinner", 3),
      { id: "flag", category: "snack" as const, decision: "flag" as const, protein_g: 30 },
      { id: "a", category: "snack" as const, decision: "pass" as const, protein_g: 20 },
      { id: "b", category: "snack" as const, decision: "pass" as const, protein_g: 18 },
    ];
    const { picked, overflow } = selectWeekly(items);
    const snackIds = picked.filter((item) => item.category === "snack").map((item) => item.id);
    assert.deepEqual(snackIds, ["a", "b"]);
    assert.deepEqual(overflow.map((item) => item.id), ["flag"]);
  });
});
