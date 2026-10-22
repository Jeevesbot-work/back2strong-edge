import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rejectIfViewing } from "@/lib/view-as-server";

export async function POST(req: NextRequest) {
  const blocked = await rejectIfViewing();
  if (blocked) return blocked;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { recipeId?: unknown; starred?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const recipeId = String(body.recipeId ?? "");
  if (!recipeId || recipeId.length > 80 || typeof body.starred !== "boolean") {
    return NextResponse.json({ error: "Missing recipe" }, { status: 400 });
  }

  const { error } = body.starred
    ? await supabase.from("hero_meals").insert({ user_id: user.id, recipe_id: recipeId })
    : await supabase.from("hero_meals").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
  if (error) return NextResponse.json({ error: "Couldn't update that meal." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
