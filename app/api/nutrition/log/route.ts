import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALREADY_LOGGED, foodIsDuplicate, recentFoodLogs } from "@/lib/logs/duplicate";

// Direct logs (barcode, recipe, typed macros) that do not go through the model.
// Auth matches the old client insert: a signed-in user, with RLS limiting the row
// to themselves. The approval gate stays on the AI routes only.
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    const userId = user.id;

    const body = await req.json();
    const meal_name = String(body.meal_name ?? "").trim().slice(0, 120);
    const calories = Math.round(Number(body.calories));
    const protein_g = Math.round(Number(body.protein_g) * 10) / 10;
    const carbs_g = Math.round(Number(body.carbs_g) * 10) / 10;
    const fat_g = Math.round(Number(body.fat_g) * 10) / 10;
    const edge_comment = String(body.edge_comment ?? "").slice(0, 400);

    if (!meal_name || !Number.isFinite(calories) || calories < 0) {
      return NextResponse.json({ error: "Give it a name and calories at least." }, { status: 400 });
    }

    const meal = {
      meal_name,
      calories,
      protein_g: Number.isFinite(protein_g) ? protein_g : 0,
      carbs_g: Number.isFinite(carbs_g) ? carbs_g : 0,
      fat_g: Number.isFinite(fat_g) ? fat_g : 0,
    };

    const now = new Date();
    const recent = await recentFoodLogs(supabase, userId, now);
    if (foodIsDuplicate(recent, meal, now)) {
      return NextResponse.json({ error: ALREADY_LOGGED }, { status: 409 });
    }

    const { data: log, error } = await supabase
      .from("nutrition_logs")
      .insert({ user_id: userId, ...meal, edge_comment })
      .select()
      .single();

    if (error || !log) {
      console.error("[nutrition] direct log failed:", error?.message);
      return NextResponse.json({ error: "Couldn't save that log. Try again." }, { status: 500 });
    }

    return NextResponse.json(log);
  } catch (err) {
    console.error("[nutrition] direct log error:", err);
    return NextResponse.json({ error: "Couldn't save that log. Try again." }, { status: 500 });
  }
}
