import Link from "next/link";
import { isAuthorisedAdmin } from "@/lib/admin/auth";
import { buildDryRunReport } from "@/lib/recipe-import/run";
import { createServiceClient } from "@/lib/supabase/service";
import ReviewActions from "./ReviewActions";

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

function Macro({ value, label }: { value: number | null; label: string }) {
  return (
    <div style={{ background: "#111318", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, color: S.text, margin: 0 }}>{value ?? "–"}</p>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: S.sub, margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
    </div>
  );
}

export default async function PendingRecipesPage() {
  if (!(await isAuthorisedAdmin())) {
    return (
      <div style={{ minHeight: "100svh", background: S.bg, color: S.text, padding: 32 }}>
        <p style={{ fontFamily: "Inter, sans-serif" }}>Not authorised.</p>
      </div>
    );
  }

  const preview = process.env.RECIPE_REVIEW_PREVIEW === "1";
  let recipes: PendingRecipe[] = [];
  let error: string | null = null;
  try {
    recipes = preview ? await loadPreview() : await loadPending();
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load drafts";
  }

  return (
    <div style={{ minHeight: "100svh", background: S.bg, padding: "32px 20px 80px", maxWidth: 720, margin: "0 auto" }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {recipes.map((recipe) => {
          const flagged = recipe.import_status === "flagged";
          return (
            <article key={recipe.id} style={{ background: S.surface, border: `1px solid ${flagged ? "rgba(251,191,36,0.45)" : S.border}`, borderRadius: 16, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: S.bronze, textTransform: "uppercase", letterSpacing: "0.14em", margin: 0 }}>
                  {recipe.category}
                </p>
                {flagged && (
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, color: S.amber, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Fat review
                  </span>
                )}
              </div>
              <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 24, color: S.text, fontWeight: 500, margin: "6px 0 8px" }}>{recipe.title}</h2>
              {recipe.description && (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: S.sub, lineHeight: 1.5, marginTop: 0 }}>{recipe.description}</p>
              )}
              {recipe.image_url && (
                <img src={recipe.image_url} alt="" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, margin: "12px 0" }}>
                <Macro value={recipe.calories} label="kcal" />
                <Macro value={recipe.protein_g} label="protein" />
                <Macro value={recipe.carbs_g} label="carbs" />
                <Macro value={recipe.fat_g} label="fat" />
              </div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: S.sub, marginTop: 0 }}>
                Per serving
                {recipe.servings != null ? ` · serves ${recipe.servings}` : ""}
                {recipe.prep_time_mins ? ` · ${recipe.prep_time_mins} min prep` : ""}
                {recipe.cook_time_mins ? ` · ${recipe.cook_time_mins} min cook` : ""}
              </p>
              {flagged && recipe.review_note && (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: S.amber, lineHeight: 1.45 }}>{recipe.review_note}</p>
              )}
              {recipe.ingredients.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: S.sub, textTransform: "uppercase", letterSpacing: "0.12em" }}>Ingredients</p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {recipe.ingredients.map((item) => (
                      <li key={item} style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: S.text, lineHeight: 1.45 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {recipe.method.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: S.sub, textTransform: "uppercase", letterSpacing: "0.12em" }}>Method</p>
                  <ol style={{ margin: 0, paddingLeft: 18 }}>
                    {recipe.method.map((step) => (
                      <li key={step} style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: S.text, lineHeight: 1.45, marginBottom: 4 }}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              {recipe.source_credit && (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: S.sub }}>
                  {recipe.source_credit}{" "}
                  {recipe.source_url && (
                    <a href={recipe.source_url} style={{ color: S.bronze }}>Source</a>
                  )}
                </p>
              )}
              <ReviewActions id={recipe.id} preview={preview} />
            </article>
          );
        })}
      </div>
    </div>
  );
}
