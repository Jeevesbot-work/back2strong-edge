"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LiveRecipe } from "@/lib/recipes-live";
import { DAY_LABELS_LONG, weekStartOf, addWeeks, todayDayIndex } from "@/lib/meal-plan";
import type { ShoppingListSource } from "@/lib/shopping-list";
import WeekShoppingList from "./WeekShoppingList";

// One job: "tell me what to eat for dinner this week to hit my protein, and give
// me the shopping list." Seven dinners, one tap to build, swap or mark a night
// out, and an aisle-grouped list to share.

const C = { panel: "#171B21", line: "#252A32", text: "#F2F1ED", sub: "#9BA3AF", bronze: "#C8965A", bronzeHi: "#E3B887", green: "#4ADE80", bg: "#0E1014" };
const cond = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const OUT = "Eating out";
const MIN_PROTEIN = 30;
// How the day's targets are split. Dinner carries the biggest share.
const SPLIT = [
  { key: "Breakfast", share: 0.25 },
  { key: "Lunch", share: 0.25 },
  { key: "Dinner", share: 0.35 },
  { key: "Shake / snack", share: 0.15 },
];
const DINNER_SHARE = 0.35;
/** Servings of a recipe needed to hit the dinner protein target, in half-portion steps (1–3). */
const portionFor = (r: LiveRecipe, dinnerP: number) => Math.min(3, Math.max(1, Math.round((dinnerP / Math.max(1, r.protein_g ?? 1)) * 2) / 2));
const density = (r: LiveRecipe) => (r.protein_g ?? 0) / Math.max(1, r.calories ?? 1);

type Night = { recipe_id: string | null; out: boolean; leftover?: boolean };
const LEFT = "Leftovers";

interface Props {
  recipes: LiveRecipe[] | null;
  loading: boolean;
  onOpenRecipe: (r: LiveRecipe) => void;
  proteinTarget: number;
  calorieTarget: number;
}

const isFish = (r: LiveRecipe) => (r.tags ?? []).some((t) => /fish|seafood|salmon|prawn|mackerel|tuna|cod/i.test(t)) || /salmon|prawn|mackerel|tuna|cod|fish/i.test(r.title);
const proteinType = (r: LiveRecipe) => {
  const s = `${r.title} ${(r.tags ?? []).join(" ")}`.toLowerCase();
  if (isFish(r)) return "fish";
  for (const k of ["chicken", "turkey", "beef", "steak", "pork", "sausage", "lamb"]) if (s.includes(k)) return k === "steak" ? "beef" : k;
  return "other";
};
const mins = (r: LiveRecipe) => (r.prep_time_mins ?? 0) + (r.cook_time_mins ?? 0);

