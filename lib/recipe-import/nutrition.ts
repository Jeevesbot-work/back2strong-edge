import type { DraftRecipe } from "./types";

/**
 * Per-100g energy and macros from USDA FoodData Central (public domain / CC0).
 * Figures are typical Foundation or SR Legacy values, rounded, for ordinary
 * UK supermarket foods. Spices are treated as negligible at a teaspoon.
 * Whey is a typical unflavoured powder; products vary by brand.
 * Set FDC_API_KEY (DEMO_KEY works) to look up foods this table misses.
 */

export interface MacroTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Food {
  names: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Grams represented by "2 eggs" when the line has no unit. */
  eachG?: number;
  /** Grams per millilitre. Oils are lighter than water. */
  density?: number;
}

const FOODS: Food[] = [
  { names: ["chicken breast"], kcal: 120, protein: 22.5, carbs: 0, fat: 2.62 },
  { names: ["chicken thigh"], kcal: 144, protein: 18.6, carbs: 0, fat: 7.8 },
  { names: ["turkey breast", "turkey mince"], kcal: 114, protein: 23.7, carbs: 0, fat: 1.5 },
  { names: ["beef mince", "lean beef"], kcal: 137, protein: 21.4, carbs: 0, fat: 5 },
  { names: ["cod", "haddock", "white fish"], kcal: 82, protein: 17.8, carbs: 0, fat: 0.7 },
  { names: ["prawn", "prawns"], kcal: 85, protein: 20.1, carbs: 0.9, fat: 0.5 },
  { names: ["egg white", "egg whites"], kcal: 52, protein: 10.9, carbs: 0.7, fat: 0.2, eachG: 33 },
  { names: ["egg", "eggs"], kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, eachG: 50 },
  { names: ["porridge oats", "oats", "rolled oats"], kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9 },
  { names: ["fat-free skyr", "0% greek yoghurt", "0% yoghurt", "fat-free yoghurt", "skyr"], kcal: 59, protein: 10.3, carbs: 3.6, fat: 0.4 },
  { names: ["cottage cheese"], kcal: 72, protein: 12.4, carbs: 2.7, fat: 1 },
  { names: ["reduced-fat cheddar", "light cheddar"], kcal: 273, protein: 27, carbs: 2, fat: 17 },
  { names: ["cheddar"], kcal: 403, protein: 25, carbs: 1.3, fat: 33 },
  { names: ["semi-skimmed milk", "milk"], kcal: 50, protein: 3.3, carbs: 4.8, fat: 1.9, density: 1.03 },
  { names: ["white rice", "rice"], kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3 },
  { names: ["pasta"], kcal: 131, protein: 5, carbs: 25, fat: 1.1 },
  { names: ["potato", "potatoes"], kcal: 77, protein: 2, carbs: 17.5, fat: 0.1 },
  { names: ["broccoli"], kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4 },
  { names: ["spinach"], kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { names: ["green beans"], kcal: 31, protein: 1.8, carbs: 7, fat: 0.1 },
  { names: ["pepper", "peppers"], kcal: 31, protein: 1, carbs: 6, fat: 0.3 },
  { names: ["onion", "spring onion"], kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  { names: ["courgette"], kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
  { names: ["cherry tomatoes", "tomatoes", "tomato", "passata", "tinned tomatoes"], kcal: 32, protein: 1.6, carbs: 5.8, fat: 0.3 },
  { names: ["peas"], kcal: 81, protein: 5.4, carbs: 14.5, fat: 0.4 },
  { names: ["edamame"], kcal: 122, protein: 11.9, carbs: 8.9, fat: 5.2 },
  { names: ["blueberries", "berries"], kcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3 },
  { names: ["strawberries"], kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3 },
  { names: ["banana"], kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, eachG: 120 },
  { names: ["honey"], kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
  { names: ["olive oil", "rapeseed oil", "oil"], kcal: 884, protein: 0, carbs: 0, fat: 100, density: 0.91 },
  { names: ["soy sauce"], kcal: 53, protein: 8.1, carbs: 4.9, fat: 0.1, density: 1.15 },
  { names: ["cornflour"], kcal: 381, protein: 0.3, carbs: 91, fat: 0.1 },
  { names: ["whey protein", "protein powder"], kcal: 400, protein: 80, carbs: 6, fat: 5 },
  { names: ["rice cake"], kcal: 387, protein: 8, carbs: 81, fat: 2.8, eachG: 9 },
  { names: ["garlic"], kcal: 149, protein: 6.4, carbs: 33, fat: 0.5, eachG: 5 },
  { names: ["stock cube"], kcal: 220, protein: 10, carbs: 20, fat: 10, eachG: 10 },
  { names: ["salt", "black pepper", "pepper flakes", "paprika", "cumin", "oregano", "chilli flakes", "dried herbs", "mixed herbs"], kcal: 0, protein: 0, carbs: 0, fat: 0 },
];

const BY_LENGTH = FOODS.flatMap((food) => food.names.map((name) => ({ name, food }))).sort((a, b) => b.name.length - a.name.length);

export function matchFood(name: string): Food | null {
  const clean = name.toLowerCase();
  for (const entry of BY_LENGTH) {
    if (clean.includes(entry.name)) return entry.food;
  }
  return null;
}

function roundMacros(total: MacroTotals, servings: number): MacroTotals {
  const safe = servings > 0 ? servings : 1;
  return {
    calories: Math.round(total.calories / safe),
    protein_g: Math.round(total.protein_g / safe),
    carbs_g: Math.round(total.carbs_g / safe),
    fat_g: Math.round(total.fat_g / safe),
  };
}

function gramsOf(amount: number, unit: string, food: Food): number {
  const u = unit.toLowerCase();
  if (u === "g") return amount;
  if (u === "kg") return amount * 1000;
  if (u === "ml" || u === "l") {
    const ml = u === "l" ? amount * 1000 : amount;
    return ml * (food.density ?? 1);
  }
  if (u === "tbsp") return amount * 15 * (food.density ?? 1);
  if (u === "tsp") return amount * 5 * (food.density ?? 1);
  if (!u && food.eachG) return amount * food.eachG;
  return amount;
}

export interface IngredientCalc {
  perServing: MacroTotals;
  unresolved: string[];
}

/** Sum a shopping list and divide by servings. Unresolved lines are returned, not guessed. */
export function calculateFromIngredients(ingredients: string[], servings: number): IngredientCalc {
  const total: MacroTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const unresolved: string[] = [];
  for (const line of ingredients) {
    const match = line.trim().match(/^(\d+(?:\.\d+)?)\s*(kg|g|ml|l|tbsp|tsp)?\b\s*(.*)$/i);
    if (!match) {
      unresolved.push(line);
      continue;
    }
    const amount = Number(match[1]);
    const unit = match[2] ?? "";
    const name = match[3] ?? "";
    const food = matchFood(name);
    if (!food || !Number.isFinite(amount)) {
      unresolved.push(line);
      continue;
    }
    const grams = gramsOf(amount, unit, food);
    const scale = grams / 100;
    total.calories += food.kcal * scale;
    total.protein_g += food.protein * scale;
    total.carbs_g += food.carbs * scale;
    total.fat_g += food.fat * scale;
  }
  return { perServing: roundMacros(total, servings), unresolved };
}

/** Flag when calculated calories, protein, or fat disagree with the stated figure by more than 15%. */
export const MISMATCH_SHARE = 0.15;

export function macroMismatch(stated: MacroTotals, calculated: MacroTotals): string | null {
  const parts: string[] = [];
  const fields: Array<keyof MacroTotals> = ["calories", "protein_g", "fat_g"];
  for (const field of fields) {
    const expected = stated[field];
    const got = calculated[field];
    if (expected <= 0) continue;
    const gap = Math.abs(got - expected) / expected;
    if (gap > MISMATCH_SHARE) parts.push(`${field.replace("_g", "")} stated ${expected} vs calculated ${got}`);
  }
  if (!parts.length) return null;
  return `Macro check: ${parts.join("; ")} (USDA FoodData Central)`;
}

/** Null when an ingredient could not be looked up, so a partial sum is not treated as a mismatch. */
export function statedMacroMismatch(recipe: Pick<DraftRecipe, "ingredients" | "servings" | "calories" | "protein_g" | "carbs_g" | "fat_g">): string | null {
  const calculated = calculateFromIngredients(recipe.ingredients, recipe.servings);
  if (calculated.unresolved.length) return null;
  return macroMismatch(
    { calories: recipe.calories, protein_g: recipe.protein_g, carbs_g: recipe.carbs_g, fat_g: recipe.fat_g },
    calculated.perServing,
  );
}

const FDC = "https://api.nal.usda.gov/fdc/v1/foods/search";
let fdcCalls = 0;

export function resetFdcCalls(): void {
  fdcCalls = 0;
}

/**
 * Optional lookup for a food the bundled table missed.
 * Uses FDC_API_KEY when set (DEMO_KEY is accepted). Does nothing otherwise.
 */
/** Bundled table first. FDC_API_KEY, when set, fills foods the table missed (capped at 8 lookups). */
export async function calculateWithLookup(ingredients: string[], servings: number): Promise<IngredientCalc> {
  const base = calculateFromIngredients(ingredients, servings);
  if (!base.unresolved.length || !process.env.FDC_API_KEY?.trim()) return base;

  const total: MacroTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const unresolved: string[] = [];
  for (const line of ingredients) {
    const matched = calculateFromIngredients([line], 1);
    if (!matched.unresolved.length) {
      total.calories += matched.perServing.calories;
      total.protein_g += matched.perServing.protein_g;
      total.carbs_g += matched.perServing.carbs_g;
      total.fat_g += matched.perServing.fat_g;
      continue;
    }
    const name = line.replace(/^\d+(?:\.\d+)?\s*(?:kg|g|ml|l|tbsp|tsp)?\b/i, "").trim();
    const food = await lookupFdc(name);
    const amount = line.match(/^(\d+(?:\.\d+)?)/);
    if (!food || !amount) {
      unresolved.push(line);
      continue;
    }
    const grams = gramsOf(Number(amount[1]), (line.match(/\d+(?:\.\d+)?\s*(kg|g|ml|l|tbsp|tsp)/i)?.[1] ?? "g"), food);
    const scale = grams / 100;
    total.calories += food.kcal * scale;
    total.protein_g += food.protein * scale;
    total.carbs_g += food.carbs * scale;
    total.fat_g += food.fat * scale;
  }
  return { perServing: roundMacros(total, servings), unresolved };
}

export async function lookupFdc(query: string): Promise<Food | null> {
  const key = process.env.FDC_API_KEY?.trim();
  if (!key || fdcCalls >= 8) return null;
  fdcCalls += 1;
  const url = `${FDC}?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&pageSize=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const body = (await res.json()) as { foods?: Array<{ description?: string; foodNutrients?: Array<{ nutrientName?: string; value?: number }> }> };
  const food = body.foods?.[0];
  if (!food?.foodNutrients) return null;
  const value = (needle: string) =>
    food.foodNutrients?.find((nutrient) => (nutrient.nutrientName ?? "").toLowerCase().includes(needle))?.value ?? 0;
  return {
    names: [query.toLowerCase()],
    kcal: value("energy"),
    protein: value("protein"),
    carbs: value("carbohydrate"),
    fat: value("total lipid") || value("fat"),
  };
}
