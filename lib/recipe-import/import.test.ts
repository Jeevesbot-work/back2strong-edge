import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APIFY_CREDIT_NOTE,
  APIFY_MIN_REMAINING_USD,
  REEL_CHARGE_CAP_USD,
  apifyCreditExhausted,
  borrowYoutubeTranscripts,
  interpretLimitsResponse,
  MAX_REEL_TRANSCRIPTS,
  mergeReelTranscripts,
  needsReelTranscript,
  parseActorBody,
  remainingFromLimits,
  selectTranscriptTargets,
  shouldSkipApify,
  subtitlesToText,
  titlesOverlap,
} from "./apify";
import { creatorRates } from "./creator-stats";
import { activeCreators, DEFAULT_CREATORS, postsPerCreator } from "./creators";
import { isLeanSwapCandidate } from "./lean-swap";
import { calculateFromIngredients, macroMismatch, statedMacroMismatch } from "./nutrition";
import { originalSlots } from "./slots";
import { sourceCredit } from "./draft";
import { classifyPost, hasRecipeBody, worthRewriting } from "./classify";
import { toUk } from "./ease";
import { imageCreditsExhausted, recipeImagePrompt } from "./images";
import { evaluatePosts } from "./evaluate";
import { contentFingerprint, findDuplicate, titleSimilarity } from "./dedupe";
import { toDraftRow } from "./draft";
import type { DraftRecipe } from "./types";
import { extractRecipe } from "./extract";
import { FIXTURE_POSTS } from "./fixture";
import { buildShoppingList } from "../shopping-list";
import { normaliseIngredientLine } from "./ingredients";
import { buildDryRunReport, formatSummary, planWhenApifyUnavailable, type ImportReport } from "./run";
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
      caption: "Chicken fried rice. The grams are in the voiceover.",
      isReel: true,
    };
    assert.equal(hasRecipeBody(reel.caption), false);
    assert.equal(needsReelTranscript(reel), true);
    const merged = mergeReelTranscripts([reel], [{ shortCode: "ABC123", transcript: "200g chicken breast\n200g rice\n100g yoghurt\n460 kcal\n47g protein" }]);
    assert.match(merged[0].transcript ?? "", /200g chicken breast/);
    assert.equal(subtitlesToText("1\n00:00:01,000 --> 00:00:02,000\nCook the rice"), "Cook the rice");
  });

  it("accepts card macros and a spoken cooking transcript", async () => {
    assert.equal(
      classifyPost("Calories: 520 / Protein: 54g / 500 grams chicken breast and 200g rice"),
      "recipe",
    );
    assert.equal(classifyPost("610 calories and 47g protein, no ingredients listed"), "not_a_recipe");

    const spoken = Array.from({ length: 4 }, () =>
      "Today we cook a high protein lunch. You need chicken, about five hundred grams, rice, and a tablespoon of soy. This recipe serves two.",
    ).join(" ");
    assert.ok(spoken.length >= 280);
    assert.equal(hasRecipeBody("Lunch idea"), false);
    assert.equal(worthRewriting("Lunch idea", spoken), true);

    let extracted = 0;
    const post: SourcePost = {
      platform: "instagram",
      sourceKey: "ig:spoken-lunch",
      url: "https://example.invalid/reel/spoken-lunch",
      creditHandle: "someone",
      caption: "Lunch idea",
      transcript: spoken,
      isReel: true,
    };
    const gym: SourcePost = {
      platform: "instagram",
      sourceKey: "ig:gym-only",
      url: "https://example.invalid/p/gym-only",
      creditHandle: "someone",
      caption: "Leg day done.",
    };
    const evaluated = await evaluatePosts([post, gym], [], async () => {
      extracted += 1;
      return { ok: false, kind: "not_a_recipe", error: "no method" };
    });
    assert.equal(extracted, 1);
    assert.equal(evaluated[0]?.outcome, "dropped_not_a_recipe");
    assert.equal(evaluated[1]?.outcome, "dropped_not_a_recipe");
  });

  it("fetches a spoken method for a dish caption, and caps the batch", () => {
    assert.equal(classifyPost("The full recipe is in my recipe book. Comment BOOK and I'll send the link."), "paywall");
    const spoken: SourcePost = {
      platform: "instagram",
      sourceKey: "ig:spoken",
      url: "https://www.instagram.com/reel/spoken/",
      creditHandle: "someone",
      caption: "Honey garlic chicken\nCalories: 520\nProtein: 45g",
      isReel: true,
    };
    const written: SourcePost = {
      ...spoken,
      sourceKey: "ig:written",
      caption: `${spoken.caption}\nMethod\nHeat the pan.\nCook the chicken until it is done.`,
    };
    assert.equal(needsReelTranscript(spoken), true);
    assert.equal(needsReelTranscript(written), false);
    assert.equal(
      worthRewriting(spoken.caption, "Cook the chicken in the pan for twenty minutes, then rest it and slice it before serving."),
      true,
    );
    assert.equal(toUk("1 zucchini, cilantro and ground turkey"), "1 courgette, coriander and turkey mince");
    assert.equal(imageCreditsExhausted("image generation failed (429): insufficient_quota"), true);
    const prompt = recipeImagePrompt({
      title: "Chicken stew",
      category: "dinner",
      ingredients: ["500g chicken breast"],
    });
    assert.match(prompt, /Casual phone photo/);
    assert.match(prompt, /Natural window light/);
    assert.match(prompt, /Ordinary UK family kitchen/);
    assert.match(prompt, /No dark moody backdrop/);
    assert.match(prompt, /no glossy food-magazine look/);
    assert.doesNotMatch(prompt, /Dark matte plate/);
    assert.doesNotMatch(prompt, /shallow depth of field/);

    const many = Array.from({ length: MAX_REEL_TRANSCRIPTS + 3 }, (_, index) => ({
      platform: "instagram" as const,
      sourceKey: `ig:reel-${index}`,
      url: `https://www.instagram.com/reel/reel-${index}/`,
      creditHandle: "someone",
      caption: index === MAX_REEL_TRANSCRIPTS + 2 ? "Protein oats\nCalories: 420\nProtein: 32g" : "Chicken wrap",
      isReel: true,
    }));
    const picked = selectTranscriptTargets(many);
    assert.equal(picked.length, MAX_REEL_TRANSCRIPTS);
    assert.equal(picked[0]?.sourceKey, `ig:reel-${MAX_REEL_TRANSCRIPTS + 2}`);
  });

  it("names the actor when Apify returns an HTML page", () => {
    assert.throws(
      () => parseActorBody("<html>\r\n<h1>Bad gateway</h1>", 200, "streamers~youtube-scraper", "start"),
      /streamers~youtube-scraper start returned non-JSON \(200\)/,
    );
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

  it("keeps a simple meal ahead of a fiddly one", () => {
    const items = [
      { id: "fiddly", category: "snack" as const, decision: "pass" as const, protein_g: 40, simplicity: "fiddly" as const },
      { id: "simple", category: "snack" as const, decision: "pass" as const, protein_g: 16, simplicity: "simple" as const },
      { id: "simple2", category: "snack" as const, decision: "pass" as const, protein_g: 18, simplicity: "simple" as const },
    ];
    const { picked } = selectWeekly([
      ...Array.from({ length: 2 }, (_, index) => ({ id: `b${index}`, category: "breakfast" as const, decision: "pass" as const, protein_g: 30 })),
      ...Array.from({ length: 3 }, (_, index) => ({ id: `l${index}`, category: "lunch" as const, decision: "pass" as const, protein_g: 40 })),
      ...Array.from({ length: 3 }, (_, index) => ({ id: `d${index}`, category: "dinner" as const, decision: "pass" as const, protein_g: 40 })),
      ...items,
    ]);
    assert.equal(picked.some((item) => item.id === "simple"), true);
    assert.equal(picked.some((item) => item.id === "fiddly"), false);
  });

  it("prefers a higher-weight creator when the meal is otherwise equal", () => {
    const fill = (category: "breakfast" | "lunch" | "dinner", count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `${category}-${index}`,
        category,
        decision: "pass" as const,
        protein_g: 40,
      }));
    const { picked } = selectWeekly([
      ...fill("breakfast", 2),
      ...fill("lunch", 3),
      ...fill("dinner", 3),
      { id: "high", category: "snack" as const, decision: "pass" as const, protein_g: 16, weight: 3 },
      { id: "low", category: "snack" as const, decision: "pass" as const, protein_g: 40, weight: 1 },
      { id: "low2", category: "snack" as const, decision: "pass" as const, protein_g: 30, weight: 1 },
    ]);
    const snackIds = picked.filter((item) => item.category === "snack").map((item) => item.id);
    assert.deepEqual(snackIds, ["high", "low"]);
  });

  it("does not pad past the category quotas when originals will fill the week", () => {
    const lunches = Array.from({ length: 5 }, (_, index) => ({
      id: `lunch-${index}`,
      category: "lunch" as const,
      decision: "pass" as const,
      protein_g: 40,
    }));
    const { picked } = selectWeekly(lunches, { pad: false });
    assert.equal(picked.length, 3);
  });
});