function rng(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

/**
 * Cook once, eat twice. Four cooks cover the week: two batch cooks each give a
 * second night of leftovers, a quick fish night on Friday, a Sunday cook, and
 * Saturday left free for a flex meal. Four recipes = a shopping list you can use.
 *   Mon cook A · Tue leftovers A · Wed cook B · Thu leftovers B · Fri fish · Sat out · Sun cook C
 */
function buildWeek(pool: LiveRecipe[], seed: number): Night[] {
  const r = rng(seed + 1);
  const jitter = (a: LiveRecipe, b: LiveRecipe) => (density(b) - density(a)) * 100 + (r() - 0.5) * 3;
  const batch = pool.filter((x) => (x.servings ?? 1) >= 4 && !isFish(x)).sort(jitter);
  const fish = pool.filter(isFish).sort(jitter);
  const any = [...pool].sort(jitter);
  const used = new Set<string>();
  const take = (list: LiveRecipe[], avoid?: string | null) => {
    const pick = list.find((x) => !used.has(x.id) && proteinType(x) !== avoid) ?? list.find((x) => !used.has(x.id)) ?? any.find((x) => !used.has(x.id));
    if (pick) used.add(pick.id);
    return pick?.id ?? null;
  };
  const a = take(batch);
  const b = take(batch, a ? proteinType(pool.find((x) => x.id === a)!) : null);
  const f = take(fish.length ? fish : any);
  const c = take(batch.length > 2 ? batch : any);
  return [
    { recipe_id: a, out: false }, { recipe_id: a, out: false, leftover: true },
    { recipe_id: b, out: false }, { recipe_id: b, out: false, leftover: true },
    { recipe_id: f, out: false }, { recipe_id: null, out: true },
    { recipe_id: c, out: false },
  ];
}

const PANTRY = /^(salt|black pepper|pepper|salt and (black )?pepper|salt & black pepper|olive oil|oil|cooking oil spray|spray oil|garlic powder|onion powder|smoked paprika|paprika|ground cumin|cumin|dried oregano|oregano|chilli flakes|cayenne pepper|mixed herbs|soy sauce|low salt soy sauce|salt-reduced soy sauce|cornflour|cornstarch|honey|sesame oil|sesame seeds|ground coriander|coriander|turmeric|cinnamon|ground cloves)$/i;
const stripQty = (s: string) => s.replace(/\(.*?\)/g, "").replace(/^[\d./\s]*(x\s*)?\d*\s*(g|kg|ml|l|tsp|tbsp|cups?|oz|lb)?\s+/i, "").replace(/,.*$/, "").trim();

function fmtWeek(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  const end = new Date(d); end.setDate(d.getDate() + 6);
  const f = (x: Date) => x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${f(d)} – ${f(end)}`;
}

export default function DinnerPlanner({ recipes, loading, onOpenRecipe, proteinTarget, calorieTarget }: Props) {
  const dinnerP = Math.round(proteinTarget * DINNER_SHARE);
  const dinnerK = Math.round(calorieTarget * DINNER_SHARE);
  const thisWeek = useMemo(() => weekStartOf(), []);
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [nights, setNights] = useState<Night[] | null>(null);
  const [seed, setSeed] = useState(0);
  const [shopping, setShopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayDayIndex();

  const pool = useMemo(() => (recipes ?? []).filter((r) => r.category === "dinner" && (r.protein_g ?? 0) >= MIN_PROTEIN), [recipes]);
  const byId = useMemo(() => new Map((recipes ?? []).map((r) => [r.id, r])), [recipes]);

  const load = useCallback(async (ws: string) => {
    setNights(null); setError(null);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data, error: err } = await sb.from("meal_plans").select("day,recipe_id,custom_title").eq("user_id", user.id).eq("week_start", ws).eq("slot", "dinner");
      if (err) throw err;
      const n: Night[] = Array.from({ length: 7 }, () => ({ recipe_id: null, out: false }));
      for (const row of data ?? []) n[row.day] = { recipe_id: row.recipe_id, out: row.custom_title === OUT, leftover: row.custom_title === LEFT };
      setNights(n);
    } catch { setError("Couldn't load your week. Try again in a moment."); setNights(Array.from({ length: 7 }, () => ({ recipe_id: null, out: false }))); }
  }, []);
  useEffect(() => { load(weekStart); }, [weekStart, load]);

  async function save(next: Night[], days: number[]) {
    setNights(next);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const now = new Date().toISOString();
    const rows = days.map((d) => ({ user_id: user.id, week_start: weekStart, day: d, slot: "dinner", recipe_id: next[d].out ? null : next[d].recipe_id, custom_title: next[d].out ? OUT : next[d].leftover ? LEFT : null, updated_at: now }));
    const { error: err } = await sb.from("meal_plans").upsert(rows, { onConflict: "user_id,week_start,day,slot" });
    if (err) setError("Couldn't save that change.");
  }

  function build(fresh: boolean) {
    const s = fresh ? seed + 1 : seed;
    setSeed(s);
    save(buildWeek(pool, s), [0, 1, 2, 3, 4, 5, 6]);
  }

  function swap(d: number) {
    if (!nights) return;
    const src = nights[d].leftover && d > 0 ? d - 1 : d; // swapping leftovers swaps the cook night behind them
    const cur = nights[src].recipe_id;
    const used = new Set(nights.map((n) => n.recipe_id).filter(Boolean) as string[]);
    const ranked = [...pool].sort((a, b) => (b.protein_g ?? 0) - (a.protein_g ?? 0));
    const start = Math.max(0, ranked.findIndex((r) => r.id === cur));
    let pick: LiveRecipe | undefined;
    for (let k = 1; k <= ranked.length; k++) { const c = ranked[(start + k) % ranked.length]; if (!used.has(c.id)) { pick = c; break; } }
    pick ??= ranked[(start + 1) % ranked.length];
    const linked = nights[src + 1]?.leftover ? src + 1 : -1;
    const next = nights.map((n, i) => (i === src ? { recipe_id: pick!.id, out: false } : i === linked ? { ...n, recipe_id: pick!.id } : n));
    save(next, linked >= 0 ? [src, linked] : [src]);
  }

  function toggleOut(d: number) {
    if (!nights) return;
    const next = nights.map((n, i) => (i === d ? { out: !n.out, leftover: false, recipe_id: n.out ? n.recipe_id ?? pool[0]?.id ?? null : n.recipe_id } : n));
    save(next, [d]);
  }

  const planned = (nights ?? []).map((n) => (!n.out && n.recipe_id ? byId.get(n.recipe_id) : undefined));
  const cooking = planned.filter(Boolean) as LiveRecipe[];
  const avgP = cooking.length ? Math.round(cooking.reduce((s, r) => s + (r.protein_g ?? 0) * portionFor(r, dinnerP), 0) / cooking.length) : 0;
  const avgK = cooking.length ? Math.round(cooking.reduce((s, r) => s + (r.calories ?? 0) * portionFor(r, dinnerP), 0) / cooking.length) : 0;
  const rest = Math.max(0, proteinTarget - avgP);
  const cookNights = (nights ?? []).map((n, i) => (!n.out && !n.leftover && n.recipe_id ? byId.get(n.recipe_id) : undefined)).filter(Boolean) as LiveRecipe[];
  const pantrySet = new Set<string>();
  const batchesFor = (r: LiveRecipe) => {
    const nightsEaten = (nights ?? []).filter((n) => !n.out && n.recipe_id === r.id).length || 1;
    return Math.max(1, Math.ceil((portionFor(r, dinnerP) * nightsEaten) / Math.max(1, r.servings ?? 1)));
  };
  const sources: ShoppingListSource[] = cookNights.flatMap((r) => Array.from({ length: batchesFor(r) }, () => r)).map((r) => ({
    recipeTitle: r.title,
    ingredients: (r.ingredients ?? []).filter((ing) => {
      const core = stripQty(ing);
      if (PANTRY.test(core)) { pantrySet.add(core.toLowerCase().replace(/^./, (c) => c.toUpperCase())); return false; }
      return !/^for the .*:$/i.test(ing.trim());
    }),
  }));
  const pantry = Array.from(pantrySet).sort();
  const empty = !!nights && nights.every((n) => !n.recipe_id && !n.out);
  const fishCount = cooking.filter(isFish).length;

  if (shopping) {
    return <WeekShoppingList sources={sources} pantry={pantry} subtitle={`Dinners · ${fmtWeek(weekStart)} · ${cookNights.length} cooks`} onBack={() => setShopping(false)} />;
  }

  if (loading || !recipes || !nights) {
    return <p className="text-edge-secondary text-sm py-10 text-center">Loading your dinners…</p>;
  }

  return (
    <div className="pb-28">
      {/* Week nav */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setWeekStart(addWeeks(weekStart, -1))} aria-label="Previous week" className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center text-white">‹</button>
        <div className="text-center">
          <p style={{ fontFamily: cond, fontWeight: 600, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: C.bronze }}>
            {weekStart === thisWeek ? "This week" : weekStart === addWeeks(thisWeek, 1) ? "Next week" : "Week of"}
          </p>
          <p className="text-edge-secondary text-xs mt-0.5">{fmtWeek(weekStart)}</p>
        </div>
        <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} aria-label="Next week" className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center text-white">›</button>
      </div>

      <h2 style={{ fontFamily: cond, fontWeight: 700, fontSize: 34, lineHeight: 1, textTransform: "uppercase", color: C.text }}>Dinners this week</h2>
      <p className="text-edge-secondary text-sm mt-2 leading-relaxed">Cook four times, eat well all week. Swap anything you don&apos;t fancy, then take the shopping list.</p>

      {error && <p className="text-sm mt-3" style={{ color: "#F0714F" }}>{error}</p>}

      {empty ? (
        <button onClick={() => build(false)} disabled={!pool.length}
          style={{ marginTop: 20, width: "100%", background: C.bronze, color: C.bg, fontFamily: cond, fontWeight: 700, fontSize: 20, letterSpacing: "0.12em", textTransform: "uppercase", padding: "17px 0", borderRadius: 16, border: "none", cursor: "pointer" }}>
          Build my week
        </button>
      ) : (
        <>
          {/* The day, and what dinner has to carry */}
          <div style={{ marginTop: 18, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16 }}>
            <div className="flex items-baseline justify-between">
              <p style={{ fontFamily: cond, fontWeight: 600, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: C.sub }}>Your day</p>
              <p style={{ fontFamily: cond, fontWeight: 700, fontSize: 20, color: C.text }}>{proteinTarget}g protein <span style={{ color: C.sub, fontWeight: 600, fontSize: 14 }}>· {calorieTarget.toLocaleString("en-GB")} kcal</span></p>
            </div>
            <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
              {SPLIT.map((x) => (
                <div key={x.key} style={{ flex: x.share, minWidth: 0 }}>
                  <div style={{ height: 8, borderRadius: 99, background: x.key === "Dinner" ? `linear-gradient(90deg, #A8743D, ${C.bronzeHi})` : C.line }} />
                  <p style={{ fontSize: 10, color: x.key === "Dinner" ? C.bronzeHi : C.sub, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.key}</p>
                  <p style={{ fontFamily: cond, fontWeight: 700, fontSize: 16, color: C.text }}>{Math.round(proteinTarget * x.share)}g</p>
                </div>
              ))}
            </div>
            <p className="text-edge-secondary text-xs mt-3 leading-relaxed">
              Dinner is sized to <b className="text-white">about {dinnerP}g protein and {dinnerK} kcal</b>. This week averages <b className="text-white">{avgP}g · {avgK} kcal</b>.
              {fishCount < 2 && <> Only {fishCount} fish dinner{fishCount === 1 ? "" : "s"}, so add salmon, mackerel or tuna at lunch.</>}
            </p>
          </div>

          {/* Seven nights */}
          <div className="flex flex-col gap-2.5 mt-4">
            {nights.map((n, d) => {
              const r = planned[d];
              const isToday = weekStart === thisWeek && d === today;
              return (
                <div key={d} style={{ background: C.panel, border: `1px solid ${isToday ? "rgba(200,150,90,0.45)" : C.line}`, borderRadius: 18, overflow: "hidden", display: "flex", opacity: n.out ? 0.6 : 1 }}>
                  <button onClick={() => r && onOpenRecipe(r)} disabled={!r} aria-label={r ? `Open ${r.title}` : undefined}
                    style={{ width: 92, flexShrink: 0, position: "relative", background: "#1D222A", border: "none", padding: 0, cursor: r ? "pointer" : "default" }}>
                    {r?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                    ) : (
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: cond, fontWeight: 700, fontSize: 22, color: C.bronze, background: "radial-gradient(circle at 30% 20%, rgba(200,150,90,0.18), transparent 70%)" }}>
                        {n.out ? "OUT" : DAY_LABELS_LONG[d].slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </button>
                  <div style={{ flex: 1, minWidth: 0, padding: "12px 14px" }}>
                    <p style={{ fontFamily: cond, fontWeight: 600, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: isToday ? C.bronze : C.sub }}>
                      {DAY_LABELS_LONG[d]}{n.leftover && !n.out ? " · leftovers, no cooking" : ""}{isToday ? " · tonight" : ""}
                    </p>
                    <button onClick={() => r && onOpenRecipe(r)} disabled={!r} className="text-left block w-full" style={{ background: "none", border: "none", padding: 0, cursor: r ? "pointer" : "default" }}>
                      <p style={{ color: C.text, fontWeight: 600, fontSize: 15, lineHeight: 1.25, marginTop: 3 }}>{n.out ? "Night off · flex meal" : r ? r.title : "Nothing planned"}</p>
                    </button>
                    {r && !n.out && (
                      <p style={{ fontSize: 12, color: C.bronzeHi, marginTop: 4 }}>
                        {Math.round((r.protein_g ?? 0) * portionFor(r, dinnerP))}g protein <span style={{ color: C.sub }}>· {Math.round((r.calories ?? 0) * portionFor(r, dinnerP))} kcal{mins(r) && !n.leftover ? ` · ${mins(r)} min` : ""}</span>
                        <span style={{ display: "block", color: C.sub, fontSize: 11, marginTop: 2 }}>
                          Your portion: {portionFor(r, dinnerP) === 1 ? "1 serving" : `${portionFor(r, dinnerP)} servings`}
                          {!n.leftover && batchesFor(r) > 1 ? ` · make it ×${batchesFor(r)}` : ""}
                        </span>
                      </p>
                    )}
                    <div className="flex gap-2 mt-2.5">
                      {!n.out && <button onClick={() => swap(d)} style={{ fontSize: 12, fontWeight: 600, color: C.text, border: `1px solid ${C.line}`, borderRadius: 99, padding: "5px 12px", background: "transparent", cursor: "pointer" }}>Swap</button>}
                      <button onClick={() => toggleOut(d)} style={{ fontSize: 12, fontWeight: 600, color: n.out ? C.bronze : C.sub, border: `1px solid ${n.out ? "rgba(200,150,90,0.4)" : C.line}`, borderRadius: 99, padding: "5px 12px", background: "transparent", cursor: "pointer" }}>
                        {n.out ? "Cook instead" : "Night off"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={() => build(true)} className="w-full mt-4 text-edge-secondary text-xs underline">Pick me a different week</button>
        </>
      )}

      {!empty && cooking.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 72, padding: "12px 16px", background: "linear-gradient(to top, #0E1014 70%, transparent)", zIndex: 30 }}>
          <button onClick={() => setShopping(true)}
            style={{ display: "block", width: "100%", maxWidth: 488, margin: "0 auto", background: C.bronze, color: C.bg, fontFamily: cond, fontWeight: 700, fontSize: 19, letterSpacing: "0.12em", textTransform: "uppercase", padding: "16px 0", borderRadius: 16, border: "none", cursor: "pointer" }}>
            Shopping list · {cookNights.length} cooks
          </button>
        </div>
      )}
    </div>
  );
}
