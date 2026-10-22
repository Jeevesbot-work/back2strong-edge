import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rejectIfViewing } from "@/lib/view-as-server";

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Updates only the signed-in client's own targets. Never the viewed client.
export async function POST(req: NextRequest) {
  const blocked = await rejectIfViewing();
  if (blocked) return blocked;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { calorie_target?: unknown; protein_target?: unknown; body_weight_kg?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: { calorie_target?: number; protein_target?: number; body_weight_kg?: number | null } = {};
  const calories = num(body.calorie_target);
  const protein = num(body.protein_target);
  const weight = num(body.body_weight_kg);
  if (calories != null) updates.calorie_target = Math.max(800, Math.min(6000, Math.round(calories)));
  if (protein != null) updates.protein_target = Math.max(40, Math.min(400, Math.round(protein)));
  if (body.body_weight_kg === null) updates.body_weight_kg = null;
  else if (weight != null) updates.body_weight_kg = Math.round(weight * 10) / 10;
  if (!Object.keys(updates).length) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  return NextResponse.json({ ok: true, ...updates });
}
