import { APIFY_CREDIT_NOTE } from "./apify";
import { hasRecipeBody } from "./classify";
import { formatCreatorRates, creatorRates } from "./creator-stats";
import { formatCost, importCost, resetImportCost, type ImportCost } from "./cost";
import { DEFAULT_CREATORS } from "./creators";
import { extractRecipe } from "./extract";
import { evaluatePosts, type EvaluatedPost } from "./evaluate";
import { FIXTURE_POSTS } from "./fixture";
import { bundledLibrary } from "./library";
import { generateOriginals } from "./originals";
import { CATEGORY_QUOTA, WEEKLY_TARGET } from "./select";
import { originalSlots } from "./slots";
import { sourceCredit } from "./draft";
import { THRESHOLDS } from "./thresholds";
import type { ExtractResult } from "./evaluate";
import type { RecipeCategory } from "./types";

export interface ReportRow {
  sourceKey: string;
  platform: string;
  credit: string;
  url: string;
  transcriptUsed: boolean;
  classification: string;
  title: string | null;
  category: string | null;
  servings: number | null;
  prep_time_mins: number | null;
  cook_time_mins: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  ingredients: string[] | null;
  method: string[] | null;
  tags: string[] | null;
  filter: { decision: string; reasons: string[] } | null;
  duplicateOf: string | null;
  selected: boolean;
  outcome: string;
  note: string | null;
  handle: string;
  fullCaption: boolean;
  transcriptSource: string | null;
}

export interface ImportReport {
  mode: "dry-run" | "live";
  wrote: boolean;
  publishesAutomatically: false;
  library: "bundled-sample" | "supabase";
  weeklyTarget: number;
  quotas: typeof CATEGORY_QUOTA;
  thresholds: typeof THRESHOLDS;
  considered: number;
  selectedCount: number;
  rows: ReportRow[];
  errors: string[];
  inserted?: Array<{ sourceKey: string; id: string; image: string }>;
  imagesBackfilled?: number;
  notification?: string;
  cost?: ImportCost;
  apifyNote?: string;
}

/** When Apify is out of credit or returns nothing, skip creator posts and fill the week with originals. */
export function planWhenApifyUnavailable(scraped: { posts: unknown[]; creditExhausted: boolean }): {
  skipCreators: boolean;
  note: string | null;
  slots: RecipeCategory[];
} {
  const skipCreators = scraped.creditExhausted || scraped.posts.length === 0;
  return {
    skipCreators,
    note: skipCreators ? APIFY_CREDIT_NOTE : null,
    slots: skipCreators ? originalSlots({ breakfast: 0, lunch: 0, dinner: 0, snack: 0 }) : [],
  };
}

function toRow(item: EvaluatedPost): ReportRow {
  const recipe = item.recipe;
  return {
    sourceKey: item.post.sourceKey,
    platform: item.post.platform,
    credit: sourceCredit(item.post),
    url: item.post.url,
    transcriptUsed: !!item.post.transcript?.trim(),
    classification: item.classification,
    title: recipe?.title ?? null,
    category: recipe?.category ?? null,
    servings: recipe?.servings ?? null,
    prep_time_mins: recipe?.prep_time_mins ?? null,
    cook_time_mins: recipe?.cook_time_mins ?? null,
    calories: recipe?.calories ?? null,
    protein_g: recipe?.protein_g ?? null,
    carbs_g: recipe?.carbs_g ?? null,
    fat_g: recipe?.fat_g ?? null,
    ingredients: recipe?.ingredients ?? null,
    method: recipe?.method ?? null,
    tags: recipe?.tags ?? null,
    filter: item.filter,
    duplicateOf: item.duplicateOf,
    selected: item.selected,
    outcome: item.outcome,
    note: item.note,
    handle: item.post.creditHandle,
    fullCaption: hasRecipeBody(item.post.caption || ""),
    transcriptSource: item.post.transcriptSource ?? null,
  };
}

async function parseFixture(_post: unknown, text: string): Promise<ExtractResult> {
  const recipe = extractRecipe(text);
  if (!recipe) return { ok: false, error: "could not parse servings, ingredients, macros, and method" };
  return { ok: true, recipe };
}

export async function buildDryRunReport(): Promise<ImportReport> {
  const evaluated = await evaluatePosts(FIXTURE_POSTS, bundledLibrary(), parseFixture);
  const rows = evaluated.map(toRow);
  return {
    mode: "dry-run",
    wrote: false,
    publishesAutomatically: false,
    library: "bundled-sample",
    weeklyTarget: WEEKLY_TARGET,
    quotas: CATEGORY_QUOTA,
    thresholds: THRESHOLDS,
    considered: rows.length,
    selectedCount: rows.filter((row) => row.selected).length,
    rows,
    errors: [],
  };
}

