
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import PushOptIn from "@/components/PushOptIn";
import ManualMealEntry from "@/components/ManualMealEntry";
import {
  type LiveRecipe,
  type RecipeCategory,
  RECIPE_COLUMNS,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  sortRecipes,
  totalTimeMins,
} from "@/lib/recipes-live";

// Recipe library palette — branded, typographic, image-free (per Fuel design brief).
const RECIPE_INK = "#12151C"; // card surface
const RECIPE_CREAM = "#F4EEE2"; // titles
const RECIPE_BRASS = "#C9A24B"; // category kickers / accents
const RECIPE_OXBLOOD = "#4A1E24"; // coach-note card

// Camera scanner is client-only and heavy — load it lazily so it never
// blocks the Fuel page and only pulls in when a scan actually starts.
const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), { ssr: false });

interface ScannedProduct {
  product_name: string;
  serving_size: string | null;
  serving_quantity: number | null;
  per_100g: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  per_serving: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
}

interface NutritionLog {
  id: string;
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  edge_comment: string;
  created_at: string;
}

// Sensible fallbacks — the client's own targets (profiles.protein_target /
// calorie_target) override these once loaded.
const DEFAULT_PROTEIN_TARGET = 160;
const DEFAULT_CALORIE_TARGET = 2200;

interface DayTotal {
  date: string;
  protein: number;
  calories: number;
}

