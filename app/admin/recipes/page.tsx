import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { buildDryRunReport } from "@/lib/recipe-import/run";
import { createServiceClient } from "@/lib/supabase/service";
import ApproveAll from "./ApproveAll";
import RecipeCard from "./RecipeCard";

export const dynamic = "force-dynamic";

const S = {
  bg: "#0E1014",
  surface: "#171B21",
  border: "#252A32",
  bronze: "#C8965A",
  text: "#F2F1ED",
  sub: "#9BA3AF",
  amber: "#FBBF24",
};

interface PendingRecipe {
  id: string;
  title: string;
  category: string;
  description: string | null;
  servings: number | null;
  prep_time_mins: number | null;
  cook_time_mins: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  ingredients: string[];
  method: string[];
  tags: string[] | null;
  image_url: string | null;
  source_credit: string | null;
  source_url: string | null;
  import_status: string | null;
  review_note: string | null;
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function loadPending(): Promise<PendingRecipe[]> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("recipes")
    .select("id, title, category, description, servings, prep_time_mins, cook_time_mins, calories, protein_g, carbs_g, fat_g, ingredients, method, tags, image_url, source_credit, source_url, import_status, review_note, imported_at")
    .eq("published", false)
    .or("import_status.is.null,import_status.eq.draft,import_status.eq.flagged")
    .order("imported_at", { ascending: false, nullsFirst: false });
  if (error) {
    if (/source_credit|import_status|review_note/i.test(error.message)) {
      throw new Error("Apply lib/supabase/migrations/0013_recipe_drafts.sql in the Supabase SQL editor before using this screen. It has not been run automatically.");
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Untitled"),
    category: String(row.category ?? ""),
    description: row.description ?? null,
    servings: row.servings ?? null,
    prep_time_mins: row.prep_time_mins ?? null,
    cook_time_mins: row.cook_time_mins ?? null,
    calories: row.calories ?? null,
    protein_g: row.protein_g ?? null,
    carbs_g: row.carbs_g ?? null,
    fat_g: row.fat_g ?? null,
    ingredients: asStrings(row.ingredients),
    method: asStrings(row.method),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : null,
    image_url: row.image_url ?? null,
    source_credit: row.source_credit ?? null,
    source_url: row.source_url ?? null,
    import_status: row.import_status ?? null,
    review_note: row.review_note ?? null,
  }));
}

async function loadPreview(): Promise<PendingRecipe[]> {
  const report = await buildDryRunReport();
  return report.rows.filter((row) => row.selected).map((row) => ({
    id: row.sourceKey,
    title: row.title ?? "Untitled",
    category: row.category ?? "",
    description: null,
    servings: row.servings,
    prep_time_mins: row.prep_time_mins,
    cook_time_mins: row.cook_time_mins,
    calories: row.calories,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    ingredients: row.ingredients ?? [],
    method: row.method ?? [],
    tags: row.tags,
    image_url: null,
    source_credit: row.credit,
    source_url: row.url,
    import_status: row.outcome === "flagged_draft" ? "flagged" : "draft",
    review_note: row.outcome === "flagged_draft" ? row.note : null,
  }));
}

export default async function PendingRecipesPage() {
  await requireAdminPage();

  const preview = process.env.RECIPE_REVIEW_PREVIEW === "1";
  let recipes: PendingRecipe[] = [];
  let error: string | null = null;
  try {
    recipes = preview ? await loadPreview() : await loadPending();
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load drafts";
  }

  return (
    <div style={{ minHeight: "100svh", background: S.bg, padding: "20px 16px 80px", maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: S.bronze, textTransform: "uppercase", letterSpacing: "0.18em" }}>
        Back2Strong · Admin
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, margin: "4px 0 8px" }}>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 30, color: S.text, fontWeight: 400, margin: 0 }}>Pending recipes</h1>
        <Link href="/admin" style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: S.sub, textDecoration: "none", flexShrink: 0 }}>
          ← Command Centre
        </Link>
      </div>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: S.sub, lineHeight: 1.5, marginTop: 0 }}>
        Drafts from the weekly import. Approving is the only way a recipe reaches clients.
      </p>

      {preview && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: S.amber, marginTop: 0 }}>
          Showing the dry-run fixture, not the live library.
        </p>
      )}

      {error && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 20 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#F87171", lineHeight: 1.5, margin: 0 }}>{error}</p>
        </div>
      )}

      {!error && recipes.length === 0 && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 24, textAlign: "center" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: S.sub, lineHeight: 1.6, margin: 0 }}>
            No drafts waiting. Monday&apos;s import writes unpublished recipes here.
          </p>
        </div>
      )}

      {!error && recipes.length > 0 && (
        <ApproveAll count={recipes.filter((recipe) => recipe.import_status !== "flagged").length} preview={preview} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} preview={preview} />
        ))}
      </div>
    </div>
  );
}
