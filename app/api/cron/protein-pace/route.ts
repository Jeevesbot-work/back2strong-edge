import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";
import { composeNudge, paceStatus, type RecipeSuggestion } from "@/lib/protein-pace";
import { testColumnMissing } from "@/lib/clients/roster";

// web-push needs the Node crypto runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Fire when a client is under this fraction of their protein target.
const BEHIND_THRESHOLD = 0.7;

// ── TIME ZONE ASSUMPTION (flag for Nick) ──────────────────────────────────
// profiles has no per-user time zone column yet, so "today" and "evening" are
// both computed in UTC, and the cron is scheduled for 18:00 UTC. This matches
// how the app already stamps nutrition_logs.date (Postgres CURRENT_DATE, UTC)
// and how the Fuel page reads "today" (UTC). To deliver at each client's local
// 18:00 later: add profiles.time_zone, switch the Vercel cron to hourly, and
// only fire for users whose local hour is the cutoff. The 18:00 cutoff itself
// is a starting assumption, not fixed — confirm with Nick.
// ──────────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>`.
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  // Force the evening branch when testing outside the scheduled 18:00 UTC run.
  const eveningOverride = url.searchParams.get("evening");
  const isEvening =
    eveningOverride === "1" ? true : eveningOverride === "0" ? false : new Date().getUTCHours() >= 17;

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:nick@back2strong.online";
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0]; // UTC — see note above.

  // 1. Active clients: profiles that have an active programme.
  const { data: activeStates, error: stateErr } = await supabase
    .from("programme_state")
    .select("user_id")
    .eq("active", true);
  if (stateErr) {
    console.error("[protein-pace] programme_state error:", stateErr);
    return NextResponse.json({ error: "Could not load active clients" }, { status: 500 });
  }
  const userIds = (activeStates ?? []).map((s) => s.user_id).filter(Boolean);
  if (userIds.length === 0) return NextResponse.json({ ok: true, considered: 0, sent: 0 });

  const flagged = await supabase
    .from("profiles")
    .select("id, full_name, protein_target, barrier_tags, last_protein_nudge_date, is_test")
    .in("id", userIds);
  const profilesResult = flagged.error && testColumnMissing(flagged.error)
    ? await supabase
      .from("profiles")
      .select("id, full_name, protein_target, barrier_tags, last_protein_nudge_date")
      .in("id", userIds)
    : flagged;
  const profiles = profilesResult.data;
  const profErr = profilesResult.error;
  if (profErr) {
    console.error("[protein-pace] profiles error:", profErr);
    return NextResponse.json({ error: "Could not load profiles" }, { status: 500 });
  }

  // 2. High-protein recipes, pulled once and reused. Prefer quick/snack in the
  //    evening. We never invent food ideas — suggestions come from this table.
  const { data: recipeRows } = await supabase
    .from("recipes")
    .select("title, protein_g, tags, category")
    .eq("published", true)
    .not("protein_g", "is", null)
    .order("protein_g", { ascending: false })
    .limit(40);

  const allRecipes: (RecipeSuggestion & { category: string | null })[] = (recipeRows ?? []).map((r) => ({
    title: r.title,
    protein_g: r.protein_g,
    tags: r.tags,
    category: r.category,
  }));

  const isQuick = (r: (typeof allRecipes)[number]) =>
    r.category === "snack" ||
    (r.tags ?? []).some((t) => ["quick", "snack", "meal-prep", "3-ingredient"].includes(t.toLowerCase()));

  // Evening → quick/snack first, then remaining high-protein; otherwise straight
  // high-protein order. Either way the list is already protein-desc.
  const orderedRecipes = isEvening
    ? [...allRecipes.filter(isQuick), ...allRecipes.filter((r) => !isQuick(r))]
    : allRecipes;

  const results: Array<Record<string, unknown>> = [];
  let sentCount = 0;

  for (const p of profiles ?? []) {
    if ("is_test" in p && p.is_test === true) {
      results.push({ name: p.full_name, skipped: "test_account" });
      continue;
    }
    const target = p.protein_target ?? 0;
    if (target <= 0) continue;

    // Already nudged today? (once-per-day guard)
    if (p.last_protein_nudge_date === today) {
      results.push({ name: p.full_name, skipped: "already_nudged_today" });
      continue;
    }

    // Sum today's protein.
    const { data: logs } = await supabase
      .from("nutrition_logs")
      .select("protein_g")
      .eq("user_id", p.id)
      .eq("date", today);
    const proteinToday = (logs ?? []).reduce((s, l) => s + (Number(l.protein_g) || 0), 0);

    const status = paceStatus(proteinToday, target);
    if (status !== "behind") {
      results.push({ name: p.full_name, status, skipped: "not_behind" });
      continue;
    }

    // Does this client have any push subscriptions? If not, nothing to send —
    // don't burn the daily guard so they can still be reached if they opt in.
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", p.id);

    const firstName = (p.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    const nudge = composeNudge({
      firstName,
      proteinToday,
      proteinTarget: target,
      barrierTags: (p.barrier_tags as string[]) ?? [],
      isEvening,
      recipes: orderedRecipes.slice(0, 3),
    });

    const record: Record<string, unknown> = {
      name: p.full_name,
      status,
      subscriptions: subs?.length ?? 0,
      title: nudge.title,
      body: nudge.body,
      wouldSend: (subs?.length ?? 0) > 0,
    };

    if (!subs || subs.length === 0) {
      record.skipped = "no_subscription";
      results.push(record);
      continue;
    }

    if (dry) {
      record.dryRun = true;
      results.push(record);
      continue;
    }

    // Send to every registered device; clean up expired subscriptions.
    let deliveredToAny = false;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(nudge)
        );
        deliveredToAny = true;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is dead — remove it so we stop trying.
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[protein-pace] send error:", statusCode, err);
        }
      }
    }

    if (deliveredToAny) {
      await supabase.from("profiles").update({ last_protein_nudge_date: today }).eq("id", p.id);
      sentCount++;
      record.sent = true;
    } else {
      record.sent = false;
      record.note = "all_subscriptions_failed";
    }
    results.push(record);
  }

  return NextResponse.json({
    ok: true,
    dry,
    isEvening,
    today,
    considered: profiles?.length ?? 0,
    sent: sentCount,
    results,
  });
}
