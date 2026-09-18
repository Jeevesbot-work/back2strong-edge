"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LiveRecipe, RecipeCategory } from "@/lib/recipes-live";
import { CATEGORY_LABEL } from "@/lib/recipes-live";
import {
  SLOTS, DAY_LABELS, DAY_LABELS_LONG, type Plan, type PlanCell,
  weekStartOf, addWeeks, todayDayIndex, emptyPlan, getCell, setCell,
  autoFillWeek, planDayTotals, planToShoppingSources, countFilled,
} from "@/lib/meal-plan";
import WeekShoppingList from "./WeekShoppingList";

const INK = "#12151C";
const CREAM = "#F4EEE2";
const BRASS = "#C9A24B";

interface Props {
  recipes: LiveRecipe[] | null;
  loading: boolean;
  onOpenRecipe: (r: LiveRecipe) => void;
  proteinTarget: number;
  calorieTarget: number;
}

function fmtWeek(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  const end = new Date(d); end.setDate(d.getDate() + 6);
  const f = (x: Date) => x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${f(d)} – ${f(end)}`;
}

export default function WeekPlanner({ recipes, loading, onOpenRecipe, proteinTarget, calorieTarget }: Props) {
  const thisWeek = useMemo(() => weekStartOf(), []);
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [plan, setPlan] = useState<Plan>(emptyPlan());
  const [planLoading, setPlanLoading] = useState(true);
  const [day, setDay] = useState(todayDayIndex());
  const [picker, setPicker] = useState<{ day: number; slot: RecipeCategory } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [building, setBuilding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenSeed, setRegenSeed] = useState(0);
  const [shoppingOpen, setShoppingOpen] = useState(false);

  const byId = useMemo(() => new Map((recipes ?? []).map((r) => [r.id, r])), [recipes]);

  const loadPlan = useCallback(async (ws: string) => {
    setPlanLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: err } = await supabase
        .from("meal_plans").select("day,slot,recipe_id,custom_title")
        .eq("user_id", user.id).eq("week_start", ws);
      if (err) throw err;
      let next = emptyPlan();
      for (const row of (data ?? []) as PlanCell[]) next = setCell(next, row.day, row.slot, row.recipe_id, row.custom_title);
      setPlan(next);
    } catch {
      setError("Couldn't load your week. Pull to refresh or try again.");
    } finally {
      setPlanLoading(false);
    }
  }, []);

  useEffect(() => { loadPlan(weekStart); }, [weekStart, loadPlan]);

  async function saveCells(cells: PlanCell[]) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const now = new Date().toISOString();
    const rows = cells.map((c) => ({ user_id: user.id, week_start: weekStart, day: c.day, slot: c.slot, recipe_id: c.recipe_id, custom_title: c.custom_title, updated_at: now }));
    const { error: err } = await supabase.from("meal_plans").upsert(rows, { onConflict: "user_id,week_start,day,slot" });
    if (err) setError("Couldn't save that change.");
  }

  function choose(d: number, slot: RecipeCategory, recipeId: string | null) {
    const next = setCell(plan, d, slot, recipeId);
    setPlan(next);
    setPicker(null);
    setNote(null);
    void saveCells([getCell(next, d, slot)!]);
  }

  async function fillWeek(regenerate = false) {
    if (!recipes?.length) return;
    const seed = regenerate ? regenSeed + 1 : regenSeed;
    if (regenerate) setRegenSeed(seed);
    const base = regenerate ? emptyPlan() : plan;
    const next = autoFillWeek(base, recipes, seed);
    setPlan(next);
    setNote(regenerate ? "Fresh week built from your library. Swap anything you don't fancy." : "Gaps filled. Tap any meal to swap it.");
    await saveCells(next);
  }

  async function askEdge() {
    const text = instruction.trim();
    if (!text || building) return;
    setBuilding(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/nutrition/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: text, weekStart }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Edge couldn't build that."); return; }
      let next = emptyPlan();
      for (const c of data.plan as PlanCell[]) next = setCell(next, c.day, c.slot, c.recipe_id, c.custom_title);
      setPlan(next);
      setNote(data.note ?? null);
      setInstruction("");
    } catch {
      setError("Lost the connection — try again.");
    } finally {
      setBuilding(false);
    }
  }

  const filled = countFilled(plan);
  const totals = planDayTotals(plan, recipes ?? [], day);

  if (shoppingOpen) {
    return (
      <WeekShoppingList
        sources={planToShoppingSources(plan, recipes ?? [])}
        subtitle={`Week of ${fmtWeek(weekStart)} · ${filled} meals planned`}
        onBack={() => setShoppingOpen(false)}
      />
    );
  }

  return (
    <div className="pb-8">
      {/* Week nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekStart(addWeeks(weekStart, -1))} className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center" aria-label="Previous week">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="text-center">
          <p className="font-condensed font-bold text-xs uppercase tracking-[0.18em]" style={{ color: BRASS }}>{weekStart === thisWeek ? "This week" : weekStart === addWeeks(thisWeek, 1) ? "Next week" : "Week"}</p>
          <p className="text-edge-secondary text-xs mt-0.5">{fmtWeek(weekStart)}</p>
        </div>
        <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center" aria-label="Next week">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Ask Edge */}
      <div className="rounded-2xl border border-white/10 bg-edge-surface p-3 mb-4">
        <p className="font-condensed font-bold text-[11px] uppercase tracking-[0.18em] mb-2" style={{ color: BRASS }}>Ask Edge to build it</p>
        <div className="flex gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void askEdge(); }}
            placeholder={filled ? "e.g. swap Tuesday dinner for chicken" : "e.g. high-protein week, quick dinners"}
            className="flex-1 min-w-0 bg-edge-bg border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-edge-muted outline-none focus:border-white/25"
            disabled={building}
          />
          <button
            onClick={() => void askEdge()}
            disabled={building || !instruction.trim()}
            className="px-4 py-2.5 rounded-xl font-condensed font-bold text-xs uppercase tracking-widest text-edge-bg disabled:opacity-40 flex items-center gap-2"
            style={{ backgroundColor: BRASS }}
          >
            {building && (
            <span className="w-3 h-3 rounded-full border-2 border-edge-bg/30 border-t-edge-bg animate-spin" aria-hidden="true" />
            )}
            {building ? "Building…" : "Build"}          
          </button>
        </div>
        {!building && note && <p className="text-white/80 text-xs leading-relaxed mt-2.5">{note}</p>}
        {!building && error && <p className="text-edge-red text-xs mt-2.5">{error}</p>}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => void fillWeek(filled > 0)} disabled={!recipes?.length || planLoading} className="flex-1 py-2.5 rounded-xl font-condensed font-bold text-xs uppercase tracking-widest text-white bg-edge-surface border border-white/10 disabled:opacity-40">
          {filled === 0 ? "Fill my week" : "Regenerate week"}
        </button>
        <button onClick={() => setShoppingOpen(true)} disabled={filled === 0} className="flex-1 py-2.5 rounded-xl font-condensed font-bold text-xs uppercase tracking-widest text-white bg-edge-surface border border-white/10 disabled:opacity-40">
          Shopping list
        </button>
      </div>

      {/* Day strip */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {DAY_LABELS.map((label, i) => {
          const t = planDayTotals(plan, recipes ?? [], i);
          const active = i === day;
          const isToday = weekStart === thisWeek && i === todayDayIndex();
          return (
            <button key={label} onClick={() => setDay(i)} className="rounded-xl py-2 flex flex-col items-center gap-1 border transition-all"
              style={{ backgroundColor: active ? BRASS : INK, borderColor: active ? BRASS : isToday ? "rgba(201,162,75,0.5)" : "rgba(255,255,255,0.08)" }}>
              <span className="font-condensed font-bold text-[11px] uppercase tracking-wide" style={{ color: active ? "#0E1014" : CREAM }}>{label}</span>
              <span className="text-[10px]" style={{ color: active ? "rgba(14,16,20,0.7)" : t.protein ? "#9BA3AF" : "#3D434D" }}>{t.protein ? `${t.protein}g` : "·"}</span>
            </button>
          );
        })}
      </div>

      {/* Day header + totals */}
      <div className="flex items-end justify-between mb-3">
        <h2 className="font-display font-semibold text-xl" style={{ color: CREAM }}>{DAY_LABELS_LONG[day]}</h2>
        <p className="text-xs text-edge-secondary">
          <span style={{ color: totals.protein >= proteinTarget ? "#34D399" : CREAM }}>{totals.protein}g</span> / {proteinTarget}g protein · {totals.calories} / {calorieTarget} kcal
        </p>
      </div>

      {/* Slots */}
      {planLoading || loading ? (
        <div className="space-y-2">{SLOTS.map((s) => <div key={s} className="h-[72px] rounded-2xl bg-edge-surface/60 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {SLOTS.map((slot) => {
            const cell = getCell(plan, day, slot);
            const r = cell?.recipe_id ? byId.get(cell.recipe_id) : undefined;
            return (
              <div key={slot} className="rounded-2xl border border-white/[0.08] overflow-hidden" style={{ backgroundColor: INK }}>
                <div className="flex items-stretch">
                  {r?.image_url && (
                <button onClick={() => onOpenRecipe(r)} className="flex-shrink-0 w-[72px] overflow-hidden">
                <img src={r.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
                )}<button onClick={() => (r ? onOpenRecipe(r) : setPicker({ day, slot }))} className="flex-1 min-w-0 text-left px-4 py-3">
                    <p className="font-condensed font-bold text-[10px] uppercase tracking-[0.18em]" style={{ color: BRASS }}>{CATEGORY_LABEL[slot]}</p>
                    {r ? (
                      <>
                        <p className="text-sm text-white/90 leading-snug mt-1 truncate">{r.title}</p>
                        <p className="text-[11px] text-edge-muted mt-0.5">{r.protein_g ?? "?"}g protein · {r.calories ?? "?"} kcal</p>
                      </>
                    ) : (
                      <p className="text-sm text-edge-muted mt-1">Tap to choose</p>
                    )}
                  </button>
                  {r && (
                    <button onClick={() => setPicker({ day, slot })} className="px-4 border-l border-white/[0.08] font-condensed font-bold text-[11px] uppercase tracking-widest text-edge-secondary">
                      Swap
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Picker sheet */}
      {picker && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setPicker(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative w-full max-w-lg mx-auto bg-edge-bg rounded-t-3xl border-t border-white/10 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/[0.08]">
              <div>
                <p className="font-condensed font-bold text-[11px] uppercase tracking-[0.18em]" style={{ color: BRASS }}>{DAY_LABELS_LONG[picker.day]} · {CATEGORY_LABEL[picker.slot]}</p>
                <p className="text-white/80 text-sm mt-0.5">Pick a meal</p>
              </div>
              {getCell(plan, picker.day, picker.slot)?.recipe_id && (
                <button onClick={() => choose(picker.day, picker.slot, null)} className="text-xs text-edge-red">Remove</button>
              )}
            </div>
            <div className="overflow-y-auto px-4 py-3 space-y-2 pb-8">
              {(recipes ?? []).filter((r) => r.category === picker.slot).map((r) => (
                <button key={r.id} onClick={() => choose(picker.day, picker.slot, r.id)} className="w-full text-left rounded-xl px-4 py-3 border border-white/[0.08]" style={{ backgroundColor: INK }}>
                  <p className="text-sm text-white/90 leading-snug">{r.title}</p>
                  <p className="text-[11px] text-edge-muted mt-0.5">{r.protein_g ?? "?"}g protein · {r.calories ?? "?"} kcal{r.prep_time_mins != null ? ` · ${(r.prep_time_mins ?? 0) + (r.cook_time_mins ?? 0)} min` : ""}</p>
                </button>
              ))}
              {(recipes ?? []).filter((r) => r.category === picker.slot).length === 0 && (
                <p className="text-edge-muted text-sm text-center py-6">No {CATEGORY_LABEL[picker.slot].toLowerCase()} recipes in the library yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
