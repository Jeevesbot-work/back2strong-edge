import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";
import { resolveActingClient } from "@/lib/acting-client";

// Read the viewed client's meal plan. Select only.
export async function GET(req: NextRequest) {
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ viewing: false }, { status: 401 });

  const view = await resolveActingClient(user.id, user.email);
  if (!view.previewing) return NextResponse.json({ viewing: false });

  const weekStart = req.nextUrl.searchParams.get("weekStart") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "Missing week" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data } = await db
    .from("meal_plans")
    .select("day, slot, recipe_id, custom_title")
    .eq("user_id", view.targetId)
    .eq("week_start", weekStart);

  return NextResponse.json({
    viewing: true,
    name: view.name,
    cells: data ?? [],
  });
}
