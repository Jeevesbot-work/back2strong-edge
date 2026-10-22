"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { LESSONS } from "@/lib/data/lessons";
import { getPhaseColor } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Step = "content" | "journal" | "reflection" | "action" | "score" | "done";

const S = {
  bg:      "#0E1014",
  surface: "#171B21",
  divide:  "#252A32",
  bronze:  "#C8965A",
  text:    "#F2F1ED",
  sub:     "#9BA3AF",
  muted:   "#3D434D",
  green:   "#34D399",
} as const;

const serif  = (sz: number, col: string = S.text): React.CSSProperties => ({ fontFamily: "Fraunces, Georgia, serif", fontSize: sz, fontWeight: 400, color: col, lineHeight: 1.15 });
const sans   = (sz: number, col: string = S.text): React.CSSProperties => ({ fontFamily: "Inter, sans-serif", fontSize: sz, color: col });
const eyebrow = (col: string = S.sub): React.CSSProperties => ({ fontFamily: "Inter, sans-serif", fontSize: 9, color: col, textTransform: "uppercase", letterSpacing: "0.18em" });

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const day    = parseInt(params.day as string);
  const lesson = LESSONS.find((l) => l.day === day);

  const [step,           setStep]           = useState<Step>("content");
  const [reflection,     setReflection]     = useState("");
  const [microActionDone,setMicroActionDone] = useState(false);
  const [score,          setScore]          = useState(5);
  const [saving,         setSaving]         = useState(false);

  useEffect(() => {
    if (!lesson) return;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prog } = await supabase.from("programme_state").select("*").eq("user_id", user.id).single();
      const cycle = prog ? Math.ceil(prog.current_day / 30) : 1;
      const { data } = await supabase.from("lesson_completions").select("*")
        .eq("user_id", user.id).eq("day_number", day).eq("cycle", cycle).single();
      if (data) {
        if (data.reflection)       setReflection(data.reflection);
        if (data.micro_action_done) setMicroActionDone(true);
        if (data.end_of_day_score)  setScore(data.end_of_day_score);
      }
    }
    load();
  }, [day, lesson]);

  async function saveAndFinish() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const saved = await fetch("/api/lessons/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day,
        reflection,
        micro_action_done: microActionDone,
        end_of_day_score: score,
      }),
    });
    setSaving(false);
    if (!saved.ok) return;
    setStep("done");
  }

  if (!lesson) {
    return (
      <div style={{ minHeight: "100svh", background: S.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={sans(13, S.sub)}>Lesson not found.</p>
      </div>
    );
  }

  const phaseColor = getPhaseColor(lesson.phaseCode);
  const steps: Step[] = ["content", "journal", "reflection", "action", "score"];
  const stepIdx  = steps.indexOf(step);
  const progress = stepIdx >= 0 ? stepIdx / (steps.length - 1) : 1;

  const advance = () => {
    const next: Record<Step, Step> = {
      content: "journal", journal: "reflection", reflection: "action",
      action: "score", score: "done", done: "done",
    };
    setStep(next[step]);
  };

  // ── Done screen ────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div style={{ minHeight: "100svh", background: S.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${phaseColor}18`, border: `1px solid ${phaseColor}40`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <span style={{ ...serif(24, phaseColor) }}>{lesson.phaseCode}</span>
        </div>
        <h1 style={{ ...serif(36), marginBottom: 6 }}>Lesson done.</h1>
        <p style={{ ...sans(13, S.sub), marginBottom: 28 }}>Day {day} · {lesson.title}</p>
        <button onClick={() => router.push("/mind")}
          style={{ width: "100%", maxWidth: 320, background: phaseColor, color: S.bg, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.12em", padding: "16px 0", borderRadius: 14, border: "none", cursor: "pointer" }}>
          Back to Mind
        </button>
      </div>
    );
  }

  // ── Lesson flow ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100svh", background: S.bg, display: "flex", flexDirection: "column", maxWidth: 512, margin: "0 auto" }}>

      {/* Progress bar */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.07)" }}>
        <div style={{ height: "100%", background: phaseColor, width: `${progress * 100}%`, transition: "width 0.4s ease" }} />
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", paddingTop: "max(env(safe-area-inset-top, 0px), 12px)" }}>
        <button onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 12, background: S.surface, border: `1px solid ${S.divide}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={S.text} strokeWidth={2} style={{ width: 16, height: 16 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...eyebrow(phaseColor), marginBottom: 2 }}>Day {day} · Phase {lesson.phaseCode}</p>
          <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 17, fontWeight: 400, color: S.text, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {lesson.title}
          </h1>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 8px" }}>

        {step === "content" && (
          <div>
            <p style={{ ...sans(15, "rgba(242,241,237,0.85)"), lineHeight: 1.7, whiteSpace: "pre-line" }}>
              {lesson.content}
            </p>
          </div>
        )}

        {step === "journal" && (
          <div>
            <div style={{ background: S.surface, borderRadius: 16, padding: "16px 18px", borderLeft: `3px solid ${phaseColor}`, marginBottom: 20 }}>
              <p style={{ ...eyebrow(phaseColor), marginBottom: 8 }}>Voice Journal Prompt</p>
              <p style={{ ...sans(15, S.text), lineHeight: 1.55 }}>{lesson.voiceJournalPrompt}</p>
            </div>
            <p style={{ ...sans(13, S.sub), lineHeight: 1.55, marginBottom: 28 }}>
              Speak your answer out loud. No one&apos;s listening. Just you and the truth.
            </p>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${phaseColor}15`, border: `2px solid ${phaseColor}50`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={phaseColor} strokeWidth={1.5} style={{ width: 30, height: 30 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <p style={{ ...sans(11, S.muted), textAlign: "center" }}>Voice recording coming soon — speak your answer aloud</p>
          </div>
        )}

        {step === "reflection" && (
          <div>
            <p style={{ ...eyebrow(phaseColor), marginBottom: 14 }}>Written Reflection</p>
            <div style={{ marginBottom: 14 }}>
              {lesson.reflectionQuestions.map((q, i) => (
                <p key={i} style={{ ...sans(14, "rgba(242,241,237,0.85)"), lineHeight: 1.55, marginBottom: 10 }}>{q}</p>
              ))}
            </div>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="Write your honest answer here..."
              rows={6}
              style={{ width: "100%", background: S.surface, border: `1px solid ${S.divide}`, borderRadius: 14, padding: "14px 16px", color: S.text, fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.5, outline: "none", resize: "none" }}
            />
          </div>
        )}

        {step === "action" && (
          <div>
            <p style={{ ...eyebrow(phaseColor), marginBottom: 14 }}>Micro Action</p>
            <div style={{ background: S.surface, borderRadius: 16, padding: "18px 20px", border: `1px solid ${S.divide}`, marginBottom: 20 }}>
              <p style={{ ...sans(15, "rgba(242,241,237,0.9)"), lineHeight: 1.6 }}>{lesson.microAction}</p>
            </div>
            <button onClick={() => setMicroActionDone(!microActionDone)}
              style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: `1px solid ${microActionDone ? "rgba(52,211,153,0.4)" : S.divide}`, background: microActionDone ? "rgba(52,211,153,0.08)" : "transparent", color: microActionDone ? S.green : S.sub, fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer" }}>
              {microActionDone ? "Done ✓" : "Mark as done"}
            </button>
          </div>
        )}

        {step === "score" && (
          <div>
            <p style={{ ...eyebrow(phaseColor), marginBottom: 12 }}>End of Day</p>
            <h2 style={{ ...serif(28), marginBottom: 24 }}>How did today feel?</h2>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={sans(11, S.sub)}>Struggling</span>
              <span style={sans(11, S.sub)}>Powerful</span>
            </div>
            <input type="range" min={1} max={10} value={score} onChange={(e) => setScore(parseInt(e.target.value))} className="w-full mb-6" />
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 72, fontWeight: 400, color: phaseColor, lineHeight: 1 }}>{score}</span>
              <span style={sans(18, S.sub)}>/10</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div style={{ padding: "10px 16px", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)", borderTop: `1px solid rgba(255,255,255,0.05)` }}>
        {step === "score" ? (
          <button onClick={saveAndFinish} disabled={saving}
            style={{ width: "100%", background: saving ? S.divide : phaseColor, color: saving ? S.muted : S.bg, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.12em", padding: "16px 0", borderRadius: 14, border: "none", cursor: saving ? "default" : "pointer" }}>
            {saving ? "Saving..." : "Complete Lesson"}
          </button>
        ) : (
          <button onClick={advance}
            style={{ width: "100%", background: phaseColor, color: S.bg, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.12em", padding: "16px 0", borderRadius: 14, border: "none", cursor: "pointer" }}>
            {step === "content" ? "Continue" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}
