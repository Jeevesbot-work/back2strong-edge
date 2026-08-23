import { createAdminClient, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CommandCentre from "./CommandCentre";

const ADMIN_EMAILS = ["n.adams3@icloud.com", "nicosmada3@googlemail.com", "nick@back2strong.online"];

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) redirect("/login");

  const admin = createAdminClient();

  // Overnight cutoff — last 10 hours
  const cutoff = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();

  const [
    { data: profiles },
    { data: recentCheckIns },
    { data: recentMessages },
    { data: recentMealLogs },
    { data: recentTrainingSessions },
    { data: tasks },
    { data: coachNotes },
    { data: lastCheckIns },
    { data: lastTraining },
    { data: lastMeals },
  ] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, approved, created_at").order("created_at", { ascending: false }),
    admin.from("check_ins").select("*, profiles(full_name)").gte("created_at", cutoff).order("created_at", { ascending: false }),
    admin.from("messages").select("*, profiles(full_name)").eq("role", "user").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(20),
    admin.from("nutrition_logs").select("*, profiles(full_name)").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(20),
    admin.from("training_sessions").select("*, profiles(full_name)").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(20),
    admin.from("admin_tasks").select("*").order("position", { ascending: true }),
    admin.from("coach_notes").select("*").order("created_at", { ascending: false }).limit(10),
    admin.from("check_ins").select("user_id, date, profiles(full_name)").order("date", { ascending: false }).limit(200),
    admin.from("training_sessions").select("user_id, completed_at, created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("nutrition_logs").select("user_id, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending = (profiles ?? []).filter((p: any) => !p.approved);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active = (profiles ?? []).filter((p: any) => p.approved);

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
  const activeWithActivity = active.map((p: any) => {
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

  return (
    <CommandCentre
      active={activeWithActivity}
      pending={pending}
      recentCheckIns={recentCheckIns ?? []}
      recentMessages={recentMessages ?? []}
      recentMealLogs={Array.isArray(recentMealLogs) ? recentMealLogs : []}
      recentTrainingSessions={Array.isArray(recentTrainingSessions) ? recentTrainingSessions : []}
      tasks={Array.isArray(tasks) ? tasks : []}
      coachNotes={Array.isArray(coachNotes) ? coachNotes.filter((n) => !String((n as { tag?: string }).tag ?? "").startsWith("audit:")) : []}
    />
  );
}
