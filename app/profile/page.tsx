"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types";

const GOAL_LABELS: Record<string, string> = {
  stronger: "Get stronger",
  back: "Fix back and movement",
  energy: "More energy and vitality",
  fat: "Lose body fat",
  identity: "Rebuild identity",
  all: "All of the above",
};

const STATE_LABELS: Record<string, string> = {
  none: "Not training at all",
  occasional: "Training occasionally",
  inconsistent: "Training inconsistently",
  regular: "Training regularly, not progressing",
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNutrition, setEditingNutrition] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [calorieInput, setCalorieInput] = useState("");
  const [savingNutrition, setSavingNutrition] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
      setWeightInput(data?.body_weight_kg?.toString() ?? "");
      setProteinInput((data?.protein_target ?? 160).toString());
      setCalorieInput((data?.calorie_target ?? 2200).toString());
      setLoading(false);
    }
    load();
  }, [router]);

  function recalcFromWeight(kg: string) {
    setWeightInput(kg);
    const w = parseFloat(kg);
    if (!isNaN(w) && w > 0) {
      setProteinInput(String(Math.round(w * 2)));
      setCalorieInput(String(Math.round(w * 33)));
    }
  }

  async function saveNutrition() {
    setSavingNutrition(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const updates = {
      body_weight_kg: parseFloat(weightInput) || null,
      protein_target: parseInt(proteinInput) || 160,
      calorie_target: parseInt(calorieInput) || 2200,
    };
    const saved = await fetch("/api/profile/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!saved.ok) { setSavingNutrition(false); return; }
    setProfile((p) => p ? { ...p, ...updates } : p);
    setEditingNutrition(false);
    setSavingNutrition(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-edge-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-edge-bronze border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-edge-bg max-w-lg mx-auto px-4 pt-safe pb-24">
      <div className="flex items-center gap-3 py-4 mb-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-condensed font-black text-2xl uppercase tracking-wide">Profile</h1>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center py-6 mb-6">
        <div className="w-20 h-20 rounded-full bg-edge-bronze flex items-center justify-center mb-3">
          <span className="font-condensed font-black text-3xl text-white">
            {profile?.full_name?.[0]?.toUpperCase() ?? "?"}
          </span>
        </div>
        <h2 className="font-condensed font-bold text-2xl uppercase tracking-wide text-white">
          {profile?.full_name ?? "Unknown"}
        </h2>
        <p className="text-edge-muted text-sm">{profile?.email}</p>
        <span className={`mt-2 text-xs font-condensed uppercase px-3 py-1 rounded-lg ${profile?.approved ? "bg-green-500/20 text-green-400" : "bg-edge-bronze/20 text-edge-bronze"}`}>
          {profile?.approved ? "Active member" : "Pending approval"}
        </span>
      </div>

      {/* Details */}
      <div className="bg-edge-surface rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] mb-4">
        {[
          { label: "Age", value: profile?.age ? `${profile.age}` : "—" },
          { label: "Goal", value: profile?.goal ? GOAL_LABELS[profile.goal] ?? profile.goal : "—" },
          { label: "Starting point", value: profile?.training_state ? STATE_LABELS[profile.training_state] ?? profile.training_state : "—" },
          { label: "Days per week", value: profile?.days_per_week ? `${profile.days_per_week} sessions` : "3 sessions" },
          { label: "Injuries", value: profile?.injuries || "None flagged" },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between px-4 py-3">
            <span className="text-edge-muted text-sm font-body">{label}</span>
            <span className="text-white text-sm font-body text-right max-w-[60%]">{value}</span>
          </div>
        ))}
      </div>

      {/* Nutrition targets */}
      <div className="bg-edge-surface rounded-xl border border-white/[0.08] mb-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <span className="text-xs font-condensed uppercase tracking-widest text-edge-muted">Nutrition Targets</span>
          {!editingNutrition && (
            <button
              onClick={() => setEditingNutrition(true)}
              className="text-xs text-edge-bronze font-condensed uppercase tracking-widest"
            >
              Edit
            </button>
          )}
        </div>

        {!editingNutrition ? (
          <div className="divide-y divide-white/[0.06]">
            {[
              { label: "Body weight", value: profile?.body_weight_kg ? `${profile.body_weight_kg} kg` : "—" },
              { label: "Daily protein", value: `${profile?.protein_target ?? 160}g` },
              { label: "Daily calories", value: `${profile?.calorie_target ?? 2200} kcal` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between px-4 py-3">
                <span className="text-edge-muted text-sm font-body">{label}</span>
                <span className="text-white text-sm font-body">{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div>
              <label className="text-edge-muted text-xs font-body uppercase tracking-widest block mb-1">Body weight (kg)</label>
              <input
                type="number"
                value={weightInput}
                onChange={(e) => recalcFromWeight(e.target.value)}
                placeholder="e.g. 85"
                className="w-full bg-edge-card border border-white/10 rounded-xl px-4 py-3 text-white font-body text-base placeholder:text-edge-muted focus:outline-none focus:border-edge-bronze"
              />
              <p className="text-edge-muted text-xs mt-1">Changing weight auto-recalculates targets below.</p>
            </div>
            <div>
              <label className="text-edge-muted text-xs font-body uppercase tracking-widest block mb-1">Daily protein (g)</label>
              <input
                type="number"
                value={proteinInput}
                onChange={(e) => setProteinInput(e.target.value)}
                className="w-full bg-edge-card border border-white/10 rounded-xl px-4 py-3 text-white font-body text-base focus:outline-none focus:border-edge-bronze"
              />
            </div>
            <div>
              <label className="text-edge-muted text-xs font-body uppercase tracking-widest block mb-1">Daily calories (kcal)</label>
              <input
                type="number"
                value={calorieInput}
                onChange={(e) => setCalorieInput(e.target.value)}
                className="w-full bg-edge-card border border-white/10 rounded-xl px-4 py-3 text-white font-body text-base focus:outline-none focus:border-edge-bronze"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditingNutrition(false)}
                className="flex-1 bg-transparent border border-white/10 text-white/60 font-condensed font-bold text-sm uppercase tracking-widest py-3 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={saveNutrition}
                disabled={savingNutrition}
                className="flex-1 bg-edge-bronze text-white font-condensed font-bold text-sm uppercase tracking-widest py-3 rounded-xl disabled:opacity-60 active:scale-95"
              >
                {savingNutrition ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Brand lines */}
      <div className="bg-edge-surface rounded-xl p-4 border border-edge-bronze/20 mb-6">
        <p className="text-edge-bronze font-condensed font-bold text-sm italic">
          "You're still that man. You're just buried."
        </p>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full bg-edge-surface border border-white/10 text-white/60 font-condensed font-bold text-base uppercase tracking-widest py-4 rounded-xl active:bg-white/5"
      >
        Sign Out
      </button>
    </div>
  );
}
