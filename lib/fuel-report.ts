// Shared maths for Coach Fuel Reports — used by the admin panel, the API
// route and the client-side card so the numbers always agree.

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ReportItem extends Macros {
  meal_name: string;
  created_at?: string;
  duplicate: boolean;
}

// Full four-macro targets from the two the profile stores.
// Fat ~28% of calories (healthy floor for 40+ men training hard);
// carbs fill whatever is left after protein and fat.
export function macroTargets(calorieTarget: number | null, proteinTarget: number | null): Macros {
  const calories = calorieTarget && calorieTarget > 0 ? calorieTarget : 2200;
  const protein_g = proteinTarget && proteinTarget > 0 ? proteinTarget : 160;
  const fat_g = Math.round((calories * 0.28) / 9);
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));
  return { calories, protein_g, carbs_g, fat_g };
}

const n = (v: unknown) => (v == null || isNaN(Number(v)) ? 0 : Number(v));

// Same food logged again within 2 minutes = almost certainly a double tap.
export function flagDuplicates<T extends { meal_name: string; created_at?: string }>(rows: T[]): (T & { duplicate: boolean })[] {
  const sorted = [...rows].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  return sorted.map((row, i) => {
    const prev = sorted.slice(0, i).reverse().find((p) => p.meal_name.trim().toLowerCase() === row.meal_name.trim().toLowerCase());
    const dup = !!prev && !!prev.created_at && !!row.created_at &&
      Math.abs(new Date(row.created_at).getTime() - new Date(prev.created_at).getTime()) < 2 * 60 * 1000;
    return { ...row, duplicate: dup };
  });
}

export function toItems(rows: { meal_name: string; calories: unknown; protein_g: unknown; carbs_g: unknown; fat_g: unknown; created_at?: string }[]): ReportItem[] {
  return flagDuplicates(
    rows.map((r) => ({
      meal_name: r.meal_name ?? "Food",
      calories: n(r.calories),
      protein_g: n(r.protein_g),
      carbs_g: n(r.carbs_g),
      fat_g: n(r.fat_g),
      created_at: r.created_at,
    }))
  );
}

export function sumItems(items: Macros[]): Macros {
  const t = items.reduce(
    (a, i) => ({ calories: a.calories + i.calories, protein_g: a.protein_g + i.protein_g, carbs_g: a.carbs_g + i.carbs_g, fat_g: a.fat_g + i.fat_g }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
  return { calories: Math.round(t.calories), protein_g: Math.round(t.protein_g), carbs_g: Math.round(t.carbs_g), fat_g: Math.round(t.fat_g) };
}

export type MacroStatus = "on" | "over" | "short" | "low";

// on = within ±10%; short = 70–90%; low = under 70%; over = above 110%.
export function macroStatus(actual: number, target: number): MacroStatus {
  if (target <= 0) return "on";
  const r = actual / target;
  if (r > 1.1) return "over";
  if (r >= 0.9) return "on";
  if (r >= 0.7) return "short";
  return "low";
}

// A plain-English starting note for Nick to edit before sending.
export function suggestNote(firstName: string, totals: Macros, targets: Macros, dupes: ReportItem[]): string {
  const lines: string[] = [];
  const p = macroStatus(totals.protein_g, targets.protein_g);
  const f = macroStatus(totals.fat_g, targets.fat_g);
  const c = macroStatus(totals.carbs_g, targets.carbs_g);
  const calGap = targets.calories - totals.calories;

  lines.push(`${firstName}, had a look at your day.`);
  if (p === "on" || p === "over") lines.push(`Protein's nailed at ${totals.protein_g}g, so the hard bit's done.`);
  else lines.push(`Protein's at ${totals.protein_g}g against ${targets.protein_g}g. That's the one to fix first. Add a shake, Greek yoghurt or an extra portion of meat.`);

  if (f === "low" || f === "short") {
    lines.push(`Fat's only ${totals.fat_g}g (aim for about ${targets.fat_g}g). Too low when you're training hard, it hits energy and recovery. Easy fix: a handful of nuts, olive oil on your salad, half an avocado or a couple of eggs.`);
  }
  if (c === "low") lines.push(`Carbs are light at ${totals.carbs_g}g. On training days get some rice, potatoes or oats in around your session.`);

  if (calGap > 300) lines.push(`Overall you're about ${Math.round(calGap / 50) * 50} cals short. One day's fine, just don't make it a habit.`);
  else if (calGap < -300) lines.push(`You're about ${Math.round(-calGap / 50) * 50} cals over target today. Not a drama, just keep an eye on it.`);
  else lines.push(`Calories are right where they should be. Good work.`);

  if (dupes.length) {
    const names = Array.from(new Set(dupes.map((d) => d.meal_name))).join(", ");
    lines.push(`Quick one: ${names} went in twice within a minute. If that was a double tap, delete one and your numbers will update.`);
  }
  return lines.join(" ");
}
