import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_EMAILS, requireAdminPage } from "@/lib/admin/auth";
import CommandCentre from "./CommandCentre";
import { detectEarlyWarnings, type ActivityStamps } from "@/lib/coach/signals";
import { draftsTableMissing, openClientMessages, replyAgeLabel, type ThreadMessage } from "@/lib/coach/replies";
import type { OpenClientView, ReplyDraftView } from "@/components/admin/ReplyDrafts";
import { loadRosterProfiles, partitionProfiles, withoutTestUsers } from "@/lib/clients/roster";

export default async function AdminPage() {
  await requireAdminPage();

  const admin = createAdminClient();

  // Overnight cutoff — last 10 hours
  const cutoff = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();

  const [
    roster,
    { data: recentCheckIns },
    { data: recentMessages },
    { data: recentMealLogs },
    { data: recentTrainingSessions },
    { data: tasks },
    { data: coachNotes },
    { data: lastCheckIns },
    { data: lastTraining },
    { data: lastMeals },
    { data: threadRows },
    draftResult,
  ] = await Promise.all([
    loadRosterProfiles((columns) =>
      admin.from("profiles").select(columns).order("created_at", { ascending: false }),
    ),
    admin.from("check_ins").select("*, profiles(full_name)").gte("created_at", cutoff).order("created_at", { ascending: false }),
    admin.from("messages").select("*, profiles(full_name)").eq("role", "user").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(20),
    admin.from("nutrition_logs").select("*, profiles(full_name)").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(20),
    admin.from("training_sessions").select("*, profiles(full_name)").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(20),
    admin.from("admin_tasks").select("*").order("position", { ascending: true }),
    admin.from("coach_notes").select("*").order("created_at", { ascending: false }).limit(10),
    admin.from("check_ins").select("user_id, date, weight_kg, profiles(full_name)").order("date", { ascending: false }).limit(400),
    admin.from("training_sessions").select("user_id, completed_at, created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("nutrition_logs").select("user_id, created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("messages").select("id, user_id, role, content, created_at").order("created_at", { ascending: false }).limit(1000),
    admin.from("coach_reply_drafts").select("id, user_id, content, created_at, client_message_id").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
  ]);

  const profiles = roster.profiles;
  const testIds = new Set(profiles.filter((profile) => profile.is_test).map((profile) => profile.id));
  const split = partitionProfiles(profiles, ADMIN_EMAILS);
  const pending = split.pending;

  // Build last-check-in map per user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastCheckInMap: Record<string, string> = {};
  for (const c of (lastCheckIns ?? [])) {
    if (!lastCheckInMap[c.user_id]) lastCheckInMap[c.user_id] = c.date;
  }

  // Build last-training and last-meal maps so "quiet" reflects ALL activity
  // types, not just check-ins — a client who's training and eating well but
  // skipping the morning check-in shouldn't get flagged as gone dark.
  const lastTrainingMap: Record<string, string> = {};
  for (const s of (lastTraining ?? [])) {
    const stamp = s.completed_at ?? s.created_at;
    if (stamp && !lastTrainingMap[s.user_id]) lastTrainingMap[s.user_id] = stamp;
  }
  const lastMealMap: Record<string, string> = {};
  for (const m of (lastMeals ?? [])) {
    if (m.created_at && !lastMealMap[m.user_id]) lastMealMap[m.user_id] = m.created_at;
  }

  // Attach last check-in date and a unified "last seen" (most recent of any
  // activity type) to active profiles.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeWithActivity = split.clients.map((p: any) => {
    const stamps = [lastCheckInMap[p.id], lastTrainingMap[p.id], lastMealMap[p.id]].filter(Boolean) as string[];
    const lastSeen = stamps.length
      ? stamps.reduce((latest, s) => (new Date(s).getTime() > new Date(latest).getTime() ? s : latest))
      : null;
    return {
      ...p,
      last_check_in: lastCheckInMap[p.id] ?? null,
      last_seen: lastSeen,
    };
  });

  // ── Early-warning signals ── predictive, not reactive: catches a client
  // losing momentum while they're still engaged, before the 3-day "quiet"
  // flag would fire. See lib/coach/signals.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientProfiles = activeWithActivity;
  const stampsByUser: Record<string, string[]> = {};
  const pushStamp = (userId: string, stamp?: string | null) => {
    if (!stamp) return;
    (stampsByUser[userId] ??= []).push(stamp);
  };
  for (const c of (lastCheckIns ?? [])) pushStamp(c.user_id, c.date);
  for (const s of (lastTraining ?? [])) pushStamp(s.user_id, s.completed_at ?? s.created_at);
  for (const m of (lastMeals ?? [])) pushStamp(m.user_id, m.created_at);

  const weightsByUser: Record<string, { date: string; kg: number }[]> = {};
  // lastCheckIns arrives newest-first; reverse into chronological order.
  for (const c of [...(lastCheckIns ?? [])].reverse()) {
    const kg = (c as { weight_kg?: number | null }).weight_kg;
    if (typeof kg === "number" && c.date) (weightsByUser[c.user_id] ??= []).push({ date: c.date, kg });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signalInput: ActivityStamps[] = clientProfiles.map((p: any) => ({
    userId: p.id,
    name: p.full_name ?? p.email,
    stamps: stampsByUser[p.id] ?? [],
    weights: weightsByUser[p.id] ?? [],
  }));
  const earlyWarnings = detectEarlyWarnings(signalInput);

  const nameById = new Map<string, string>();
  const hiddenIds = new Set<string>(testIds);
  for (const profile of profiles) {
    nameById.set(profile.id, profile.full_name || profile.email || "Client");
    const email = String(profile.email ?? "").toLowerCase();
    if (email && ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === email)) hiddenIds.add(profile.id);
  }
  const textById = new Map<string, string>();
  const thread: ThreadMessage[] = [];
  for (const row of threadRows ?? []) {
    if ((row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string" || !row.created_at) continue;
    textById.set(row.id, row.content);
    if (hiddenIds.has(row.user_id)) continue;
    thread.push({ id: row.id, userId: row.user_id, role: row.role, content: row.content, createdAt: row.created_at });
  }
  const now = Date.now();
  const unanswered: OpenClientView[] = openClientMessages(thread, now)
    .filter((row) => row.overdue)
    .map((row) => ({
      messageId: row.messageId,
      userId: row.userId,
      name: nameById.get(row.userId) ?? "Client",
      content: row.content,
      ageLabel: replyAgeLabel(row.ageMs),
      overdue: true,
      href: `/admin/users/${row.userId}`,
    }));

  const draftsNotice = draftsTableMissing(draftResult.error)
    ? "Reply drafts are not in the database yet. Apply migration 0017_coach_reply_drafts.sql in the Supabase SQL editor."
    : draftResult.error
      ? "Couldn't load reply drafts."
      : null;
  const replyDrafts: ReplyDraftView[] = draftsNotice ? [] : (draftResult.data ?? []).flatMap((row) => {
    if (!row.id || !row.user_id || hiddenIds.has(row.user_id) || typeof row.content !== "string") return [];
    const name = nameById.get(row.user_id) ?? "Client";
    return [{
      id: row.id,
      userId: row.user_id,
      clientName: name.split(" ")[0] || name,
      clientMessage: row.client_message_id ? textById.get(row.client_message_id) ?? null : null,
      content: row.content,
      createdAt: row.created_at,
    }];
  });

  return (
    <CommandCentre
      active={activeWithActivity}
      earlyWarnings={earlyWarnings}
      pending={pending}
      recentCheckIns={withoutTestUsers(recentCheckIns, testIds, (row) => row.user_id)}
      recentMessages={withoutTestUsers(recentMessages, testIds, (row) => row.user_id)}
      recentMealLogs={withoutTestUsers(Array.isArray(recentMealLogs) ? recentMealLogs : [], testIds, (row) => row.user_id)}
      recentTrainingSessions={withoutTestUsers(Array.isArray(recentTrainingSessions) ? recentTrainingSessions : [], testIds, (row) => row.user_id)}
      tasks={Array.isArray(tasks) ? tasks : []}
      coachNotes={Array.isArray(coachNotes) ? coachNotes.filter((n) => !String((n as { tag?: string }).tag ?? "").startsWith("audit:")) : []}
      replyDrafts={replyDrafts}
      unanswered={unanswered}
      draftsNotice={draftsNotice}
      testAccounts={split.testAccounts}
      coachLogins={split.coaches}
      testFlagsReady={roster.flagReady}
    />
  );
}
