import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { userId, week } = await req.json();
  if (!userId || !week) {
    return NextResponse.json({ error: "Missing userId or week" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("programme_state")
    .upsert({ user_id: userId, current_week: week, current_day: 1 }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
