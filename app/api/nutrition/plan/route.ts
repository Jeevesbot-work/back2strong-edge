// POST /api/nutrition/plan
// "Chat to build": the client says what they want ("high-protein week",
// "swap Tuesday dinner for something with chicken", "I'm sick of eggs") and
// Edge rebuilds the week from the live recipe library. Returns the saved plan.
//
// Guard rails: the model can only choose recipe IDs from the library we hand
// it; anything else is dropped. Existing cells the instruction doesn't touch
// are preserved (the model is shown the current plan and told to keep it).

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { SLOTS, DAY_LABELS_LONG, type Plan } from "@/lib/meal-plan";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Slot = (typeof SLOTS)[number];

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const { instruction, weekStart } = (await req.json()) as { instruction?: string; weekStart?: string };
    if (!instruction?.trim() || !weekStart) return NextResponse.json({ error: "Missing instruction or week" }, { status: 400 });

    const [{ data: recipes }, { data: existing }, { data: profile }] = await Promise.all([
      supabase.from("recipes").select("id,title,category,calories,protein_g,tags,description").eq("published", true),
      supabase.from("meal_plans").select("day,slot,recipe_id,custom_title").eq("user_id", user.id).eq("week_start", weekStart),
      supabase.from("profiles").select("full_name,goal,protein_target,calorie_target,injuries").eq("id", user.id).single(),
    ]);

    if (!recipes?.length) return NextResponse.json({ error: "No recipes available" }, { status: 500 });

    const library = recipes
      .map((r) => `${r.id} | ${r.category} | ${r.title} | ${r.protein_g ?? "?"}g protein, ${r.calories ?? "?"} kcal${r.tags?.length ? ` | ${r.tags.join(", ")}` : ""}`)
      .join("\n");

    const current = (existing ?? [])
      .map((c) => `${DAY_LABELS_LONG[c.day]} ${c.slot}: ${c.recipe_id ?? c.custom_title ?? "empty"}`)
      .join("\n") || "(empty week)";

    const system = `You are Edge, the coach inside the Back2Strong app. You are building a 7-day meal plan for a man aged 40+ using ONLY the recipe library below. Return JSON only — no prose, no markdown fences.

CLIENT: ${profile?.full_name ?? "the client"}. Goal: ${profile?.goal ?? "not set"}. Daily targets: ${profile?.protein_target ?? 160}g protein, ${profile?.calorie_target ?? 2200} kcal.${profile?.injuries ? ` Notes: ${profile.injuries}.` : ""}

RULES:
- Use recipe IDs exactly as given. Never invent an ID or a meal.
- Fill all 7 days (day 0 = Monday … 6 = Sunday). Slots: breakfast, lunch, dinner, snack. Snack may be null.
- Match slot to recipe category.
- Vary meals across the week — avoid the same dinner two days running unless the client asks for repetition.
- Aim each day near the protein target; don't obsess over calories.
- If the instruction only changes part of the week (e.g. "swap Tuesday dinner"), KEEP every other cell exactly as in the current plan.
- "note": one plain-English sentence, in Nick's voice (direct, warm, British, no hype, no emojis), explaining what you did.

OUTPUT SHAPE:
{"days":[{"day":0,"breakfast":"<id>","lunch":"<id>","dinner":"<id>","snack":"<id or null>"}, … 7 entries …],"note":"…"}

RECIPE LIBRARY (id | category | title | macros | tags):
${library}

CURRENT PLAN:
${current}`;

    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: instruction.trim() }],
    });

    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim();
    const clean = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: { days?: Array<Record<string, unknown>>; note?: string };
    try { parsed = JSON.parse(clean); } catch { return NextResponse.json({ error: "Edge couldn't build that — try rephrasing." }, { status: 502 }); }

    const validIds = new Set(recipes.map((r) => r.id));
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const rows: Array<{ user_id: string; week_start: string; day: number; slot: Slot; recipe_id: string | null; custom_title: null; updated_at: string }> = [];
    const now = new Date().toISOString();

    for (const d of parsed.days ?? []) {
      const day = Number(d.day);
      if (!Number.isInteger(day) || day < 0 || day > 6) continue;
      for (const slot of SLOTS) {
        const raw = d[slot];
        const id = typeof raw === "string" && validIds.has(raw) && byId.get(raw)?.category === slot ? raw : null;
        rows.push({ user_id: user.id, week_start: weekStart, day, slot, recipe_id: id, custom_title: null, updated_at: now });
      }
    }

    if (!rows.length) return NextResponse.json({ error: "Edge returned an empty plan — try again." }, { status: 502 });

    const { error: upsertErr } = await supabase
      .from("meal_plans")
      .upsert(rows, { onConflict: "user_id,week_start,day,slot" });
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

    const plan: Plan = rows.map(({ day, slot, recipe_id, custom_title }) => ({ day, slot, recipe_id, custom_title }));
    return NextResponse.json({ plan, note: parsed.note ?? "Done — your week's in." });
  } catch (e) {
    console.error("[nutrition/plan]", e);
    return NextResponse.json({ error: "Something went wrong building the plan." }, { status: 500 });
  }
}
