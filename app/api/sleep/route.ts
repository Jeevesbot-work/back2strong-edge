import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rejectIfViewing } from "@/lib/view-as-server";

export async function POST(req: NextRequest) {
  const blocked = await rejectIfViewing();
  if (blocked) return blocked;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { bedtime?: unknown; wake_time?: unknown; quality?: unknown; duration_hours?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const quality = Number(body.quality);
  const duration = Number(body.duration_hours);
  const bedtime = String(body.bedtime ?? "").slice(0, 8);
  const wake = String(body.wake_time ?? "").slice(0, 8);
  if (!bedtime || !wake || !Number.isFinite(quality)) {
    return NextResponse.json({ error: "Missing sleep" }, { status: 400 });
  }

  const { error } = await supabase.from("sleep_logs").upsert({
    user_id: user.id,
    date: new Date().toISOString().split("T")[0],
    bedtime,
    wake_time: wake,
    quality: Math.max(1, Math.min(10, Math.round(quality))),
    duration_hours: Number.isFinite(duration) ? duration : null,
  }, { onConflict: "user_id,date" });
  if (error) return NextResponse.json({ error: "Couldn't save sleep." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
