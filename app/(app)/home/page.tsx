import { createClient, createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { getLesson } from "@/lib/data/lessons";
import { getClientProgramme, blockSessionKeys } from "@/lib/data/programme-loader";
import { RevealGroup } from "@/components/Reveal";
import WalkLogger from "@/components/WalkLogger";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
}

function getDateLine(): string {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function ReadinessRing({ score, max = 5 }: { score: number; max?: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / max, 1);
  const offset = circ * (1 - pct);
  const displayScore = Math.round(score * 20); // convert 0-5 to 0-100

  const color = displayScore >= 70 ? "#C8965A" : displayScore >= 40 ? "#F5A623" : "#9BA3AF";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 88, height: 88 }}>
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90 absolute inset-0">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center">
        <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 26, fontWeight: 400, color: "#F2F1ED", lineHeight: 1 }}>
          {displayScore}
        </span>
        <span style={{ fontSize: 9, color: "#9BA3AF", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Inter, sans-serif", marginTop: 2 }}>
          Ready
        </span>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = cookies();
  const previewId = cookieStore.get("preview_user_id")?.value;
  const targetId = previewId ?? user!.id;
  const db = previewId ? createAdminClient() : supabase;

  const today = new Date().toISOString().split("T")[0];

  const [
    { data: profile },
    { data: programme },
    { data: todayCheckin },
    { data: recentSessions },
    { data: lastMessage },
    { data: todayFuel },
    { data: todayWalks },
  ] = await Promise.all([
    db.from("profiles").select("*").eq("id", targetId).single(),
    db.from("programme_state").select("*").eq("user_id", targetId).single(),
    db.from("check_ins").select("*").eq("user_id", targetId).eq("date", today).single(),
    db.from("training_sessions").select("session_type, completed_at").eq("user_id", targetId).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(7),
    db.from("messages").select("content").eq("user_id", targetId).eq("role", "assistant").order("created_at", { ascending: false }).limit(1),
    db.from("nutrition_logs").select("protein_g, calories").eq("user_id", targetId).eq("date", today),
    db.from("walk_logs").select("minutes").eq("user_id", targetId).eq("date", today),
  ]);

  const walkMinutesToday = (todayWalks ?? []).reduce((s, w) => s + (w.minutes ?? 0), 0);

  // Today's fuel — collated from the meals the client has logged so far today.
  const proteinTarget = (profile?.protein_target && profile.protein_target > 0) ? profile.protein_target : 160;
  const calorieTarget = (profile?.calorie_target && profile.calorie_target > 0) ? profile.calorie_target : 2200;
  const fuelProtein = Math.round((todayFuel ?? []).reduce((s, l) => s + (Number(l.protein_g) || 0), 0));
  const fuelCalories = Math.round((todayFuel ?? []).reduce((s, l) => s + (Number(l.calories) || 0), 0));
  const fuelLogged = (todayFuel?.length ?? 0) > 0;
  const proteinPct = Math.min((fuelProtein / proteinTarget) * 100, 100);
  const proteinHit = fuelProtein >= proteinTarget;

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const currentDay = programme?.current_day ?? 1;
  const currentWeek = programme?.current_week ?? 1;

  // Per-client programme → today's scheduled session.
  const clientProgramme = await getClientProgramme(targetId);
  const prog = clientProgramme?.programme ?? null;
  const sessions = clientProgramme?.sessions ?? {};
  const todayName = DAY_NAMES[new Date().getDay()];
  const todayPlan = prog?.weeklySchedule.find((d) => d.day === todayName) ?? null;
  const todayLift =
    todayPlan && todayPlan.type === "lift" && todayPlan.sessionKey && (todayPlan.fromWeek ?? 1) <= currentWeek
      ? sessions[todayPlan.sessionKey]
      : null;
  const lessonDay = ((currentDay - 1) % 30) + 1;
  const todayLesson = getLesson(lessonDay);

  // Readiness score: sleep/energy/motivation are positive, stress/soreness inverted (1=good, 5=bad)
  let readinessScore: number | null = null;
  if (todayCheckin) {
    const c = todayCheckin as Record<string, number>;
    const vals = [
      c.sleep_quality,
      c.morning_energy,
      c.stress_level   ? (6 - c.stress_level)  : null,  // invert: 1(calm)=5pts, 5(maxed)=1pt
      c.soreness       ? (6 - c.soreness)       : null,  // invert: 1(none)=5pts, 5(wrecked)=1pt
      c.motivation,
    ].filter((v): v is number => v != null && v > 0);
    if (vals.length > 0) readinessScore = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  monday.setHours(0, 0, 0, 0);

  const sessionsThisWeek = (recentSessions ?? []).filter((s) => new Date(s.completed_at!) >= monday);

  // Today's session card content, driven by the client's own programme.
  const activeBlockKeys = prog ? blockSessionKeys(prog, currentWeek) : new Set<string>();
  const blockDoneThisWeek = sessionsThisWeek.filter((s) => activeBlockKeys.has(s.session_type)).length;
  const sessionHref = todayLift && todayPlan?.sessionKey ? `/train/${todayPlan.sessionKey}?week=${currentWeek}` : "/train";
  const sessionTitle = todayLift ? todayLift.name : todayPlan?.type === "rest" ? "Recovery day" : "Today's movement";
  const sessionMeta = todayLift
    ? `${todayLift.exercises.length} exercises`
    : todayPlan?.type === "rest"
      ? "Evening walk · keep the streak"
      : "Treadmill + evening walk";

  const coachNote = lastMessage?.[0]?.content ?? null;
  // "Week done" only applies when there are lifting targets this week and they're all met.
  const weekDone = activeBlockKeys.size > 0 && blockDoneThisWeek >= activeBlockKeys.size;

  return (
    <div className="max-w-lg mx-auto bg-edge-bg min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-safe" style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 16px)" }}>
        <div className="pt-2">
          <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 28, fontWeight: 400, color: "#F2F1ED", lineHeight: 1.1 }}>
            {getGreeting()}, {firstName}.
          </p>
          <p style={{ fontSize: 12, color: "#9BA3AF", fontFamily: "Inter, sans-serif", marginTop: 4 }}>
            {getDateLine()} · Week {currentWeek}, Day {currentDay}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Link href="/guide">
            <div style={{ height: 36, borderRadius: 18, background: "#171B21", border: "1px solid #252A32", display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 12, paddingRight: 12, gap: 5 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 13, height: 13, color: "#C8965A" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <span style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "Inter, sans-serif" }}>Guide</span>
            </div>
          </Link>
          <Link href="/profile">
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#171B21", border: "1px solid #252A32", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 16, height: 16, color: "#9BA3AF" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </Link>
        </div>
      </div>

      <RevealGroup className="px-5 space-y-3 pb-10 mt-5">

        {/* Welcome card — shown on first day before any sessions */}
        {currentDay === 1 && sessionsThisWeek.length === 0 && (
          <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid rgba(200,150,90,0.3)", padding: "20px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2.5, background: "#C8965A", borderRadius: "20px 0 0 20px" }} />
            <div style={{ paddingLeft: 14 }}>
              <p style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 10 }}>
                From Nick · Welcome
              </p>
              <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20, fontWeight: 400, color: "#F2F1ED", lineHeight: 1.35, marginBottom: 10 }}>
                Right, {firstName}. This is your programme. Built around you.
              </p>
              <p style={{ fontSize: 13, color: "rgba(242,241,237,0.6)", fontFamily: "Inter, sans-serif", lineHeight: 1.6, marginBottom: 16 }}>
                {prog?.summary ?? "Your programme is built around you. Show up, follow the plan, and let the wins stack up."}
              </p>
              <Link href="/guide" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                <span style={{ fontSize: 11, color: "#C8965A", fontFamily: "Inter, sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em" }}>How the app works</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 12, height: 12, color: "#C8965A" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        )}

        {/* Readiness + coach note row */}
        <div style={{ display: "flex", gap: 12 }}>

          {/* Readiness card */}
          <Link href="/checkin" className="pressable" style={{ flex: 1, textDecoration: "none" }}>
            <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "center", minHeight: 120, justifyContent: "center" }}>
              {readinessScore !== null ? (
                <ReadinessRing score={readinessScore} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px dashed #252A32", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#C8965A", fontSize: 18 }}>+</span>
                  </div>
                  <span style={{ fontSize: 10, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "Inter, sans-serif", textAlign: "center", lineHeight: 1.4 }}>
                    Log<br />readiness
                  </span>
                </div>
              )}
            </div>
          </Link>

          {/* Nick coach note or progress */}
          <div style={{ flex: 2 }}>
            {coachNote ? (
              <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "16px", height: "100%", minHeight: 120, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#252A32", border: "1px solid #C8965A33", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 11, color: "#C8965A", fontWeight: 400 }}>N</span>
                  </div>
                  <span style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "Inter, sans-serif" }}>Nick</span>
                </div>
                <p style={{ fontSize: 12, color: "rgba(242,241,237,0.7)", fontFamily: "Inter, sans-serif", lineHeight: 1.5, flex: 1 }}>
                  {coachNote.length > 100 ? coachNote.slice(0, 100) + "…" : coachNote}
                </p>
              </div>
            ) : (
              <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "16px", height: "100%", minHeight: 120, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "Inter, sans-serif", marginBottom: 8 }}>This week</p>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i < sessionsThisWeek.length ? "#C8965A" : "#252A32" }} />
                  ))}
                </div>
                <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, color: "#F2F1ED", fontWeight: 400, lineHeight: 1 }}>
                  {sessionsThisWeek.length}<span style={{ fontSize: 13, color: "#9BA3AF", fontFamily: "Inter, sans-serif", fontWeight: 400, marginLeft: 4 }}>of 3</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick walk logger */}
        <div>
          <WalkLogger initialMinutes={walkMinutesToday} />
        </div>

        {/* Today's training — full-bleed photo card */}
        <div>
          {!weekDone ? (
            <Link href={sessionHref} className="block pressable">
              <div style={{ position: "relative", overflow: "hidden", borderRadius: 20, minHeight: 200 }}>
                <div style={{ position: "absolute", inset: 0, background: "#171B21" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #0E1014 0%, rgba(14,16,20,0.75) 50%, rgba(14,16,20,0.3) 100%)" }} />
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2.5, background: "#C8965A", borderRadius: "20px 0 0 20px" }} />
                <div style={{ position: "relative", zIndex: 10, padding: "20px 20px 20px 24px", minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.25em", fontFamily: "Inter, sans-serif" }}>
                      Today&apos;s session
                    </span>
                    <div style={{ flex: 1, height: 1, background: "rgba(200,150,90,0.2)" }} />
                  </div>
                  <div>
                    <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 40, fontWeight: 400, color: "#F2F1ED", lineHeight: 1, marginBottom: 6, letterSpacing: "-0.01em" }}>
                      {sessionTitle}
                    </h2>
                    <p style={{ fontSize: 12, color: "rgba(242,241,237,0.45)", fontFamily: "Inter, sans-serif", marginBottom: 16 }}>
                      {sessionMeta}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <span style={{ fontSize: 11, color: "#F2F1ED", fontFamily: "Inter, sans-serif", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.15em" }}>
                        Begin
                      </span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14, color: "#C8965A" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "24px 20px" }}>
              <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "Inter, sans-serif", marginBottom: 8 }}>This week</p>
              <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 28, color: "#F2F1ED", fontWeight: 400 }}>Three sessions done.</p>
              <p style={{ fontSize: 13, color: "#9BA3AF", fontFamily: "Inter, sans-serif", marginTop: 4 }}>Rest. Come back Monday.</p>
            </div>
          )}
        </div>

        {/* Today's fuel — protein-first snapshot, links to the Fuel tab */}
        <div>
          <Link href="/nutrition" className="block pressable">
            <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif" }}>
                  Today&apos;s fuel
                </span>
                {fuelLogged && (
                  <span style={{ fontSize: 11, color: proteinHit ? "#34D399" : "#9BA3AF", fontFamily: "Inter, sans-serif" }}>
                    {proteinHit ? "Protein hit ✓" : `${Math.max(proteinTarget - fuelProtein, 0)}g to go`}
                  </span>
                )}
              </div>

              {fuelLogged ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 28, color: "#F2F1ED", fontWeight: 400, lineHeight: 1 }}>
                      {fuelProtein}<span style={{ fontSize: 14, color: "#9BA3AF", fontFamily: "Inter, sans-serif", marginLeft: 3 }}>/ {proteinTarget}g protein</span>
                    </p>
                    <p style={{ fontSize: 12, color: "#9BA3AF", fontFamily: "Inter, sans-serif" }}>{fuelCalories} / {calorieTarget} kcal</p>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${proteinPct}%`, background: proteinHit ? "#34D399" : "#C8965A", borderRadius: 99, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)" }} />
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20, color: "#F2F1ED", fontWeight: 400 }}>
                    Snap your first meal.
                  </p>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 18, height: 18, color: "#9BA3AF" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* Today's mind lesson */}
        {todayLesson && (
          <div>
            <Link href={`/mind/${lessonDay}`} className="block pressable">
              <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "20px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2.5, background: "rgba(200,150,90,0.4)", borderRadius: "20px 0 0 20px" }} />
                <div style={{ paddingLeft: 16 }}>
                  <p style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 8 }}>
                    Mind · Day {lessonDay}
                  </p>
                  <h3 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, fontWeight: 400, color: "#F2F1ED", lineHeight: 1.2, marginBottom: 4 }}>
                    {todayLesson.title}
                  </h3>
                  <p style={{ fontSize: 11, color: "#9BA3AF", fontFamily: "Inter, sans-serif" }}>
                    5–8 min read
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: 10, color: "#F2F1ED", fontFamily: "Inter, sans-serif", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.15em" }}>Read</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 12, height: 12, color: "#C8965A" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Daily check-in */}
        <div>
          <Link href="/checkin" className="block pressable">
            <div style={{
              background: todayCheckin ? "rgba(52,211,153,0.06)" : "#171B21",
              borderRadius: 20,
              border: todayCheckin ? "1px solid rgba(52,211,153,0.15)" : "1px solid #252A32",
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
                  Daily check-in
                </p>
                <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20, color: todayCheckin ? "#34D399" : "#F2F1ED", fontWeight: 400 }}>
                  {todayCheckin ? "Done for today." : "60 seconds. How are you?"}
                </p>
              </div>
              {todayCheckin ? (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(52,211,153,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: 14, height: 14, color: "#34D399" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 18, height: 18, color: "#9BA3AF" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          </Link>
        </div>

      </RevealGroup>
    </div>
  );
}
