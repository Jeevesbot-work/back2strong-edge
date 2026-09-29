import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

// Coach "Preview App" support for the Fuel tab. The Fuel page loads data in
// the browser for the signed-in user, so on its own it can't show a client
// while Nick is previewing. When the admin preview cookie is set, this returns
// that client's Fuel data so the page renders exactly what they see.
export async function GET() {
  const previewId = cookies().get("preview_user_id")?.value;
  if (!previewId || !(await isAuthorisedAdmin())) return NextResponse.json({ previewing: false });

  const db = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const since = new Date(); since.setDate(since.getDate() - 6);
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 28);
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

  const [{ data: profile }, { data: logs }, { data: weekRows }, { data: checkIns }, { data: reports }] = await Promise.all([
    db.from("profiles").select("full_name, protein_target, calorie_target, goal").eq("id", previewId).single(),
    db.from("nutrition_logs").select("*").eq("user_id", previewId).eq("date", today).order("created_at", { ascending: false }),
    db.from("nutrition_logs").select("date, protein_g, calories").eq("user_id", previewId).gte("date", since.toISOString().split("T")[0]),
    db.from("check_ins").select("date, weight_kg").eq("user_id", previewId).not("weight_kg", "is", null).gte("date", monthAgo.toISOString().split("T")[0]).order("date", { ascending: true }),
    db.from("fuel_reports").select("*").eq("user_id", previewId).gte("created_at", threeDaysAgo).order("created_at", { ascending: false }).limit(1),
  ]);

  return NextResponse.json({
    previewing: true,
    name: profile?.full_name ?? null,
    profile,
    logs: logs ?? [],
    weekRows: weekRows ?? [],
    checkIns: checkIns ?? [],
    report: reports?.[0] ?? null,
  });
}
