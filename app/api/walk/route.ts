import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALREADY_LOGGED, recentWalks, walkIsDuplicate } from "@/lib/logs/duplicate";
import { rejectIfViewing } from "@/lib/view-as-server";

// Log a walk for the signed-in client. Kept dead simple: minutes + today's
// date. RLS ensures a client can only ever write their own rows.
export async function POST(req: NextRequest) {
  const blocked = await rejectIfViewing();
  if (blocked) return blocked;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { minutes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const minutes = Math.round(Number(body?.minutes));
  if (!minutes || minutes <= 0 || minutes > 600) {
    return NextResponse.json({ error: "Minutes must be between 1 and 600" }, { status: 400 });
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const recent = await recentWalks(supabase, user.id, now);
  if (walkIsDuplicate(recent, minutes, now)) {
    return NextResponse.json({ error: ALREADY_LOGGED }, { status: 409 });
  }

  const { error } = await supabase
    .from("walk_logs")
    .insert({ user_id: user.id, date: today, minutes });

  if (error) {
    console.error("[walk] insert error:", error);
    return NextResponse.json({ error: "Could not save walk" }, { status: 500 });
  }

  // Return today's running total so the UI can update instantly.
  const { data: todays } = await supabase
    .from("walk_logs")
    .select("minutes")
    .eq("user_id", user.id)
    .eq("date", today);
  const totalToday = (todays ?? []).reduce((s, w) => s + (w.minutes ?? 0), 0);

  return NextResponse.json({ ok: true, totalToday });
}
