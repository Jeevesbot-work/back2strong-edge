import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resolveActingClient } from "@/lib/acting-client";
import { AreaChart } from "./charts";
import SleepTracker, { type SleepNight } from "./SleepTracker";

const B = "#C8A86E";
const BG = "#0E1014";
const SURFACE = "#171B21";
const BORDER = "#252A32";
const MUTED = "#9BA3AF";
const TEXT = "#F2F1ED";
const GREEN = "#34D399";
const AMBER = "#F5A623";
const RED = "#F87171";
const inter = "Inter, sans-serif";
const fraunces = "Fraunces, Georgia, serif";

const label: React.CSSProperties = { fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.2em" };
const cardStyle: React.CSSProperties = { background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 };

export default async function ProgressPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { targetId, previewing } = await resolveActingClient(user!.id, user!.email);
  const db = previewing ? createAdminClient() : supabase;

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: programme },
    { data: checkIns },
    { data: sessions },
    { data: lessonCompletions },
    { data: sleepLogs },
    { data: exerciseLogs },
    { data: walkLogs },
  ] = await Promise.all([
    db.from("programme_state").select("*").eq("user_id", targetId).single(),
    db.from("check_ins").select("*").eq("user_id", targetId).gte("created_at", ninetyDaysAgo).order("date", { ascending: true }),
    db.from("training_sessions").select("*").eq("user_id", targetId).not("completed_at", "is", null).order("completed_at", { ascending: false }),
    db.from("lesson_completions").select("*").eq("user_id", targetId),
    db.from("sleep_logs").select("*").eq("user_id", targetId).order("date", { ascending: true }).limit(30),
    db.from("exercise_logs").select("exercise_name, weight_kg, reps, created_at").eq("user_id", targetId).not("weight_kg", "is", null).gt("weight_kg", 0).order("created_at", { ascending: true }).limit(500),
    db.from("walk_logs").select("date, minutes").eq("user_id", targetId).gte("date", new Date(Date.now() - 21 * 86400000).toISOString().split("T")[0]).order("date", { ascending: true }),
  ]);

  // Walking — sum minutes per day over the last 14 days; this-week total + days walked.
  const walkByDate = new Map<string, number>();
  for (const w of walkLogs ?? []) walkByDate.set(w.date, (walkByDate.get(w.date) ?? 0) + (w.minutes ?? 0));
  const walkDays: { date: string; minutes: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    walkDays.push({ date: d, minutes: walkByDate.get(d) ?? 0 });
  }
  const mondayStr = (() => { const m = new Date(); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m.toISOString().split("T")[0]; })();
  const walkMinsThisWeek = (walkLogs ?? []).filter((w) => w.date >= mondayStr).reduce((s, w) => s + (w.minutes ?? 0), 0);
  const walkDaysThisWeek = new Set((walkLogs ?? []).filter((w) => w.date >= mondayStr).map((w) => w.date)).size;
  const totalWalkMins = walkDays.reduce((s, w) => s + w.minutes, 0);

  // ── Day-in-programme: derived from the REAL start_date, not the manual
  //    counter (which resets whenever a new block is assigned). ────────────
  const startDate = programme?.start_date ? new Date(programme.start_date) : null;
  const daysSinceStart = startDate
    ? Math.max(1, Math.floor((Date.now() - startDate.getTime()) / 86400000) + 1)
    : (programme?.current_day ?? 1);
  const dayOf90 = Math.min(daysSinceStart, 90);
  const journeyWeek = Math.max(1, Math.ceil(daysSinceStart / 7));

  const totalSessions = (sessions ?? []).length;
  const last4Weeks = (sessions ?? []).filter((s) => new Date(s.completed_at!) > new Date(Date.now() - 28 * 86400000)).length;
  const consistencyPct = Math.min(100, Math.round((last4Weeks / 12) * 100));

  const avgEnergy = checkIns && checkIns.length
    ? (checkIns.reduce((s, c) => s + (c.morning_energy ?? 0), 0) / checkIns.length).toFixed(1)
    : "—";

  const checkInStreak = (() => {
    if (!checkIns || checkIns.length === 0) return 0;
    const dates = new Set(checkIns.map((c) => c.date));
    let streak = 0;
    const cursor = new Date();
    // Allow the streak to count from today or yesterday (hasn't checked in yet today).
    if (!dates.has(cursor.toISOString().split("T")[0])) cursor.setDate(cursor.getDate() - 1);
    while (dates.has(cursor.toISOString().split("T")[0])) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  })();

  // Weight series (logged at daily check-in).
  const weightSeries = (checkIns ?? []).filter((c) => c.weight_kg != null).map((c) => ({ date: c.date, kg: Number(c.weight_kg) }));
  const latestWeight = weightSeries.length ? weightSeries[weightSeries.length - 1].kg : null;
  const firstWeight = weightSeries.length ? weightSeries[0].kg : null;
  const weightDelta = latestWeight != null && firstWeight != null ? +(latestWeight - firstWeight).toFixed(1) : null;

  // Energy series (1–5), last 21 days.
  const energyPoints = (checkIns ?? []).map((c) => c.morning_energy ?? 0).slice(-21);

  const lessonsCompleted = (lessonCompletions ?? []).length;
  const totalLessonsInCycle = 30;
  const lessonPct = Math.round((lessonsCompleted / totalLessonsInCycle) * 100);

  // Strength: max weight per exercise per day.
  const strengthMap = new Map<string, Array<{ date: string; weight: number; reps: number | null }>>();
  for (const log of exerciseLogs ?? []) {
    if (!log.weight_kg) continue;
    const date = log.created_at.split("T")[0];
    if (!strengthMap.has(log.exercise_name)) strengthMap.set(log.exercise_name, []);
    const arr = strengthMap.get(log.exercise_name)!;
    const existing = arr.find((e) => e.date === date);
    if (existing) { if (log.weight_kg > existing.weight) { existing.weight = log.weight_kg; existing.reps = log.reps; } }
    else arr.push({ date, weight: log.weight_kg, reps: log.reps });
  }
  const topExercises = Array.from(strengthMap.entries())
    .map(([name, data]) => ({ name, data: data.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => b.data.length - a.data.length)
    .slice(0, 6);

  // Sleep nights — merge sleep_logs with that day's check-in for context.
  const checkinByDate = new Map((checkIns ?? []).map((c) => [c.date, c]));
  const nights: SleepNight[] = (sleepLogs ?? []).slice(-21).map((s) => {
    const ci = checkinByDate.get(s.date);
    return {
      date: s.date,
      quality: s.quality ?? null,
      duration: s.duration_hours != null ? Number(s.duration_hours) : null,
      bedtime: s.bedtime ? String(s.bedtime).slice(0, 5) : null,
      wake: s.wake_time ? String(s.wake_time).slice(0, 5) : null,
      stress: ci?.stress_level ?? null,
      energy: ci?.morning_energy ?? null,
      notes: ci?.notes ?? null,
    };
  });

  return (
    <div style={{ maxWidth: 512, margin: "0 auto", padding: "0 16px 32px", background: BG }}>
      {/* Header */}
      <div style={{ padding: "20px 0 12px" }}>
        <h1 style={{ fontFamily: fraunces, fontSize: 40, fontWeight: 400, color: TEXT, lineHeight: 1 }}>Progress.</h1>
        <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, marginTop: 4 }}>
          Week {journeyWeek} · Day {dayOf90} of 90
        </p>
      </div>

      {/* 90-day journey ring/bar */}
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
          <svg viewBox="0 0 64 64" width={64} height={64}>
            <circle cx={32} cy={32} r={28} fill="none" stroke={BORDER} strokeWidth={6} />
            <circle
              cx={32} cy={32} r={28} fill="none" stroke={B} strokeWidth={6} strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 28}
              strokeDashoffset={2 * Math.PI * 28 * (1 - dayOf90 / 90)}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: fraunces, fontSize: 18, color: TEXT, lineHeight: 1 }}>{Math.round((dayOf90 / 90) * 100)}%</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ ...label, marginBottom: 4 }}>Strong90 Journey</p>
          <p style={{ fontFamily: inter, fontSize: 14, color: TEXT, fontWeight: 500 }}>Day {dayOf90} of 90</p>
          <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, marginTop: 2 }}>{90 - dayOf90} days to go</p>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Sessions", value: String(totalSessions), sub: "Completed", color: TEXT },
          { label: "Consistency", value: `${consistencyPct}%`, sub: "Last 4 weeks", color: consistencyPct >= 80 ? GREEN : consistencyPct >= 50 ? AMBER : RED },
          { label: "Avg Energy", value: avgEnergy, sub: "of 5", color: B },
          { label: "Check-in Streak", value: String(checkInStreak), sub: checkInStreak === 1 ? "day" : "days", color: B },
        ].map((t) => (
          <div key={t.label} style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 16 }}>
            <p style={{ ...label, marginBottom: 8 }}>{t.label}</p>
            <p style={{ fontFamily: fraunces, fontSize: 34, color: t.color, fontWeight: 400, lineHeight: 1 }}>{t.value}</p>
            <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, marginTop: 4 }}>{t.sub}</p>
          </div>
        ))}
      </div>

      {/* Weight trend — area chart */}
      {latestWeight != null && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
            <p style={label}>Weight</p>
            {weightDelta != null && weightSeries.length > 1 && (
              <span style={{ fontFamily: inter, fontSize: 11, fontWeight: 600, color: weightDelta < 0 ? GREEN : weightDelta > 0 ? AMBER : MUTED }}>
                {weightDelta > 0 ? "+" : ""}{weightDelta} kg since start
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
            <span style={{ fontFamily: fraunces, fontSize: 40, color: TEXT, fontWeight: 400, lineHeight: 1 }}>{latestWeight}</span>
            <span style={{ fontFamily: inter, fontSize: 13, color: MUTED }}>kg</span>
          </div>
          {weightSeries.length > 1 ? (
            <>
              <AreaChart id="weight" data={weightSeries.map((w) => w.kg)} color={B} height={90} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontFamily: inter, fontSize: 10, color: MUTED }}>{new Date(weightSeries[0].date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                <span style={{ fontFamily: inter, fontSize: 10, color: MUTED }}>Today</span>
              </div>
            </>
          ) : (
            <p style={{ fontFamily: inter, fontSize: 12, color: MUTED }}>Log your weight at check-in to see the trend build.</p>
          )}
        </div>
      )}

      {/* Energy trend — area chart */}
      {energyPoints.length > 1 && (
        <div style={cardStyle}>
          <p style={{ ...label, marginBottom: 12 }}>Energy · last {energyPoints.length} days</p>
          <AreaChart id="energy" data={energyPoints} color={GREEN} height={70} min={0} max={5} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontFamily: inter, fontSize: 10, color: MUTED }}>{energyPoints.length} days ago</span>
            <span style={{ fontFamily: inter, fontSize: 10, color: MUTED }}>Today</span>
          </div>
        </div>
      )}

      {/* Walking */}
      {totalWalkMins > 0 && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
            <p style={label}>Walking</p>
            <span style={{ fontFamily: inter, fontSize: 11, fontWeight: 600, color: B }}>{walkDaysThisWeek} day{walkDaysThisWeek === 1 ? "" : "s"} this week</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
            <span style={{ fontFamily: fraunces, fontSize: 40, color: TEXT, fontWeight: 400, lineHeight: 1 }}>{walkMinsThisWeek}</span>
            <span style={{ fontFamily: inter, fontSize: 13, color: MUTED }}>min this week</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
            {walkDays.map((w) => {
              const maxM = Math.max(...walkDays.map((d) => d.minutes), 1);
              return (
                <div key={w.date} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{
                    width: "100%", borderRadius: 4, minHeight: w.minutes > 0 ? 4 : 0,
                    height: `${(w.minutes / maxM) * 100}%`,
                    background: w.minutes > 0 ? B : "transparent",
                    border: w.minutes > 0 ? "none" : "1px solid " + BORDER,
                    borderBottom: w.minutes > 0 ? "none" : "1px solid " + BORDER,
                    opacity: 0.85,
                  }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontFamily: inter, fontSize: 10, color: MUTED }}>14 days ago</span>
            <span style={{ fontFamily: inter, fontSize: 10, color: MUTED }}>Today</span>
          </div>
        </div>
      )}

      {/* Sleep — interactive tracker */}
      {nights.length > 0 && <SleepTracker nights={nights} />}

      {/* Strength progress */}
      {topExercises.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <p style={{ ...label, marginBottom: 12 }}>Strength Progress</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topExercises.map(({ name, data }) => {
              const latest = data[data.length - 1];
              const first = data[0];
              const gain = +(latest.weight - first.weight).toFixed(1);
              const shortName = name.replace(/\s*\([^)]*\)/g, "").trim();
              return (
                <div key={name} style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: data.length > 1 ? 12 : 0 }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                      <p style={{ fontFamily: fraunces, fontSize: 15, color: TEXT }}>{shortName}</p>
                      {latest.reps && <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, marginTop: 2 }}>Last: {latest.reps} reps</p>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontFamily: inter, fontSize: 22, fontWeight: 700, color: TEXT, lineHeight: 1 }}>{latest.weight}<span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}> kg</span></p>
                      {gain !== 0 && <p style={{ fontFamily: inter, fontSize: 11, color: gain > 0 ? GREEN : AMBER, marginTop: 2 }}>{gain > 0 ? "+" : ""}{gain}kg</p>}
                    </div>
                  </div>
                  {data.length > 1 && <AreaChart id={`str-${shortName.replace(/\s+/g, "")}`} data={data.map((d) => d.weight)} color={B} height={40} showDot={false} />}
                  {data.length === 1 && <p style={{ fontFamily: inter, fontSize: 11, color: "#3D434D", marginTop: 8 }}>Log more sessions to see your trend</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STRONG System */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={label}>STRONG System</p>
          <p style={{ fontFamily: inter, fontSize: 12, color: TEXT }}>{lessonsCompleted}/{totalLessonsInCycle}</p>
        </div>
        <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${lessonPct}%`, background: B, borderRadius: 99 }} />
        </div>
        <p style={{ fontFamily: inter, fontSize: 11, color: MUTED }}>{lessonPct}% of Cycle 1 complete</p>
      </div>

      {/* Weekly review CTA */}
      <a href="/weekly-review" style={{ textDecoration: "none" }}>
        <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid rgba(200,168,110,0.3)`, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(200,168,110,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth={2} style={{ width: 20, height: 20 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: inter, fontSize: 14, fontWeight: 600, color: TEXT }}>Weekly Review</p>
            <p style={{ fontFamily: inter, fontSize: 12, color: MUTED }}>5 minutes. Be honest.</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={2} style={{ width: 16, height: 16, flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </a>
    </div>
  );
}