export function formatSummary(report: ImportReport): string {
  const counts = new Map<string, number>();
  for (const row of report.rows) counts.set(row.outcome, (counts.get(row.outcome) ?? 0) + 1);
  const outcomeBits: string[] = [];
  counts.forEach((count, name) => outcomeBits.push(`${name} ${count}`));
  const lines = [
    report.mode === "dry-run"
      ? "Dry run. Nothing was written. Drafts are never published automatically."
      : `Live import. ${report.inserted?.length ?? 0} unpublished draft(s) written. Nothing was published.`,
    ...(report.apifyNote ? [report.apifyNote] : []),
    `Library: ${report.library === "bundled-sample" ? "bundled sample in lib/recipes.ts (live mode reads public.recipes)" : "public.recipes"}.`,
    `${report.considered} posts considered. ${report.selectedCount} selected for the week (target ${report.weeklyTarget}).`,
    `Outcomes: ${outcomeBits.join(", ") || "none"}.`,
    "",
  ];
  for (const row of report.rows) {
    const macros = row.calories == null ? "" : ` ${row.calories} kcal, ${row.protein_g}p/${row.carbs_g}c/${row.fat_g}f`;
    const title = row.title ? ` ${row.title}` : "";
    const extra = row.duplicateOf ? ` duplicate of "${row.duplicateOf}"` : row.note ? ` — ${row.note}` : "";
    lines.push(
      `${row.selected ? "KEEP" : "skip"}  ${row.outcome.padEnd(22)} ${row.sourceKey.padEnd(22)}${title}${macros}${extra}`,
    );
  }
  if (report.inserted?.length) {
    lines.push("", "Images:");
    for (const item of report.inserted) lines.push(`- ${item.sourceKey}: ${item.image}`);
  }
  if (report.imagesBackfilled) {
    lines.push("", `Photos added to ${report.imagesBackfilled} existing draft(s).`);
  }
  if (report.notification) lines.push(report.notification);
  const rates = creatorRates(
    report.rows.map((row) => ({
      platform: row.platform as "instagram" | "youtube" | "b2s",
      handle: row.handle,
      fullCaption: row.fullCaption,
      passed: row.filter?.decision === "pass",
    })),
  );
  const rateLines = formatCreatorRates(rates);
  if (rateLines.length) lines.push("", ...rateLines);
  const skipped = DEFAULT_CREATORS.instagram.filter((creator) => creator.weight <= 0).map((creator) => `@${creator.handle}`);
  if (skipped.length) lines.push(`Skipped this run (weight 0): ${skipped.join(", ")}.`);
  const borrowed = report.rows.filter((row) => row.transcriptSource === "youtube").length;
  const paid = report.rows.filter((row) => row.transcriptSource === "instagram").length;
  if (borrowed || paid) lines.push(`Transcripts: ${borrowed} from YouTube subtitles, ${paid} from Instagram reels.`);
  const originals = report.rows.filter((row) => row.selected && row.platform === "b2s").length;
  const creatorKept = report.rows.filter((row) => row.selected && row.platform !== "b2s").length;
  if (report.mode === "live") lines.push(`Kept ${creatorKept} from creators and ${originals} Back2Strong originals.`);
  if (report.cost) lines.push(formatCost(report.cost));
  if (report.errors.length) {
    lines.push("", "Errors:");
    for (const error of report.errors) lines.push(`- ${error}`);
  }
  return lines.join("\n");
}

export async function runRecipeImport(options: { dry: boolean }): Promise<ImportReport> {
  if (options.dry) return buildDryRunReport();

  resetImportCost();
  const { prepareLivePosts, loadLiveLibrary, insertDrafts, rewriteForImport, backfillDraftImages } = await import("./live");
  const { leanSwapRecipe } = await import("./lean-swap");
  const backfill = await backfillDraftImages().catch((err: unknown) => ({
    filled: 0,
    skipped: err instanceof Error ? err.message : "photo backfill failed",
  }));
  const scraped = await prepareLivePosts();
  const library = await loadLiveLibrary();
  const apifyPlan = planWhenApifyUnavailable(scraped);
  const evaluated = apifyPlan.skipCreators
    ? []
    : await evaluatePosts(scraped.posts, library, async (_post, text) => rewriteForImport(text), {
        pad: false,
        leanSwap: leanSwapRecipe,
        checkMacros: true,
      });
  if (!apifyPlan.skipCreators) {
    for (const row of evaluated) {
      if (!row.selected || row.filter?.decision !== "flag") continue;
      if (row.recipe?.category !== "breakfast" && row.recipe?.category !== "snack") continue;
      row.selected = false;
      row.outcome = "over_cap";
      row.note = "held back so a Back2Strong original can fill this breakfast or snack slot";
    }
  }
  const counts: Record<RecipeCategory, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const row of evaluated) {
    if (row.selected && row.recipe) counts[row.recipe.category] += 1;
  }
  const originals = await generateOriginals(
    apifyPlan.skipCreators ? apifyPlan.slots : originalSlots(counts),
    [...library.map((entry) => entry.title), ...evaluated.map((row) => row.recipe?.title ?? "")].filter(Boolean),
  );
  evaluated.push(...originals.posts);
  const rows = evaluated.map(toRow);
  const { inserted, errors } = await insertDrafts(evaluated);
  const { notifyDraftsReady } = await import("./notify");
  const notification = await notifyDraftsReady(inserted.length).catch((err: unknown) =>
    err instanceof Error ? err.message : "notification failed",
  );
  const backfillNote = backfill.skipped ? `Photo backfill: ${backfill.skipped}` : "";
  return {
    mode: "live",
    wrote: inserted.length > 0,
    publishesAutomatically: false,
    library: "supabase",
    weeklyTarget: WEEKLY_TARGET,
    quotas: CATEGORY_QUOTA,
    thresholds: THRESHOLDS,
    considered: rows.length,
    selectedCount: rows.filter((row) => row.selected).length,
    rows,
    errors: [...(backfillNote ? [backfillNote] : []), ...scraped.errors, ...originals.errors, ...errors],
    inserted,
    imagesBackfilled: backfill.filled,
    notification,
    cost: importCost(),
    ...(apifyPlan.note ? { apifyNote: apifyPlan.note } : {}),
  };
}
