"use client";

import DinnerPlanner from "@/components/fuel/DinnerPlanner";
import BottomNav from "@/components/BottomNav";
import type { LiveRecipe } from "@/lib/recipes-live";

// Sample dinners for the Fuel > Dinners screen. Not a client's plan.

const FIXTURE_DINNERS: LiveRecipe[] = [
  {
    id: "fixture-chicken-tray",
    title: "Lemon chicken tray",
    slug: "fixture-chicken-tray",
    category: "dinner",
    description: null,
    servings: 4,
    prep_time_mins: 15,
    cook_time_mins: 35,
    calories: 520,
    protein_g: 46,
    carbs_g: 38,
    fat_g: 16,
    ingredients: ["600g chicken thigh", "400g new potatoes", "200g green beans", "1 lemon"],
    method: ["Roast the chicken and potatoes, then add the beans."],
    coach_note: null,
    tags: ["chicken", "batch-cook"],
    image_url: null,
  },
  {
    id: "fixture-beef-chilli",
    title: "Beef mince chilli",
    slug: "fixture-beef-chilli",
    category: "dinner",
    description: null,
    servings: 4,
    prep_time_mins: 15,
    cook_time_mins: 30,
    calories: 490,
    protein_g: 42,
    carbs_g: 36,
    fat_g: 18,
    ingredients: ["500g beef mince", "1 tin chopped tomatoes", "1 red pepper", "150g rice"],
    method: ["Brown the mince, simmer with the tomatoes, and serve with rice."],
    coach_note: null,
    tags: ["beef", "batch-cook"],
    image_url: null,
  },
  {
    id: "fixture-turkey-meatballs",
    title: "Turkey meatballs",
    slug: "fixture-turkey-meatballs",
    category: "dinner",
    description: null,
    servings: 4,
    prep_time_mins: 20,
    cook_time_mins: 25,
    calories: 510,
    protein_g: 44,
    carbs_g: 34,
    fat_g: 17,
    ingredients: ["500g turkey mince", "80g breadcrumbs", "300g passata", "200g pasta"],
    method: ["Brown the meatballs and simmer them in the passata."],
    coach_note: null,
    tags: ["turkey", "batch-cook"],
    image_url: null,
  },
  {
    id: "fixture-salmon",
    title: "Salmon with greens",
    slug: "fixture-salmon",
    category: "dinner",
    description: null,
    servings: 2,
    prep_time_mins: 10,
    cook_time_mins: 15,
    calories: 430,
    protein_g: 40,
    carbs_g: 12,
    fat_g: 22,
    ingredients: ["2 salmon fillets", "200g tenderstem broccoli", "150g frozen peas"],
    method: ["Roast the salmon and steam the greens."],
    coach_note: null,
    tags: ["fish", "salmon"],
    image_url: null,
  },
];

export default function FixtureDinnersPage() {
  return (
    <div className="min-h-screen pb-20" style={{ background: "#0E1014" }}>
      <div className="min-h-screen bg-edge-bg max-w-lg mx-auto px-4 pt-safe pb-24">
        <p className="text-edge-bronze text-[11px] font-condensed font-bold uppercase tracking-widest pt-4">
          Fixture week — sample recipes, not a client
        </p>
        <div className="flex items-center gap-3 py-4 mb-4">
          <div className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10" />
          <div>
            <h1 className="font-display text-3xl leading-none">Fuel</h1>
            <p className="text-edge-muted text-xs">Track & cook</p>
          </div>
        </div>

        <div className="flex bg-edge-surface rounded-xl p-1 mb-6 border border-white/[0.08]">
          <span className="flex-1 py-2 rounded-lg font-condensed font-bold text-xs uppercase tracking-widest text-center text-edge-muted">Today</span>
          <span className="flex-1 py-2 rounded-lg font-condensed font-bold text-xs uppercase tracking-widest text-center bg-edge-bronze text-white">Dinners</span>
          <span className="flex-1 py-2 rounded-lg font-condensed font-bold text-xs uppercase tracking-widest text-center text-edge-muted">Recipes</span>
          <span className="flex-1 py-2 rounded-lg font-condensed font-bold text-xs uppercase tracking-widest text-center text-edge-muted">On The Road</span>
        </div>

        <DinnerPlanner
          recipes={FIXTURE_DINNERS}
          loading={false}
          onOpenRecipe={() => {}}
          proteinTarget={160}
          calorieTarget={2200}
          seeded
        />
      </div>
      <BottomNav />
    </div>
  );
}
