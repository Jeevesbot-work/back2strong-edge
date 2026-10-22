import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rejectIfViewing } from "@/lib/view-as-server";

export async function POST(req: NextRequest) {
  const blocked = await rejectIfViewing();
  if (blocked) return blocked;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { day?: unknown; reflection?: unknown; micro_action_done?: unknown; end_of_day_score?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const day = Number(body.day);
  if (!Number.isInteger(day) || day < 1 || day > 30) {
    return NextResponse.json({ error: "Missing lesson" }, { status: 400 });
  }

  const { data: prog } = await supabase.from("programme_state").select("current_day").eq("user_id", user.id).maybeSingle();
  const cycle = prog?.current_day ? Math.ceil(Number(prog.current_day) / 30) : 1;
  const score = body.end_of_day_score == null ? null : Number(body.end_of_day_score);

  const { error } = await supabase.from("lesson_completions").upsert({
    user_id: user.id,
    day_number: day,
    cycle,
    reflection: String(body.reflection ?? "").slice(0, 2000),
    micro_action_done: body.micro_action_done === true,
    end_of_day_score: score != null && score >= 1 && score <= 10 ? score : null,
    completed_at: new Date().toISOString(),
  }, { onConflict: "user_id,day_number,cycle" });
  if (error) return NextResponse.json({ error: "Couldn't save that lesson." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
