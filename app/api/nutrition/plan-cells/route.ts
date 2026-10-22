import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SLOTS } from "@/lib/meal-plan";
import { rejectIfViewing } from "@/lib/view-as-server";

const SLOT_SET = new Set<string>(SLOTS);

// Save planner cells for the signed-in client. Rejected outright while an
// admin is viewing someone else's app, before any row is written.
export async function POST(req: NextRequest) {
  const blocked = await rejectIfViewing();
  if (blocked) return blocked;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { weekStart?: unknown; cells?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const weekStart = String(body.weekStart ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "Missing week" }, { status: 400 });
  }
  if (!Array.isArray(body.cells) || body.cells.length === 0 || body.cells.length > 40) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const rows = [];
  for (const cell of body.cells) {
    if (!cell || typeof cell !== "object") continue;
    const day = Number((cell as { day?: unknown }).day);
    const slot = String((cell as { slot?: unknown }).slot ?? "");
    if (!Number.isInteger(day) || day < 0 || day > 6 || !SLOT_SET.has(slot)) continue;
    const recipeId = (cell as { recipe_id?: unknown }).recipe_id;
    const custom = (cell as { custom_title?: unknown }).custom_title;
    rows.push({
      user_id: user.id,
      week_start: weekStart,
      day,
      slot,
      recipe_id: typeof recipeId === "string" && recipeId ? recipeId : null,
      custom_title: typeof custom === "string" && custom ? custom.slice(0, 80) : null,
      updated_at: now,
    });
  }
  if (!rows.length) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

  const { error } = await supabase.from("meal_plans").upsert(rows, { onConflict: "user_id,week_start,day,slot" });
  if (error) return NextResponse.json({ error: "Couldn't save that change." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