describe("sourcing mix", () => {
  it("weights full-caption creators above gated ones", () => {
    const neill = DEFAULT_CREATORS.instagram.find((creator) => creator.handle === "neill_in_vs_out_nutrition");
    const jalal = DEFAULT_CREATORS.instagram.find((creator) => creator.handle === "jalalsamfit");
    const chlo = DEFAULT_CREATORS.instagram.find((creator) => creator.handle === "chlo_fitx");
    const gated = DEFAULT_CREATORS.instagram.find((creator) => creator.handle === "risewithteagan");
    assert.equal(neill?.weight, 3);
    assert.equal(jalal?.weight, 3);
    assert.equal(chlo?.weight, 1);
    assert.equal(gated?.weight, 0);
    assert.equal(postsPerCreator(3), 6);
    assert.equal(postsPerCreator(0), 0);
    assert.equal(
      activeCreators().instagram.some((creator) => creator.handle === "risewithteagan"),
      false,
    );
  });

  it("uses a free YouTube subtitle before paying for an Instagram transcript", () => {
    const reel: SourcePost = {
      platform: "instagram",
      sourceKey: "ig:honey",
      url: "https://www.instagram.com/reel/honey/",
      creditHandle: "jalalsamfit",
      caption: "Honey garlic chicken\nCalories: 520\nProtein: 45g",
      isReel: true,
    };
    const video: SourcePost = {
      platform: "youtube",
      sourceKey: "yt:honey",
      url: "https://www.youtube.com/watch?v=honey",
      creditHandle: "Jalalsamfit",
      caption: "",
      titleHint: "Honey Garlic Chicken",
      transcript: "Slice the chicken breast and cook it until it is done.",
    };
    assert.equal(titlesOverlap(reel.caption, video.titleHint ?? ""), true);
    const [borrowed] = borrowYoutubeTranscripts([reel, video]);
    assert.equal(borrowed?.transcriptSource, "youtube");
    assert.match(borrowed?.transcript ?? "", /chicken breast/);
    assert.equal(needsReelTranscript(borrowed!), false);
    assert.equal(MAX_REEL_TRANSCRIPTS, 10);
  });

  it("skips comment-for-recipe and recipe-on-my-site posts, and keeps a full caption", () => {
    assert.equal(classifyPost("Comment YUM and I'll send it over."), "paywall");
    assert.equal(classifyPost("The recipe is on my site."), "paywall");
    assert.equal(
      classifyPost("Calories: 430\nProtein: 43g\n500g chicken breast\n200g rice\nComment YUM if you make it"),
      "recipe",
    );
  });

  it("calculates macros from the USDA table and flags a large gap", () => {
    const calculated = calculateFromIngredients(["500g chicken breast", "1 tsp salt"], 4);
    assert.deepEqual(calculated.unresolved, []);
    assert.equal(calculated.perServing.calories, 150);
    assert.equal(calculated.perServing.protein_g, 28);
    assert.equal(calculated.perServing.fat_g, 3);
    assert.equal(macroMismatch({ calories: 150, protein_g: 28, carbs_g: 0, fat_g: 3 }, calculated.perServing), null);
    assert.match(
      macroMismatch({ calories: 400, protein_g: 28, carbs_g: 0, fat_g: 3 }, calculated.perServing) ?? "",
      /calories stated 400/,
    );
    assert.equal(
      statedMacroMismatch({
        ingredients: ["500g chicken breast", "1 tbsp gochujang"],
        servings: 2,
        calories: 400,
        protein_g: 40,
        carbs_g: 10,
        fat_g: 8,
      }),
      null,
    );
  });

  it("keeps a fat-band dinner when one lean swap makes it pass", async () => {
    const recipe: DraftRecipe = {
      title: "Chicken stew",
      category: "dinner",
      description: "A one-pot chicken stew for the week.",
      servings: 4,
      prep_time_mins: 10,
      cook_time_mins: 20,
      calories: 600,
      protein_g: 45,
      carbs_g: 40,
      fat_g: 18,
      ingredients: ["500g chicken thigh", "200g rice"],
      method: ["Brown the chicken.", "Simmer the rice."],
      tags: ["high-protein"],
      coach_note: null,
      simplicity: "simple",
      niche: false,
    };
    assert.equal(isLeanSwapCandidate(recipe), true);
    const post: SourcePost = {
      platform: "instagram",
      sourceKey: "ig:stew",
      url: "https://example.invalid/p/stew",
      creditHandle: "neill_in_vs_out_nutrition",
      caption: "Calories: 600\nProtein: 45g\n500g chicken thigh\n200g rice",
    };
    const swapped: DraftRecipe = {
      ...recipe,
      ingredients: ["500g chicken breast", "200g rice"],
      calories: 450,
      protein_g: 40,
      carbs_g: 40,
      fat_g: 8,
      coach_note: "Lean swap: chicken thigh → chicken breast. Macros recomputed from USDA FoodData Central.",
    };
    const evaluated = await evaluatePosts([post], [], async () => ({ ok: true, recipe }), {
      pad: false,
      leanSwap: async () => swapped,
    });
    assert.equal(evaluated[0]?.outcome, "draft");
    assert.equal(evaluated[0]?.filter?.decision, "pass");
    assert.match(evaluated[0]?.note ?? "", /Lean swap: chicken thigh/);
    assert.equal(evaluated[0]?.selected, true);
  });

  it("asks for original breakfasts and snacks, then tops up to 10", () => {
    assert.deepEqual(originalSlots({ breakfast: 0, lunch: 3, dinner: 3, snack: 0 }), ["breakfast", "breakfast", "snack", "snack"]);
    const fromScratch = originalSlots({ breakfast: 0, lunch: 0, dinner: 0, snack: 0 });
    assert.equal(fromScratch.length, 10);
    assert.equal(fromScratch.filter((category) => category === "breakfast").length, 2);
    assert.equal(fromScratch.filter((category) => category === "snack").length, 2);
  });

  it("records full-caption rate and pass rate, and credits an original to B2S", () => {
    const rates = creatorRates([
      { platform: "instagram", handle: "jalalsamfit", fullCaption: true, passed: true },
      { platform: "instagram", handle: "jalalsamfit", fullCaption: true, passed: true },
      { platform: "instagram", handle: "jalalsamfit", fullCaption: true, passed: false },
      { platform: "instagram", handle: "chlo_fitx", fullCaption: false, passed: false },
    ]);
    const jalal = rates.find((rate) => rate.handle === "jalalsamfit");
    assert.equal(jalal?.fullCaptions, 3);
    assert.equal(jalal?.passes, 2);
    assert.equal(jalal?.posts, 3);
    const recipe = extractRecipe(FIXTURE_POSTS[0].caption)!;
    const row = toDraftRow(recipe, { ...FIXTURE_POSTS[0], platform: "b2s", creditHandle: "", sourceKey: "b2s:lunch-0" }, { status: "draft", note: "B2S original." });
    assert.equal(row.published, false);
    assert.equal(row.source_platform, "b2s");
    assert.equal(sourceCredit(row.source_platform === "b2s" ? { ...FIXTURE_POSTS[0], platform: "b2s", creditHandle: "" } : FIXTURE_POSTS[0]), "B2S original.");
    assert.equal(row.source_credit, "B2S original.");
    assert.doesNotMatch(row.source_credit, /Inspired by/);
  });

  it("fills all 10 slots with originals when Apify credit is exhausted", () => {
    assert.equal(APIFY_MIN_REMAINING_USD, 0.3);
    assert.equal(REEL_CHARGE_CAP_USD, 0.4);
    assert.equal(APIFY_CREDIT_NOTE, "Apify credit exhausted, used B2S originals");

    assert.equal(apifyCreditExhausted("Apify instagram-scraper start failed (402): Payment required"), true);
    assert.equal(apifyCreditExhausted("Monthly usage hard limit exceeded"), true);
    assert.equal(apifyCreditExhausted("actor run refused: not-enough-usage"), true);
    assert.equal(apifyCreditExhausted("By launching this job you will exceed your remaining usage of $0.12"), true);
    assert.equal(
      apifyCreditExhausted("Apify youtube-scraper ended with ABORTED: exceeded the maximum cost specified by the maxTotalChargeUsd parameter"),
      false,
    );
    assert.equal(apifyCreditExhausted("Apify youtube-scraper timed out after 8 minutes"), false);
    assert.equal(apifyCreditExhausted("instagram-scraper start returned non-JSON (500): <html>"), false);

    const limits = {
      data: { limits: { maxMonthlyUsageUsd: 5 }, current: { monthlyUsageUsd: 4.8 } },
    };
    assert.ok(Math.abs((remainingFromLimits(limits) ?? 0) - 0.2) < 0.001);
    assert.equal(remainingFromLimits({ limits: { maxMonthlyUsageUsd: 5 }, current: { monthlyUsageUsd: 3.5 } }), 1.5);
    assert.equal(remainingFromLimits({ data: { limits: {} } }), null);
    assert.equal(shouldSkipApify(0.2), true);
    assert.equal(shouldSkipApify(0.3), false);
    assert.equal(shouldSkipApify(1.5), false);
    assert.equal(shouldSkipApify(null), false);

    const refused = interpretLimitsResponse(402, '{"error":{"type":"not-enough-usage","message":"Monthly usage hard limit exceeded"}}');
    assert.equal(refused.creditExhausted, true);
    assert.match(refused.message ?? "", /402/);
    const quiet = interpretLimitsResponse(404, "not found");
    assert.equal(quiet.creditExhausted, false);
    assert.equal(quiet.remaining, null);
    const low = interpretLimitsResponse(200, JSON.stringify(limits));
    assert.equal(low.creditExhausted, false);
    assert.equal(shouldSkipApify(low.remaining), true);

    const credit = planWhenApifyUnavailable({
      posts: [{ sourceKey: "ig:partial" }],
      creditExhausted: true,
    });
    assert.equal(credit.skipCreators, true);
    assert.equal(credit.note, APIFY_CREDIT_NOTE);
    assert.equal(credit.slots.length, 10);
    assert.equal(credit.slots.filter((category) => category === "breakfast").length, 2);
    assert.equal(credit.slots.filter((category) => category === "lunch").length, 3);
    assert.equal(credit.slots.filter((category) => category === "dinner").length, 3);
    assert.equal(credit.slots.filter((category) => category === "snack").length, 2);

    const empty = planWhenApifyUnavailable({ posts: [], creditExhausted: false });
    assert.equal(empty.skipCreators, true);
    assert.equal(empty.note, "Apify credit exhausted, used B2S originals");

    const healthy = planWhenApifyUnavailable({ posts: [{ sourceKey: "ig:ok" }], creditExhausted: false });
    assert.equal(healthy.skipCreators, false);
    assert.equal(healthy.note, null);

    const report: ImportReport = {
      mode: "live",
      wrote: false,
      publishesAutomatically: false,
      library: "supabase",
      weeklyTarget: 10,
      quotas: CATEGORY_QUOTA,
      thresholds: THRESHOLDS,
      considered: 0,
      selectedCount: 10,
      rows: [],
      errors: ["Apify instagram-scraper start failed (402): Monthly usage hard limit exceeded"],
      apifyNote: credit.note ?? undefined,
    };
    const summary = formatSummary(report);
    assert.match(summary, /Apify credit exhausted, used B2S originals/);
    assert.equal(report.errors.includes(APIFY_CREDIT_NOTE), false);
    const blocked = report.errors.some((error) => /is not set|columns are missing/i.test(error));
    const wouldFail = blocked || (report.errors.length > 0 && report.selectedCount === 0);
    assert.equal(wouldFail, false);
  });
});
