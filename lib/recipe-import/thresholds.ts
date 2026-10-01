import type { FilterResult, RecipeCategory } from "./types";

/**
 * Per-serving gates. Protein uses 4 kcal/g and fat uses 9 kcal/g.
 *
 * Lunch and dinner (main meals), as specified:
 * - at least 30g protein, and protein at least 25% of calories
 * - fat at or under 15g passes
 * - fat over 15g up to 20g is flagged for review when fat is at most 30% of calories
 * - fat over 20g is rejected
 * - fat in the 15–20g band with fat over 30% of calories is rejected
 *
 * Breakfast is scaled down from the main-meal rule. A Back2Strong breakfast is
 * often oats or eggs, so the protein floor is 20g and protein only needs to be
 * 20% of calories (a 20g bowl at 400 kcal still qualifies; a sugary 20g bowl
 * at 600 kcal does not). Fat at or under 12g passes. 12–18g is flagged when
 * fat is at most 30% of calories. Over 18g is rejected.
 *
 * Snacks are smaller and should be protein-dense, not a piece of fruit with a
 * dusting of powder. Floor is 15g protein and protein at least 30% of calories
 * (15g protein means the snack is at most 200 kcal; 20g protein allows up to
 * 266 kcal). Fat at or under 8g passes. 8–12g is flagged when fat is at most
 * 30% of calories. Over 12g is rejected.
 */
export interface MacroThreshold {
  minProteinG: number;
  /** Protein calories / total calories. */
  minProteinCalorieShare: number;
  /** Fat at or under this passes with no review flag. */
  fatPassG: number;
  /** Fat over fatPassG and at or under this can be flagged. */
  fatFlagG: number;
  /** Applied only inside the flag band. Over this share, the band rejects. */
  maxFatCalorieShare: number;
}

export const THRESHOLDS: Record<RecipeCategory, MacroThreshold> = {
  breakfast: {
    minProteinG: 20,
    minProteinCalorieShare: 0.2,
    fatPassG: 12,
    fatFlagG: 18,
    maxFatCalorieShare: 0.3,
  },
  lunch: {
    minProteinG: 30,
    minProteinCalorieShare: 0.25,
    fatPassG: 15,
    fatFlagG: 20,
    maxFatCalorieShare: 0.3,
  },
  dinner: {
    minProteinG: 30,
    minProteinCalorieShare: 0.25,
    fatPassG: 15,
    fatFlagG: 20,
    maxFatCalorieShare: 0.3,
  },
  snack: {
    minProteinG: 15,
    minProteinCalorieShare: 0.3,
    fatPassG: 8,
    fatFlagG: 12,
    maxFatCalorieShare: 0.3,
  },
};

export interface MacroInput {
  category: RecipeCategory;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

function pct(share: number): string {
  return `${Math.round(share * 1000) / 10}%`;
}

export function filterRecipe(input: MacroInput): FilterResult {
  const rule = THRESHOLDS[input.category];
  const reasons: string[] = [];

  if (
    input.calories == null ||
    input.protein_g == null ||
    input.carbs_g == null ||
    input.fat_g == null ||
    input.calories <= 0
  ) {
    return { decision: "reject", reasons: ["missing per-serving calories, protein, carbs, or fat"] };
  }

  const proteinShare = (input.protein_g * 4) / input.calories;
  const fatShare = (input.fat_g * 9) / input.calories;
  let reject = false;
  let flag = false;

  if (input.protein_g < rule.minProteinG) {
    reject = true;
    reasons.push(`protein ${input.protein_g}g is under the ${rule.minProteinG}g ${input.category} floor`);
  }
  if (proteinShare < rule.minProteinCalorieShare) {
    reject = true;
    reasons.push(
      `protein is ${pct(proteinShare)} of calories, under the ${pct(rule.minProteinCalorieShare)} ${input.category} floor`,
    );
  }

  if (input.fat_g <= rule.fatPassG) {
    // Clear of the review band.
  } else if (input.fat_g <= rule.fatFlagG) {
    if (fatShare <= rule.maxFatCalorieShare) {
      flag = true;
      reasons.push(
        `fat ${input.fat_g}g is in the review band (${rule.fatPassG}–${rule.fatFlagG}g) at ${pct(fatShare)} of calories`,
      );
    } else {
      reject = true;
      reasons.push(
        `fat ${input.fat_g}g is in the review band but is ${pct(fatShare)} of calories, over ${pct(rule.maxFatCalorieShare)}`,
      );
    }
  } else {
    reject = true;
    reasons.push(`fat ${input.fat_g}g is over the ${rule.fatFlagG}g ${input.category} cap`);
  }

  if (reject) return { decision: "reject", reasons };
  if (flag) return { decision: "flag", reasons };
  return { decision: "pass", reasons: ["within thresholds"] };
}
