import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";
import { macroTargets, sumItems, toItems, suggestNote } from "@/lib/fuel-report";

// GET  ?userId=&date=YYYY-MM-DD  → the client's logged day, totals vs targets,
//                                  duplicate flags and a suggested note.
// POST { userId, date, note }    → saves a Fuel Report the client sees on their
//                                  Fuel tab, plus a heads-up in their Edge chat.

async function buildDay(userId: string, date: string) {
  const admin = createAdminClient();
  const [{ data: profile }, { data: logs }, { data: sent }, { data: prog }] = await Promise.all([
    admin.from("profiles").select("full_name, calorie_target, protein_target").eq("id", userId).single(),
    admin.from("nutrition_logs").select("meal_name, calories, protein_g, carbs_g, fat_g, created_at").eq("user_id", userId).eq("date", date).order("created_at", { ascending: true }),
    admin.from("fuel_reports").select("id, created_at").eq("user_id", userId).eq("date", date).order("created_at", { ascending: false }).limit(1),
    admin.from("client_programmes").select("programme->nutrition").eq("user_id", userId).maybeSingle(),
  ]);
  const nut = ((prog as { nutrition?: { fatTarget?: number; carbTarget?: number } } | null)?.nutrition) ?? {};
  const items = toItems(logs ?? []);
  const targets = macroTargets(profile?.calorie_target ?? null, profile?.protein_target ?? null, nut.fatTarget, nut.carbTarget);
  const totals = sumItems(items);
  const firstName = (profile?.full_name ?? "Mate").split(" ")[0];
  const dupes = items.filter((i) => i.duplicate);
  return {
    firstName,
    items,
    totals,
    targets,
    suggestedNote: items.length ? suggestNote(firstName, totals, targets, dupes) : "",
    lastSentAt: sent?.[0]?.created_at ?? null,
  };
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorisedAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const userId = req.nextUrl.searchParams.get("userId");
  const date = req.nextUrl.searchParams.get("date");
  if (!userId || !date) return NextResponse.json({ error: "userId and date required" }, { status: 400 });
  return NextResponse.json(await buildDay(userId, date));
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorisedAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { userId, date, note } = await req.json();
  if (!userId || !date) return NextResponse.json({ error: "userId and date required" }, { status: 400 });

  const day = await buildDay(userId, date);
  if (!day.items.length) return NextResponse.json({ error: "Nothing logged that day" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("fuel_reports").insert({
    user_id: userId,
    date,
    totals: day.totals,
    targets: day.targets,
    items: day.items,
    note: (note ?? "").trim() || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Heads-up in the Edge chat — also surfaces as the coach note on Home.
  const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" });
  await admin.from("messages").insert({
    user_id: userId,
    role: "assistant",
    content: `Nick's reviewed your food for ${dayLabel}. Your full macro breakdown and his notes are at the top of the Fuel tab.`,
  });

  return NextResponse.json({ ok: true });
}
