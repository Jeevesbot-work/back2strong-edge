import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAdminViewer } from "@/lib/admin/auth";
import { resolvePreviewTarget } from "@/lib/preview-user";

// Coach "Preview App" support for the Fuel tab. The Fuel page loads data in
// the browser for the signed-in user, so on its own it can't show a client
// while Nick is previewing. When the admin preview cookie is set, this returns
// that client's Fuel data so the page renders exactly what they see.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ previewing: false });

  const previewId = cookies().get("preview_user_id")?.value;
  const targetId = resolvePreviewTarget(user.id, previewId, await isAdminViewer(user.email));
  if (targetId === user.id) return NextResponse.json({ previewing: false });

  const db = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const since = new Date(); since.setDate(since.getDate() - 6);
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 28);
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

  const [{ data: profile }, { data: logs }, { data: weekRows }, { data: checkIns }, { data: reports }] = await Promise.all([
    db.from("profiles").select("full_name, protein_target, calorie_target, goal").eq("id", targetId).single(),
    db.from("nutrition_logs").select("*").eq("user_id", targetId).eq("date", today).order("created_at", { ascending: false }),
    db.from("nutrition_logs").select("date, protein_g, calories").eq("user_id", targetId).gte("date", since.toISOString().split("T")[0]),
    db.from("check_ins").select("date, weight_kg").eq("user_id", targetId).not("weight_kg", "is", null).gte("date", monthAgo.toISOString().split("T")[0]).order("date", { ascending: true }),
    db.from("fuel_reports").select("*").eq("user_id", targetId).gte("created_at", threeDaysAgo).order("created_at", { ascending: false }).limit(1),
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
