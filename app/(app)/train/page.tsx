import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getClientProgramme, getProgrammeWeek, blockSessionKeys } from "@/lib/data/programme-loader";
import { BARRY_PROGRAMME } from "@/lib/data/barry-programme";
import SessionCards from "@/components/SessionCards";
import { cookies } from "next/headers";
import Link from "next/link";

const DAY_TO_JS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

// Used only for the weekly schedule strip colouring
const SESSION_DISPLAY: Record<string, string> = {
  "lower-a": "Lower A",
  "upper-a": "Upper A",
  "lower-b": "Lower B",
  "upper-b": "Upper B",
  push: "Upper Body Push",
  squat: "Lower Body Squat",
  pull: "Upper Body Pull",
};

export default async function TrainPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = cookies();
  const previewId = cookieStore.get("preview_user_id")?.value;
  const targetId = previewId ?? user!.id;
  const db = previewId ? createAdminClient() : supabase;

  const clientProgramme = await getClientProgramme(targetId);

  const [
    { data: recentSessions },
    { data: progState },
  ] = await Promise.all([
    db
      .from("training_sessions")
      .select("*")
      .eq("user_id", targetId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(10),
    db
      .from("programme_state")
      .select("current_week")
      .eq("user_id", targetId)
      .single(),
  ]);

  const { programme: prog, sessions } = clientProgramme ?? { programme: BARRY_PROGRAMME, sessions: {} };

  const currentWeek = Math.max(1, Math.min(progState?.current_week ?? 1, prog.lengthWeeks));
  const weekInfo = getProgrammeWeek(prog, currentWeek);
  const blockKeys = blockSessionKeys(prog, currentWeek);

  const now = new Date();
  const todayJS = now.getDay(); // 0=Sun … 6=Sat

  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  monday.setHours(0, 0, 0, 0);

  const sessionsThisWeek = (recentSessions ?? []).filter(
    (s) => new Date(s.completed_at!) >= monday,
  );
  const supabaseDoneTypes = sessionsThisWeek.map((s) => s.session_type);
  const completedTypes = new Set(supabaseDoneTypes);
  const blockDoneThisWeek = sessionsThisWeek.filter((s) => blockKeys.has(s.session_type)).length;

  return (
    <div
      className="max-w-lg mx-auto px-5 pb-28"
      style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 16px)" }}
    >
      {/* ── Header ── */}
      <div style={{ paddingTop: 8, paddingBottom: 20 }}>
        <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
          {blockDoneThisWeek} of {blockKeys.size} sessions this week
        </p>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 36, fontWeight: 400, color: "#F2F1ED", lineHeight: 1, marginBottom: 4 }}>
          Train.
        </h1>
        <p style={{ fontSize: 12, color: "#9BA3AF", fontFamily: "Inter, sans-serif" }}>
          {prog.title} · {prog.subtitle}
        </p>
        <div style={{ display: "flex", gap: 5, marginTop: 12 }}>
          {[1, 2, 3, 4].map((w) => (
            <div
              key={w}
              style={{
                flex: 1, height: 2, borderRadius: 99,
                background: w < currentWeek ? "#C8965A" : w === currentWeek ? "#C8965A" : "#252A32",
                opacity: w === currentWeek ? 1 : w < currentWeek ? 0.5 : 1,
              }}
            />
          ))}
        </div>
        <Link href="/moves" style={{ textDecoration: "none" }}>
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, background: "#171B21", border: "1px solid #252A32", borderRadius: 14, padding: "12px 16px" }}>
            <span style={{ fontSize: 18 }}>🎬</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, color: "#F2F1ED" }}>Moves library</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#9BA3AF" }}>Coached exercises with demos</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="#3D434D" strokeWidth={2} style={{ width: 16, height: 16 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
        <Link href="/exercises" style={{ textDecoration: "none" }}>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, background: "#171B21", border: "1px solid #252A32", borderRadius: 14, padding: "12px 16px" }}>
            <span style={{ fontSize: 18 }}>💪</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, color: "#F2F1ED" }}>Exercise library</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#9BA3AF" }}>Demos — search by muscle or kit</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="#3D434D" strokeWidth={2} style={{ width: 16, height: 16 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {/* ── Current week card ── */}
      <div
        className="anim-0"
        style={{ background: "#171B21", borderRadius: 20, border: "1px solid rgba(200,150,90,0.2)", padding: "20px", marginBottom: 14 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.18em", fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
              Week {currentWeek} of {prog.lengthWeeks}
            </p>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 26, fontWeight: 400, color: "#F2F1ED", lineHeight: 1 }}>
              {weekInfo.label}
            </h2>
          </div>
          {/\d/.test(weekInfo.sets) && (
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#9BA3AF", fontFamily: "Inter, sans-serif", marginBottom: 2 }}>
                {weekInfo.sets} sets
              </p>
              <p style={{ fontSize: 11, color: "#C8965A", fontFamily: "Inter, sans-serif" }}>
                RPE {weekInfo.rpe}
              </p>
            </div>
          )}
        </div>
        <p style={{ fontSize: 13, color: "rgba(242,241,237,0.6)", fontFamily: "Inter, sans-serif", lineHeight: 1.5, marginBottom: 14 }}>
          {weekInfo.change}
        </p>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
          <p style={{ fontSize: 11, color: "#9BA3AF", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
            <span style={{ color: "rgba(242,241,237,0.45)" }}>Rule: </span>
            {prog.progressionRule}
          </p>
        </div>
      </div>

      {/* ── Weekly schedule strip ── */}
      <div className="anim-1" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {prog.weeklySchedule.map(({ day, type }) => {
            const jsDay = DAY_TO_JS[day];
            const isToday = jsDay === todayJS;
            const bg =
              type === "lift"   ? isToday ? "#C8965A" : "#171B21" :
              type === "cardio" ? isToday ? "rgba(96,165,250,0.2)" : "#13161A" :
              "#0E1014";
            const textCol =
              isToday && type === "lift"   ? "#0E1014" :
              isToday && type === "cardio" ? "#60A5FA" :
              type === "lift"   ? "#9BA3AF" :
              type === "cardio" ? "#3D434D" :
              "#252A32";
            return (
              <div key={day} style={{ flex: 1, textAlign: "center", background: bg, borderRadius: 10, padding: "8px 2px", border: "1px solid #252A32" }}>
                <p style={{ fontSize: 9, fontFamily: "Inter, sans-serif", fontWeight: 700, color: textCol, letterSpacing: "0.06em" }}>
                  {day}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4 Session cards — client component merges Supabase + localStorage ── */}
      <div className="anim-2" style={{ marginBottom: 24 }}>
        <SessionCards
          weeklySchedule={prog.weeklySchedule}
          sessions={sessions}
          supabaseDoneTypes={Array.from(completedTypes)}
          currentWeek={currentWeek}
          weekInfo={weekInfo}
        />
      </div>

      {/* ── Cardio ── */}
      <div className="anim-3" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 12 }}>
          Cardio
        </p>

        {/* Incline walk */}
        <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "18px 20px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🚶</span>
            <div>
              <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 17, color: "#F2F1ED", fontWeight: 400 }}>
                {prog.cardio.inclineWalk.label}
              </p>
              <p style={{ fontSize: 11, color: "#9BA3AF", fontFamily: "Inter, sans-serif", marginTop: 2 }}>
                {prog.cardio.inclineWalk.days}
              </p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "rgba(242,241,237,0.6)", fontFamily: "Inter, sans-serif", marginBottom: 10, lineHeight: 1.5 }}>
            {prog.cardio.inclineWalk.setup}
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {prog.cardio.inclineWalk.byWeek.map(({ week, duration }) => (
              <div key={week} style={{
                flex: 1, textAlign: "center", padding: "8px 4px",
                background: week === currentWeek ? "rgba(200,150,90,0.1)" : "#252A32",
                border: `1px solid ${week === currentWeek ? "rgba(200,150,90,0.3)" : "transparent"}`,
                borderRadius: 10,
              }}>
                <p style={{ fontSize: 8, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Inter, sans-serif", marginBottom: 2 }}>Wk {week}</p>
                <p style={{ fontSize: 11, color: week === currentWeek ? "#C8965A" : "#9BA3AF", fontFamily: "Inter, sans-serif", fontWeight: week === currentWeek ? 600 : 400 }}>{duration}</p>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(200,150,90,0.06)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(200,150,90,0.12)" }}>
            <p style={{ fontSize: 11, color: "rgba(242,241,237,0.6)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
              {prog.cardio.inclineWalk.timingTip}
            </p>
          </div>
        </div>

        {/* Assault bike */}
        <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🚴</span>
            <div>
              <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 17, color: "#F2F1ED", fontWeight: 400 }}>
                {prog.cardio.assaultBike.label}
              </p>
              <p style={{ fontSize: 11, color: "#9BA3AF", fontFamily: "Inter, sans-serif", marginTop: 2 }}>
                {prog.cardio.assaultBike.days}
              </p>
            </div>
          </div>
          <div style={{ background: "rgba(200,150,90,0.06)", border: "1px solid rgba(200,150,90,0.2)", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "rgba(200,150,90,0.8)", fontFamily: "Inter, sans-serif" }}>
              {prog.cardio.assaultBike.rule}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {prog.cardio.assaultBike.byWeek.map(({ week, format }) => (
              <div key={week} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                background: week === currentWeek ? "rgba(200,150,90,0.08)" : "#252A32",
                border: `1px solid ${week === currentWeek ? "rgba(200,150,90,0.2)" : "transparent"}`,
                borderRadius: 10,
              }}>
                <span style={{ fontSize: 9, color: week === currentWeek ? "#C8965A" : "#9BA3AF", fontFamily: "Inter, sans-serif", textTransform: "uppercase", letterSpacing: "0.1em", minWidth: 38, fontWeight: 600 }}>
                  Wk {week}
                </span>
                <span style={{ fontSize: 12, color: week === currentWeek ? "#F2F1ED" : "rgba(242,241,237,0.35)", fontFamily: "Inter, sans-serif" }}>
                  {format}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Nutrition ── */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 12 }}>
          Nutrition
        </p>
        <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "20px" }}>
          <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 16, color: "#F2F1ED", fontWeight: 400, lineHeight: 1.45, marginBottom: 16 }}>
            {prog.nutrition.headline}
          </p>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "Inter, sans-serif", marginBottom: 8 }}>Targets</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {prog.nutrition.targets.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#C8965A", flexShrink: 0, marginTop: 5 }} />
                  <p style={{ fontSize: 13, color: "rgba(242,241,237,0.75)", fontFamily: "Inter, sans-serif", lineHeight: 1.4 }}>{t}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "Inter, sans-serif", marginBottom: 8 }}>Tactics</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {prog.nutrition.tactics.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, color: "#C8965A", fontFamily: "Inter, sans-serif", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
                  <p style={{ fontSize: 13, color: "rgba(242,241,237,0.75)", fontFamily: "Inter, sans-serif", lineHeight: 1.4 }}>{t}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#252A32", borderRadius: 12, padding: "12px 14px" }}>
            <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "Inter, sans-serif", marginBottom: 6 }}>
              {prog.nutrition.medicalLabel}
            </p>
            <p style={{ fontSize: 12, color: "rgba(242,241,237,0.5)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
              {prog.nutrition.medicalNote}
            </p>
          </div>
        </div>
      </div>

      {/* ── Weekly check-in ── */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 12 }}>
          Weekly check-in
        </p>
        <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 15, color: "#F2F1ED", fontWeight: 400 }}>
              {prog.checkIn.frequency}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {prog.checkIn.fields.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, border: "1.5px solid #3D434D", flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: "rgba(242,241,237,0.7)", fontFamily: "Inter, sans-serif" }}>{f}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#9BA3AF", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
            📸 {prog.checkIn.photoNote}
          </p>
        </div>
      </div>

      {/* ── RPE note ── */}
      <div style={{ background: "#13161A", borderRadius: 16, border: "1px solid #252A32", padding: "14px 18px", marginBottom: 24 }}>
        <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "Inter, sans-serif", marginBottom: 6 }}>
          RPE guide
        </p>
        <p style={{ fontSize: 13, color: "rgba(242,241,237,0.6)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
          {prog.rpeNote}
        </p>
      </div>

      {/* ── Recent history ── */}
      {recentSessions && recentSessions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 16 }}>
            Recent
          </p>
          {recentSessions.slice(0, 5).map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 12, paddingBottom: 12, borderBottom: "1px solid #252A32" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#C8965A", flexShrink: 0 }} />
              <p style={{ flex: 1, fontSize: 13, color: "rgba(242,241,237,0.5)", fontFamily: "Inter, sans-serif" }}>
                {SESSION_DISPLAY[s.session_type] ?? s.session_type}
              </p>
              <p style={{ fontSize: 11, color: "#3D434D", fontFamily: "Inter, sans-serif" }}>
                {new Date(s.completed_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
