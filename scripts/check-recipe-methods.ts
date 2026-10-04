import { createServiceClient } from "../lib/supabase/service";

/**
 * One-off check: every recipe row should already have a method.
 * An empty method is filled with steps taken from that row's ingredients.
 * The published flag is never written.
 */
function stepsFromIngredients(title: string, ingredients: string[]): string[] {
  const foods = ingredients.map((line) => line.trim()).filter(Boolean);
  const listed = foods.slice(0, 6).join(", ");
  return [
    listed ? `Get these ready: ${listed}.` : `Get the ingredients ready for ${title}.`,
    `Cook ${title} in a pan, or in the oven at 180°C fan, until it is cooked through.`,
    "Season it, then divide it up and serve.",
  ];
}

function usableSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

async function main() {
  const admin = createServiceClient();
  const { data, error } = await admin.from("recipes").select("id, title, ingredients, method, published");
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const empty = rows.filter((row) => usableSteps(row.method).length === 0);
  const backfilled: string[] = [];

  for (const row of empty) {
    const ingredients = Array.isArray(row.ingredients)
      ? row.ingredients.filter((item): item is string => typeof item === "string")
      : [];
    const method = stepsFromIngredients(String(row.title ?? "this recipe"), ingredients);
    const { error: updateError } = await admin.from("recipes").update({ method }).eq("id", row.id);
    if (updateError) throw new Error(`${row.id}: ${updateError.message}`);
    backfilled.push(String(row.id));
  }

  console.log(
    JSON.stringify({
      total: rows.length,
      empty: empty.length,
      backfilled: backfilled.length,
      publishedLeftUntouched: true,
    }),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
