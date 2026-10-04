"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["breakfast", "lunch", "dinner", "snack"] as const;

export interface CardRecipe {
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
  import_status: string | null;
  review_note: string | null;
}

const button = (primary: boolean, disabled: boolean): CSSProperties => ({
  flex: 1,
  minHeight: 48,
  background: primary ? "#34D399" : "transparent",
  color: primary ? "#0E1014" : "#F2F1ED",
  border: primary ? "none" : "1px solid #252A32",
  borderRadius: 12,
  padding: "12px 14px",
  fontFamily: "Inter, sans-serif",
  fontSize: 16,
  fontWeight: 700,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.6 : 1,
});

function summary(recipe: CardRecipe): string {
  const text = (recipe.description ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= 140) return text;
  return `${text.slice(0, 137).trim()}…`;
}

function methodLines(text: string): string[] {
  return text
    .split(/\n/)
    .map((line) => line.replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
}

export default function RecipeCard({ recipe, preview }: { recipe: CardRecipe; preview?: boolean }) {
  const router = useRouter();
  const flagged = recipe.import_status === "flagged";
  const [title, setTitle] = useState(recipe.title);
  const [category, setCategory] = useState(recipe.category);
  const [methodText, setMethodText] = useState(recipe.method.join("\n"));
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const minutes = (recipe.prep_time_mins ?? 0) + (recipe.cook_time_mins ?? 0);
  const methodUnchanged = methodLines(methodText).join("\n") === recipe.method.join("\n");
  const unchanged = title === recipe.title && category === recipe.category && methodUnchanged;

  async function post(body: Record<string, unknown>, key: string) {
    if (preview) return;
    setLoading(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof payload.error === "string" ? payload.error : "Could not update this draft");
        setLoading(null);
        return;
      }
      if (key === "edit") setLoading(null);
      router.refresh();
    } catch {
      setError("Could not update this draft");
      setLoading(null);
    }
  }

  return (
    <article style={{ background: "#171B21", border: `1px solid ${flagged ? "rgba(251,191,36,0.45)" : "#252A32"}`, borderRadius: 16, overflow: "hidden" }}>
      {recipe.image_url ? (
        <img src={recipe.image_url} alt="" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ height: 140, background: "#111318", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#9BA3AF" }}>Photo not ready</span>
        </div>
      )}
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
            {category}
          </p>
          {flagged && (
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700, color: "#FBBF24", textTransform: "uppercase" }}>
              Fat review
            </span>
          )}
        </div>
        <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, color: "#F2F1ED", fontWeight: 500, margin: "6px 0 8px", lineHeight: 1.25 }}>{title}</h2>
        {summary(recipe) && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 15, color: "#9BA3AF", lineHeight: 1.45, margin: "0 0 12px" }}>{summary(recipe)}</p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            [recipe.calories, "kcal"],
            [recipe.protein_g, "protein"],
            [recipe.carbs_g, "carbs"],
            [recipe.fat_g, "fat"],
          ].map(([value, label]) => (
            <div key={String(label)} style={{ background: "#111318", borderRadius: 10, padding: "10px 4px", textAlign: "center" }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 16, fontWeight: 700, color: "#F2F1ED", margin: 0 }}>{value ?? "–"}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#9BA3AF", margin: "2px 0 0", textTransform: "uppercase" }}>{label}</p>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#9BA3AF", margin: "10px 0" }}>
          Per serving
          {recipe.servings != null ? ` · serves ${recipe.servings}` : ""}
          {minutes > 0 ? ` · ${minutes} min` : ""}
          {recipe.tags?.length ? ` · ${recipe.tags.slice(0, 3).join(", ")}` : ""}
        </p>
        {flagged && recipe.review_note && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#FBBF24", lineHeight: 1.45 }}>{recipe.review_note}</p>
        )}
        {recipe.ingredients.length > 0 && (
          <details>
            <summary style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#C8965A", cursor: "pointer" }}>
              {recipe.ingredients.length} ingredients
            </summary>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {recipe.ingredients.map((item) => (
                <li key={item} style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#F2F1ED", lineHeight: 1.45 }}>{item}</li>
              ))}
            </ul>
          </details>
        )}
        {recipe.method.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#C8965A", cursor: "pointer" }}>
              {recipe.method.length} {recipe.method.length === 1 ? "step" : "steps"}
            </summary>
            <ol style={{ margin: "8px 0 0", paddingLeft: 22 }}>
              {recipe.method.map((step, index) => (
                <li key={`${index}-${step}`} style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#F2F1ED", lineHeight: 1.45, paddingLeft: 4, marginBottom: 6 }}>{step}</li>
              ))}
            </ol>
          </details>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Title"
            style={{ width: "100%", boxSizing: "border-box", background: "#111318", color: "#F2F1ED", border: "1px solid #252A32", borderRadius: 12, padding: "12px 14px", fontSize: 16, fontFamily: "Inter, sans-serif" }}
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Category"
            style={{ width: "100%", background: "#111318", color: "#F2F1ED", border: "1px solid #252A32", borderRadius: 12, padding: "12px 14px", fontSize: 16, fontFamily: "Inter, sans-serif" }}
          >
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <label style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#9BA3AF" }}>
            Method, one step per line
            <textarea
              value={methodText}
              onChange={(event) => setMethodText(event.target.value)}
              aria-label="Method"
              rows={Math.min(8, Math.max(4, recipe.method.length + 1))}
              style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, background: "#111318", color: "#F2F1ED", border: "1px solid #252A32", borderRadius: 12, padding: "12px 14px", fontSize: 16, fontFamily: "Inter, sans-serif", lineHeight: 1.45, resize: "vertical" }}
            />
          </label>
          <button
            type="button"
            disabled={!!loading || preview || unchanged}
            onClick={() => {
              const method = methodLines(methodText);
              if (method.length < 3) {
                setError("Add at least 3 method steps, one per line");
                return;
              }
              void post({ id: recipe.id, action: "edit", title, category, method }, "edit");
            }}
            style={{ ...button(false, !!loading || !!preview), flex: "none" }}
          >
            {loading === "edit" ? "Saving..." : "Save title, category and method"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" disabled={!!loading || preview} onClick={() => post({ id: recipe.id, action: "approve" }, "approve")} style={button(true, !!loading || !!preview)}>
            {loading === "approve" ? "Publishing..." : "Approve"}
          </button>
          <button
            type="button"
            disabled={!!loading || preview}
            onClick={() => {
              if (preview) return;
              if (!window.confirm("Reject this draft? It stays unpublished, and the same post will not be imported again.")) return;
              void post({ id: recipe.id, action: "reject" }, "reject");
            }}
            style={button(false, !!loading || !!preview)}
          >
            {loading === "reject" ? "Rejecting..." : "Reject"}
          </button>
        </div>
        {recipe.source_credit && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#9BA3AF", margin: "12px 0 0" }}>{recipe.source_credit}</p>
        )}
        {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#F87171", margin: "8px 0 0" }}>{error}</p>}
      </div>
    </article>
  );
}