export default function NutritionPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"today" | "recipes" | "road">("today");
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [latest, setLatest] = useState<NutritionLog | null>(null);
  const [error, setError] = useState("");
  const [openRecipe, setOpenRecipe] = useState<LiveRecipe | null>(null);

  // Live recipe library (Supabase). Lazily loaded the first time the tab opens.
  const [recipes, setRecipes] = useState<LiveRecipe[] | null>(null);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanned, setScanned] = useState<ScannedProduct | null>(null);
  const [scanGrams, setScanGrams] = useState(100);

  // Per-client targets (default until the profile loads) + last-7-days history.
  const [proteinTarget, setProteinTarget] = useState(DEFAULT_PROTEIN_TARGET);
  const [calorieTarget, setCalorieTarget] = useState(DEFAULT_CALORIE_TARGET);
  const [week, setWeek] = useState<DayTotal[]>([]);

  useEffect(() => { loadTodaysLogs(); loadTargetsAndWeek(); }, []);

  async function loadTargetsAndWeek() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Client's own protein/calorie targets (fall back to defaults if unset).
    const { data: profile } = await supabase
      .from("profiles").select("protein_target, calorie_target").eq("id", user.id).single();
    if (profile?.protein_target && profile.protein_target > 0) setProteinTarget(profile.protein_target);
    if (profile?.calorie_target && profile.calorie_target > 0) setCalorieTarget(profile.calorie_target);

    // Last 7 days of logs, collated per day for the weekly summary.
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const sinceStr = since.toISOString().split("T")[0];
    const { data: rows } = await supabase
      .from("nutrition_logs").select("date, protein_g, calories")
      .eq("user_id", user.id).gte("date", sinceStr);

    const byDay = new Map<string, DayTotal>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      byDay.set(key, { date: key, protein: 0, calories: 0 });
    }
    for (const r of rows ?? []) {
      const day = byDay.get(r.date as string);
      if (day) { day.protein += Number(r.protein_g) || 0; day.calories += Number(r.calories) || 0; }
    }
    setWeek(Array.from(byDay.values()));
  }

  useEffect(() => {
    if (tab === "recipes" && recipes === null && !recipesLoading && !recipesError) {
      loadRecipes();
    }
  }, [tab, recipes, recipesLoading, recipesError]);

  async function loadRecipes() {
    setRecipesLoading(true);
    setRecipesError(false);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recipes")
        .select(RECIPE_COLUMNS)
        .eq("published", true);
      if (error) throw error;
      setRecipes(sortRecipes((data ?? []) as LiveRecipe[]));
    } catch {
      setRecipesError(true);
    } finally {
      setRecipesLoading(false);
    }
  }

  async function loadTodaysLogs() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("nutrition_logs").select("*").eq("user_id", user.id).eq("date", today)
      .order("created_at", { ascending: false });
    if (data) setLogs(data);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(""); setLatest(null);
    const reader = new FileReader();
    reader.onload = () => { const dataUrl = reader.result as string; setPreview(dataUrl); analyseImage(dataUrl); };
    reader.readAsDataURL(file);
  }

  async function analyseImage(dataUrl: string) {
    setAnalysing(true);
    try {
      const base64 = await resizeImage(dataUrl, 1568);
      // resizeImage always re-encodes via canvas.toDataURL("image/jpeg", ...), so the
      // outgoing bytes are JPEG regardless of the source file's original type.
      const res = await fetch("/api/nutrition/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: base64, mimeType: "image/jpeg" }) });
      if (!res.ok) { const err = await res.json(); setError(err.error || "Analysis failed. Try a clearer photo."); return; }
      const log: NutritionLog = await res.json();
      setLatest(log); setLogs((prev) => [log, ...prev]);
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setAnalysing(false); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function deleteLog(id: string) {
    const supabase = createClient();
    await supabase.from("nutrition_logs").delete().eq("id", id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    if (latest?.id === id) setLatest(null);
  }

  const handleBarcode = useCallback(async (code: string) => {
    setScannerOpen(false);
    setScanLoading(true);
    setError("");
    setLatest(null);
    try {
      const res = await fetch("/api/nutrition/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Lookup failed. Try again."); return; }
      if (!data.found) { setError("Not in the food database yet. Snap a photo of it instead — that always works."); return; }
      setScanned(data);
      // Default portion: the pack's stated serving size if it has one, else 100g.
      setScanGrams(data.serving_quantity && data.serving_quantity > 0 ? Math.round(data.serving_quantity) : 100);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setScanLoading(false);
    }
  }, []);

  async function logScanned() {
    if (!scanned) return;
    const factor = scanGrams / 100;
    const b = scanned.per_100g;
    const calories = Math.round(b.calories * factor);
    const protein_g = Math.round(b.protein_g * factor * 10) / 10;
    const carbs_g = Math.round(b.carbs_g * factor * 10) / 10;
    const fat_g = Math.round(b.fat_g * factor * 10) / 10;

    const edge_comment =
      protein_g >= 20 ? "Solid grab. That's real protein doing the work — exactly what we're after."
      : protein_g >= 10 ? "Decent. A bit more protein alongside it and you're flying."
      : "Fuel more than protein. Fine now and then — just don't let it be the whole meal.";

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Session expired — reopen the app and try again."); return; }

    const { data: log, error: insErr } = await supabase
      .from("nutrition_logs")
      .insert({ user_id: user.id, meal_name: scanned.product_name, calories, protein_g, carbs_g, fat_g, edge_comment })
      .select()
      .single();

    if (insErr || !log) { setError("Couldn't save that log. Try again."); return; }
    setLogs((prev) => [log, ...prev]);
    setLatest(log);
    setScanned(null);
  }

  // Live preview of macros for the chosen portion, before logging.
  const previewMacros = scanned
    ? {
        calories: Math.round(scanned.per_100g.calories * (scanGrams / 100)),
        protein_g: Math.round(scanned.per_100g.protein_g * (scanGrams / 100) * 10) / 10,
        carbs_g: Math.round(scanned.per_100g.carbs_g * (scanGrams / 100) * 10) / 10,
        fat_g: Math.round(scanned.per_100g.fat_g * (scanGrams / 100) * 10) / 10,
      }
    : null;

  const totalProtein = logs.reduce((s, l) => s + l.protein_g, 0);
  const totalCalories = logs.reduce((s, l) => s + l.calories, 0);
  const totalCarbs = logs.reduce((s, l) => s + l.carbs_g, 0);
  const totalFat = logs.reduce((s, l) => s + l.fat_g, 0);
  const proteinPct = Math.min((totalProtein / proteinTarget) * 100, 100);
  const caloriePct = Math.min((totalCalories / calorieTarget) * 100, 100);

  if (openRecipe) return <RecipeDetail recipe={openRecipe} onBack={() => setOpenRecipe(null)} />;

  return (
    <div className="min-h-screen bg-edge-bg max-w-lg mx-auto px-4 pt-safe pb-24">
      <div className="flex items-center gap-3 py-4 mb-4">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="font-display text-3xl leading-none">Fuel</h1>
          <p className="text-edge-muted text-xs">Track & cook</p>
        </div>
      </div>

      <div className="flex bg-edge-surface rounded-xl p-1 mb-6 border border-white/[0.08]">
        <button onClick={() => setTab("today")} className={`flex-1 py-2 rounded-lg font-condensed font-bold text-xs uppercase tracking-widest transition-all ${tab === "today" ? "bg-edge-bronze text-white" : "text-edge-muted"}`}>Today</button>
        <button onClick={() => setTab("recipes")} className={`flex-1 py-2 rounded-lg font-condensed font-bold text-xs uppercase tracking-widest transition-all ${tab === "recipes" ? "bg-edge-bronze text-white" : "text-edge-muted"}`}>Recipes</button>
        <button onClick={() => setTab("road")} className={`flex-1 py-2 rounded-lg font-condensed font-bold text-xs uppercase tracking-widest transition-all ${tab === "road" ? "bg-edge-bronze text-white" : "text-edge-muted"}`}>On The Road</button>
      </div>

      {tab === "today" && (
        <>
          <button onClick={() => fileRef.current?.click()} disabled={analysing} className="anim-0 pressable w-full bg-edge-bronze rounded-[20px] p-5 flex items-center gap-4 mb-6 transition-transform disabled:opacity-60">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              {analysing ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </div>
            <div className="text-left">
              <p className="font-condensed font-bold text-xl uppercase tracking-wide text-white leading-none">{analysing ? "Analysing..." : "Snap Your Meal"}</p>
              <p className="text-white/70 text-sm mt-0.5">{analysing ? "Edge is reading your plate" : "AI reads the plate — you get the macros"}</p>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

          <ManualMealEntry onLogged={(log) => { setLatest(log); setLogs((prev) => [log, ...prev]); }} />

          <button onClick={() => { setError(""); setScannerOpen(true); }} disabled={analysing || scanLoading} className="anim-1 pressable w-full bg-edge-surface border border-white/[0.08] rounded-[20px] p-4 flex items-center gap-4 mb-6 transition-transform disabled:opacity-60">
            <div className="w-11 h-11 rounded-xl bg-edge-bronze/10 border border-edge-bronze/20 flex items-center justify-center flex-shrink-0">
              {scanLoading ? <div className="w-5 h-5 border-2 border-edge-bronze border-t-transparent rounded-full animate-spin" /> : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-edge-bronze">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5v14M8 5v14M12 5v14M16 5v14M20 5v14" />
                </svg>
              )}
            </div>
            <div className="text-left flex-1">
              <p className="font-condensed font-bold text-base uppercase tracking-wide text-white leading-none">{scanLoading ? "Looking it up..." : "Scan Barcode"}</p>
              <p className="text-edge-muted text-xs mt-0.5">{scanLoading ? "Reading the label" : "Packaged food — exact macros off the label"}</p>
            </div>
          </button>

          {scanned && previewMacros && (
            <div className="mb-6 bg-edge-surface rounded-[20px] border border-edge-bronze/30 overflow-hidden">
              <div className="bg-edge-bronze/10 px-4 py-3 flex items-center justify-between border-b border-edge-bronze/20">
                <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-bronze">Found it</p>
                <button onClick={() => setScanned(null)} className="text-edge-muted active:text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4">
                <p className="font-condensed font-bold text-lg text-white mb-1 leading-tight">{scanned.product_name}</p>
                {scanned.serving_size && <p className="text-edge-muted text-xs mb-4">Pack serving: {scanned.serving_size}</p>}

                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => setScanGrams((g) => Math.max(10, g - 10))} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white text-xl leading-none active:bg-white/10">−</button>
                  <div className="flex-1 text-center">
                    <input type="number" value={scanGrams} onChange={(e) => setScanGrams(Math.max(1, Math.min(2000, parseInt(e.target.value) || 0)))} className="w-full bg-transparent text-center font-condensed font-black text-2xl text-white outline-none" />
                    <p className="text-edge-muted text-xs -mt-1">grams</p>
                  </div>
                  <button onClick={() => setScanGrams((g) => Math.min(2000, g + 10))} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white text-xl leading-none active:bg-white/10">+</button>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  <MacroCell label="Cal" value={previewMacros.calories} unit="" highlight />
                  <MacroCell label="Protein" value={previewMacros.protein_g} unit="g" />
                  <MacroCell label="Carbs" value={previewMacros.carbs_g} unit="g" />
                  <MacroCell label="Fat" value={previewMacros.fat_g} unit="g" />
                </div>

                <button onClick={logScanned} className="pressable w-full bg-edge-bronze rounded-xl py-3 font-condensed font-bold text-sm uppercase tracking-widest text-white transition-transform">Log It</button>
              </div>
            </div>
          )}

          {preview && analysing && (
            <div className="mb-6 rounded-2xl overflow-hidden border border-white/10 relative">
              <img src={preview} alt="Meal preview" className="w-full object-cover max-h-48" />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-edge-bronze border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-white text-sm font-condensed font-bold uppercase tracking-wide">Reading your plate...</p>
                </div>
              </div>
            </div>
          )}

          {error && <div className="mb-6 bg-edge-red/10 border border-edge-red/30 rounded-xl p-4"><p className="text-edge-red text-sm">{error}</p></div>}

          {latest && !analysing && (
            <div className="mb-6 bg-edge-surface rounded-[20px] border border-edge-bronze/30 overflow-hidden">
              <div className="bg-edge-bronze/10 px-4 py-3 flex items-center gap-2 border-b border-edge-bronze/20">
                <div className="w-6 h-6 rounded-full bg-edge-bronze flex items-center justify-center flex-shrink-0"><span className="font-condensed font-black text-xs text-edge-bg">E</span></div>
                <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-bronze">Edge says</p>
              </div>
              <div className="p-4">
                <p className="font-condensed font-bold text-lg text-white mb-1">{latest.meal_name}</p>
                <p className="text-white/70 text-sm leading-relaxed mb-4">{latest.edge_comment}</p>
                <div className="grid grid-cols-4 gap-2">
                  <MacroCell label="Cal" value={latest.calories} unit="" highlight />
                  <MacroCell label="Protein" value={latest.protein_g} unit="g" />
                  <MacroCell label="Carbs" value={latest.carbs_g} unit="g" />
                  <MacroCell label="Fat" value={latest.fat_g} unit="g" />
                </div>
              </div>
            </div>
          )}

          {/* Push opt-in appears only after the client has logged a meal — a
              natural moment, never on first app open. Self-hides if unsupported
              or already handled. */}
          <PushOptIn show={logs.length > 0} />

          {logs.length > 0 && (
            <div className="anim-2 bg-edge-surface rounded-[20px] p-4 border border-white/[0.08] mb-6">
              <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted mb-4">Today's Totals</p>
              <div className="mb-4">
                <div className="flex justify-between mb-1"><span className="text-white text-sm font-condensed font-bold">Protein</span><span className="text-edge-muted text-xs">{Math.round(totalProtein)}g / {proteinTarget}g</span></div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${proteinPct}%`, backgroundColor: totalProtein >= proteinTarget ? "#10B981" : "#F5A623" }} /></div>
              </div>
              <div className="mb-4">
                <div className="flex justify-between mb-1"><span className="text-white text-sm font-condensed font-bold">Calories</span><span className="text-edge-muted text-xs">{Math.round(totalCalories)} / {calorieTarget}</span></div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-edge-bronze rounded-full transition-all" style={{ width: `${caloriePct}%` }} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                <div className="text-center"><p className="font-condensed font-bold text-lg text-white">{Math.round(totalProtein)}g</p><p className="text-edge-muted text-xs">Protein</p></div>
                <div className="text-center"><p className="font-condensed font-bold text-lg text-white">{Math.round(totalCarbs)}g</p><p className="text-edge-muted text-xs">Carbs</p></div>
                <div className="text-center"><p className="font-condensed font-bold text-lg text-white">{Math.round(totalFat)}g</p><p className="text-edge-muted text-xs">Fat</p></div>
              </div>
            </div>
          )}

          <WeekSummary week={week} proteinTarget={proteinTarget} />

          {logs.length > 0 && (
            <div className="anim-3 mb-6">
              <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted mb-3">Today's Meals</p>
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="bg-edge-surface rounded-xl p-4 border border-white/[0.08]">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-condensed font-bold text-sm uppercase tracking-wide text-white">{log.meal_name}</p>
                      <button onClick={() => deleteLog(log.id)} className="text-edge-muted active:text-white flex-shrink-0 mt-0.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-edge-muted text-xs">{log.calories} cal</span>
                      <span className="text-edge-bronze text-xs">{log.protein_g}g protein</span>
                      <span className="text-edge-muted text-xs">{log.carbs_g}g carbs</span>
                      <span className="text-edge-muted text-xs">{log.fat_g}g fat</span>
                    </div>
                    <p className="text-white/50 text-xs mt-1 leading-relaxed">{log.edge_comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {logs.length === 0 && !analysing && <div className="text-center py-8 mb-6"><p className="text-edge-muted text-sm">No meals logged today. Snap your first one.</p></div>}

          <Link href="/edge">
            <div className="anim-4 pressable bg-edge-surface rounded-xl p-4 border border-edge-bronze/30 flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-edge-bronze flex items-center justify-center flex-shrink-0"><span className="font-condensed font-black text-sm text-edge-bg">E</span></div>
              <div className="flex-1"><p className="font-condensed font-bold text-sm uppercase tracking-wide">Ask Edge</p><p className="text-edge-muted text-xs">Pre-workout meals, travel food, what to eat on rest days...</p></div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-edge-muted flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
        </>
      )}

      {tab === "recipes" && (
        <RecipeLibrary
          recipes={recipes}
          loading={recipesLoading}
          error={recipesError}
          onRetry={loadRecipes}
          onOpen={setOpenRecipe}
        />
      )}

      {tab === "road" && <FuelOnTheRoad />}

      {scannerOpen && <BarcodeScanner onDetected={handleBarcode} onClose={() => setScannerOpen(false)} />}
    </div>
  );
}

function RecipeLibrary({
  recipes,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  recipes: LiveRecipe[] | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpen: (r: LiveRecipe) => void;
}) {
  if (loading || recipes === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-edge-bronze border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-edge-muted text-sm">Loading recipes…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-white/80 text-sm mb-1">Couldn&apos;t load the recipes.</p>
        <p className="text-edge-muted text-xs mb-5">Check your connection and try again.</p>
        <button
          onClick={onRetry}
          className="font-condensed font-bold text-xs uppercase tracking-widest px-5 py-2.5 rounded-lg"
          style={{ backgroundColor: RECIPE_BRASS, color: RECIPE_INK }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-white/80 text-sm mb-1">No recipes yet.</p>
        <p className="text-edge-muted text-xs">New recipes will show up here as they&apos;re added.</p>
      </div>
    );
  }

  const groups = CATEGORY_ORDER
    .map((category) => ({ category, items: recipes.filter((r) => r.category === category) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <p className="text-edge-muted text-xs leading-relaxed mb-6">
        High-protein recipes built for men who train. Protein first — that&apos;s the number that matters.
      </p>
      {groups.map((group, gi) => (
        <div key={group.category} className={`mb-8 anim-${Math.min(gi, 4)}`}>
          <p
            className="font-condensed font-bold text-xs uppercase tracking-[0.2em] mb-3"
            style={{ color: RECIPE_BRASS }}
          >
            {CATEGORY_LABEL[group.category]}
          </p>
          <div className="space-y-2">
            {group.items.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecipeCard({ recipe, onOpen }: { recipe: LiveRecipe; onOpen: (r: LiveRecipe) => void }) {
  const time = totalTimeMins(recipe);
  return (
    <button
      onClick={() => onOpen(recipe)}
      className="pressable w-full rounded-2xl p-4 border border-white/[0.06] flex items-center gap-4 text-left"
      style={{ backgroundColor: RECIPE_INK }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="font-condensed font-bold text-[10px] uppercase tracking-[0.22em] mb-1.5"
          style={{ color: RECIPE_BRASS }}
        >
          {CATEGORY_LABEL[recipe.category]}
        </p>
        <p
          className="font-display font-semibold text-lg leading-snug"
          style={{ color: RECIPE_CREAM }}
        >
          {recipe.title}
        </p>
        {recipe.description && (
          <p className="text-edge-secondary text-xs leading-relaxed mt-1 line-clamp-1">{recipe.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {recipe.calories != null && <MetaChip>{recipe.calories} kcal</MetaChip>}
          {recipe.protein_g != null && <MetaChip accent>{recipe.protein_g}g protein</MetaChip>}
          {time > 0 && <MetaChip>{time} min</MetaChip>}
        </div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-edge-muted flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
    </button>
  );
}

function MetaChip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className="font-condensed font-bold text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-md"
      style={
        accent
          ? { color: RECIPE_BRASS, backgroundColor: "rgba(201,162,75,0.12)" }
          : { color: "#9BA3AF", backgroundColor: "rgba(255,255,255,0.05)" }
      }
    >
      {children}
    </span>
  );
}

function RecipeDetail({ recipe, onBack }: { recipe: LiveRecipe; onBack: () => void }) {
  const time = totalTimeMins(recipe);
  const metaBits = [
    recipe.servings != null ? `Serves ${recipe.servings}` : null,
    recipe.prep_time_mins ? `${recipe.prep_time_mins} min prep` : null,
    recipe.cook_time_mins ? `${recipe.cook_time_mins} min cook` : null,
    !recipe.prep_time_mins && !recipe.cook_time_mins && time > 0 ? `${time} min` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-edge-bg max-w-lg mx-auto px-4 pt-safe pb-24">
      <div className="flex items-center gap-3 py-4 mb-6">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <p className="font-condensed font-bold text-xs uppercase tracking-[0.2em]" style={{ color: RECIPE_BRASS }}>
          {CATEGORY_LABEL[recipe.category]}
        </p>
      </div>

      <h1 className="font-display font-semibold text-4xl leading-tight mb-3" style={{ color: RECIPE_CREAM }}>{recipe.title}</h1>
      {recipe.description && <p className="text-edge-secondary text-sm leading-relaxed mb-6">{recipe.description}</p>}

      <div className="grid grid-cols-4 gap-2 mb-3">
        <MacroStat value={recipe.calories} label="kcal" />
        <MacroStat value={recipe.protein_g} label="protein" unit="g" accent />
        <MacroStat value={recipe.carbs_g} label="carbs" unit="g" />
        <MacroStat value={recipe.fat_g} label="fat" unit="g" />
      </div>
      <p className="text-edge-muted text-xs mb-8">Per serving{metaBits.length > 0 ? ` · ${metaBits.join(" · ")}` : ""}</p>

      {recipe.ingredients.length > 0 && (
        <div className="mb-8">
          <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted mb-4">Ingredients</p>
          <ul className="space-y-2">
            {recipe.ingredients.map((item, ii) => (
              <li key={ii} className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: RECIPE_BRASS }} />
                <span className="text-white/80 text-sm leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recipe.method.length > 0 && (
        <div className="mb-8">
          <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted mb-4">Method</p>
          <ol className="space-y-4">
            {recipe.method.map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="font-condensed font-black text-base flex-shrink-0 w-5 text-right leading-relaxed" style={{ color: RECIPE_BRASS }}>{i + 1}</span>
                <span className="text-white/80 text-sm leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {recipe.coach_note && (
        <div className="rounded-2xl px-5 py-4 mb-8" style={{ backgroundColor: RECIPE_OXBLOOD }}>
          <p className="font-condensed font-bold text-xs uppercase tracking-[0.2em] mb-2" style={{ color: RECIPE_BRASS }}>Coach Note</p>
          <p className="font-display italic text-sm leading-relaxed" style={{ color: RECIPE_CREAM }}>{recipe.coach_note}</p>
        </div>
      )}

      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {recipe.tags.map((tag) => (
            <span key={tag} className="font-condensed font-bold text-[11px] uppercase tracking-wide px-2.5 py-1 rounded-md" style={{ color: "#9BA3AF", backgroundColor: "rgba(255,255,255,0.05)" }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MacroStat({ value, label, unit, accent }: { value: number | null; label: string; unit?: string; accent?: boolean }) {
  const display = value != null ? `${value}${unit ?? ""}` : "—";
  return (
    <div
      className="rounded-xl p-3 text-center border"
      style={accent
        ? { backgroundColor: "rgba(201,162,75,0.1)", borderColor: "rgba(201,162,75,0.3)" }
        : { backgroundColor: RECIPE_INK, borderColor: "rgba(255,255,255,0.06)" }}
    >
      <p className="font-condensed font-black text-lg leading-none" style={{ color: accent ? RECIPE_BRASS : RECIPE_CREAM }}>{display}</p>
      <p className="text-xs mt-1" style={{ color: accent ? "rgba(201,162,75,0.7)" : "#3D434D" }}>{label}</p>
    </div>
  );
}

function FuelOnTheRoad() {
  const green = [
    { name: "King prawns — 100g pot", note: "The leanest grab going. Zero carbs", protein: "~20g", kcal: "~90 kcal" },
    { name: "Tuna or mackerel in spring water", note: "Mackerel brings omega-3 with it", protein: "~25g", kcal: "~110 kcal" },
    { name: "Cooked chicken breast / slices", note: "Best all-rounder", protein: "~28g", kcal: "~165 kcal" },
    { name: "Plain high-protein yoghurt / skyr", note: "Go natural — flavoured pots hide ~13g sugar", protein: "~18g", kcal: "~100 kcal" },
    { name: "Turkey or lean ham slices", note: "Skip the honey-glazed ones", protein: "~20g", kcal: "~110 kcal" },
    { name: "Lean biltong — 35g bag", note: "Clean and chewy — one bag, not three", protein: "~17g", kcal: "~110 kcal" },
    { name: "Boiled eggs × 2", note: "Two is plenty — fat lives in the yolk", protein: "12g", kcal: "~155 kcal" },
  ];
  const amber = [
    { name: "Cheese / Babybel", note: "73% fat calories. One or two max", protein: "~5g ea", kcal: "~70 kcal ea" },
    { name: "Whole-milk Greek yoghurt", note: "Plain skyr gives more protein for fewer calories", protein: "~15g", kcal: "~180 kcal" },
    { name: "Protein bar (Grenade Carb Killa)", note: "Controlled treat, not a staple", protein: "~20g", kcal: "~220 kcal" },
    { name: "Flavoured protein yoghurt", note: "~13g sugar sneaks in", protein: "~20g", kcal: "~150 kcal" },
    { name: "Flavoured protein shake / milk", note: "Read the bottle — some hit 22g sugar", protein: "~20g", kcal: "150–225 kcal" },
  ];
  const venues = [
    { place: "Petrol Station", go: "Biltong · boiled eggs · chicken pieces · plain skyr · prawn pot", dodge: "Pastries · sweet jerky · nut bags · protein cookies", best: "Biltong + 2 eggs = ~30g protein / ~230 kcal" },
    { place: "Coffee Shop", go: "Pret egg/chicken protein pot · egg bites · plain yoghurt · flat white", dodge: "Muffins · paninis · frappes · sweet lattes", best: "Protein pot + flat white = ~22g protein / ~250 kcal" },
    { place: "Café / Greasy Spoon", go: "Poached eggs + grilled bacon + mushrooms + tomato · or 3-egg omelette", dodge: "Sausage · fried bread · hash brown · toast · beans", best: "Omelette + grilled bacon = ~28g protein / ~350 kcal" },
    { place: "Supermarket / M&S / Tesco", go: "Roast chicken pieces · prawn pot · plain skyr · edamame", dodge: "Meal-deal combo · big sweet shakes · mass-gainer bars", best: "Chicken pieces + plain skyr = ~45g protein / ~270 kcal" },
  ];

  return (
    <div>
      <p className="text-edge-muted text-xs leading-relaxed mb-6">Protein when you're out and about. Quick, clean grabs that fill you up without blowing the day's calories. Chase high protein, low calories — that's the game.</p>

      <div className="bg-edge-surface rounded-[20px] p-4 border border-edge-bronze/30 mb-6">
        <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-bronze mb-1">The Dream Grab</p>
        <p className="text-white font-display text-lg leading-snug">Prawns + plain skyr</p>
        <p className="text-edge-muted text-xs mt-1">~40g protein · under 220 kcal · nothing on the road beats it</p>
      </div>

      <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted mb-3">Green — eat these first</p>
      <div className="space-y-2 mb-6">
        {green.map((item, i) => (
          <div key={i} className="bg-edge-surface rounded-xl p-4 border border-white/[0.08] flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-condensed font-bold">{item.name}</p>
              <p className="text-edge-muted text-xs mt-0.5">{item.note}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-emerald-400 font-condensed font-black text-sm">{item.protein}</p>
              <p className="text-edge-muted text-xs">{item.kcal}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted mb-3">Amber — good protein, watch calories</p>
      <div className="space-y-2 mb-6">
        {amber.map((item, i) => (
          <div key={i} className="bg-edge-surface rounded-xl p-4 border border-white/[0.08] flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-edge-gold flex-shrink-0 mt-1.5" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-condensed font-bold">{item.name}</p>
              <p className="text-edge-muted text-xs mt-0.5">{item.note}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-edge-gold font-condensed font-black text-sm">{item.protein}</p>
              <p className="text-edge-muted text-xs">{item.kcal}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-edge-surface rounded-xl p-4 border border-white/[0.08] mb-6">
        <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted mb-3">Red — avoid</p>
        {["Nuts by the handful — fat bomb, not protein", "Peperami / salami / chorizo — 79% fat calories", "Sweet / teriyaki jerky — reach for plain biltong", "Recovery shakes — 22g+ sugar", "Pastries, flapjacks, protein cookies", "The meal-deal autopilot — sandwich + crisps + fizzy = ~800 kcal"].map((item, i) => (
          <div key={i} className="flex items-start gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
            <p className="text-white/60 text-sm">{item}</p>
          </div>
        ))}
      </div>

      <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted mb-3">By Venue</p>
      <div className="space-y-3">
        {venues.map((v, i) => (
          <div key={i} className="bg-edge-surface rounded-xl p-4 border border-white/[0.08]">
            <p className="font-display text-base text-white mb-3">{v.place}</p>
            <div className="space-y-2">
              <div><span className="text-emerald-400 text-xs font-condensed font-bold uppercase tracking-wide">Go </span><span className="text-white/70 text-xs">{v.go}</span></div>
              <div><span className="text-red-400 text-xs font-condensed font-bold uppercase tracking-wide">Dodge </span><span className="text-white/70 text-xs">{v.dodge}</span></div>
              <div className="mt-2 bg-edge-bronze/10 rounded-lg px-3 py-2 border border-edge-bronze/20"><p className="text-edge-bronze text-xs font-condensed font-bold">{v.best}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekSummary({ week, proteinTarget }: { week: DayTotal[]; proteinTarget: number }) {
  // Only show once there's at least one day with logged protein.
  const daysLogged = week.filter((d) => d.protein > 0);
  if (daysLogged.length === 0) return null;

  const daysHit = week.filter((d) => d.protein >= proteinTarget).length;
  const avgProtein = Math.round(daysLogged.reduce((s, d) => s + d.protein, 0) / daysLogged.length);
  const maxProtein = Math.max(proteinTarget, ...week.map((d) => d.protein));
  const dayLetters = ["S", "M", "T", "W", "T", "F", "S"];
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="anim-3 bg-edge-surface rounded-[20px] p-4 border border-white/[0.08] mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted">This Week · Protein</p>
        <p className="text-edge-muted text-xs">{daysHit}/7 days hit</p>
      </div>
      <div className="flex items-end justify-between gap-2 h-24 mb-2">
        {week.map((d) => {
          const hit = d.protein >= proteinTarget;
          const h = Math.max(4, Math.round((d.protein / maxProtein) * 88));
          const isToday = d.date === todayStr;
          const dow = new Date(d.date + "T00:00:00").getDay();
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
              <div className="w-full rounded-md transition-all" style={{
                height: `${h}px`,
                backgroundColor: d.protein === 0 ? "rgba(255,255,255,0.06)" : hit ? "#10B981" : "#C8965A",
                opacity: isToday ? 1 : 0.85,
              }} />
              <span className={`text-[10px] ${isToday ? "text-white font-bold" : "text-edge-muted"}`}>{dayLetters[dow]}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between pt-3 border-t border-white/10">
        <div><span className="font-condensed font-bold text-lg text-white">{avgProtein}g</span><span className="text-edge-muted text-xs ml-1.5">daily avg</span></div>
        <div className="text-right"><span className="font-condensed font-bold text-lg" style={{ color: "#10B981" }}>{daysHit}</span><span className="text-edge-muted text-xs ml-1.5">on target</span></div>
      </div>
    </div>
  );
}

function MacroCell({ label, value, unit, highlight }: { label: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-2 text-center ${highlight ? "bg-edge-bronze/10 border border-edge-bronze/20" : "bg-white/5"}`}>
      <p className={`font-condensed font-bold text-lg leading-none ${highlight ? "text-edge-bronze" : "text-white"}`}>{Math.round(value)}{unit}</p>
      <p className="text-edge-muted text-xs mt-0.5">{label}</p>
    </div>
  );
}

async function resizeImage(dataUrl: string, maxPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82).split(",")[1]);
    };
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = dataUrl;
  });
}
