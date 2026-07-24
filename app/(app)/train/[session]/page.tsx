"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { markSessionDone } from "@/components/SessionCards";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { movementForExercise } from "@/lib/data/movements";
import type { Programme, SessionData } from "@/types";

type SetLog = { reps: number; weight: string; done: boolean };

function ytId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const S = {
  bg:      "#0E1014",
  surface: "#171B21",
  card:    "#13161A",
  divide:  "#252A32",
  bronze:  "#C8965A",
  text:    "#F2F1ED",
  sub:     "#9BA3AF",
  muted:   "#3D434D",
  green:   "#34D399",
} as const;

const serif  = (sz: number, col: string = S.text): React.CSSProperties => ({ fontFamily: "Fraunces, Georgia, serif", fontSize: sz, fontWeight: 400, color: col, lineHeight: 1.1 });
const sans   = (sz: number, col: string = S.text): React.CSSProperties => ({ fontFamily: "Inter, sans-serif", fontSize: sz, color: col });
const eyebrow: React.CSSProperties = { fontFamily: "Inter, sans-serif", fontSize: 9, color: S.sub, textTransform: "uppercase", letterSpacing: "0.18em" };
const card:    React.CSSProperties = { background: S.surface, borderRadius: 16, border: `1px solid ${S.divide}`, padding: "16px" };

export default function SessionPage() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const sessionType       = params.session as string;
  const weekParam         = parseInt(searchParams.get("week") ?? "1");

  // The client's bespoke programme is loaded from the DB on mount.
  const [clientProg, setClientProg] = useState<{ programme: Programme; sessions: Record<string, SessionData> } | null>(null);
  const [progLoaded, setProgLoaded] = useState(false);

  useEffect(() => {
    // Server route resolves the effective programme — including admin preview mode.
    fetch("/api/programme")
      .then((r) => r.json())
      .then((data) => {
        if (data?.programme) {
          setClientProg({
            programme: data.programme as Programme,
            sessions: (data.sessions ?? {}) as Record<string, SessionData>,
          });
        }
        setProgLoaded(true);
      })
      .catch(() => setProgLoaded(true));
  }, []);

  const session = clientProg?.sessions[sessionType];
  const isBlock = clientProg
    ? clientProg.programme.weeklySchedule.some((d) => d.type === "lift" && d.sessionKey === sessionType)
    : false;
  const effectiveSetsCount = isBlock && clientProg
    ? (() => {
        const p = clientProg.programme;
        const n = parseInt(p.progression[Math.max(0, Math.min(weekParam - 1, p.lengthWeeks - 1))]?.sets ?? "", 10);
        return Number.isNaN(n) ? null : n;
      })()
    : null;

  const [started,         setStarted]         = useState(false);
  const [currentExercise, setCurrentExercise] = useState(0);
  const [sets,            setSets]            = useState<SetLog[][]>([]);
  const [timer,           setTimer]           = useState(0);
  const [restTimer,       setRestTimer]       = useState<number | null>(null);
  const [completed,       setCompleted]       = useState(false);
  const [startTime]                           = useState(Date.now());
  const [struggled,       setStruggled]       = useState<boolean[]>([]);
  const [lastWeights,     setLastWeights]     = useState<Record<string, { weight: number | null; reps: number | null }>>({});

  useEffect(() => {
    if (!session) return;
    setSets(
      session.exercises.map((e) =>
        Array(effectiveSetsCount ?? e.sets).fill(null).map(() => ({ reps: 0, weight: "", done: false })),
      ),
    );
    setStruggled(session.exercises.map(() => false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("exercise_logs")
        .select("exercise_name, weight_kg, reps, created_at")
        .eq("user_id", user.id)
        .in("exercise_name", session.exercises.map((e) => e.name))
        .order("created_at", { ascending: false })
        .limit(200)
        .then(({ data }) => {
          if (!data) return;
          const map: Record<string, { weight: number | null; reps: number | null }> = {};
          for (const log of data) {
            if (!map[log.exercise_name]) {
              map[log.exercise_name] = { weight: log.weight_kg, reps: log.reps };
            }
          }
          setLastWeights(map);
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!started || completed) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [started, completed]);

  useEffect(() => {
    if (restTimer === null) return;
    if (restTimer <= 0) { setRestTimer(null); return; }
    const id = setTimeout(() => setRestTimer((t) => (t ?? 1) - 1), 1000);
    return () => clearTimeout(id);
  }, [restTimer]);

  const logSet = useCallback(
    (exIdx: number, setIdx: number, field: keyof SetLog, value: string | number | boolean) => {
      setSets((prev) => {
        const next = prev.map((ex) => [...ex]);
        next[exIdx][setIdx] = { ...next[exIdx][setIdx], [field]: value };
        return next;
      });
      if (field === "done" && value === true) {
        const restStr = session?.exercises[exIdx]?.rest ?? "90s";
        setRestTimer(parseInt(restStr) || 90);
      }
    },
    [session],
  );

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  async function finishSession() {
    if (!session) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Always mark done in localStorage so the train page reflects completion
    // even if the Supabase constraint hasn't been updated yet
    markSessionDone(sessionType);

    const duration = Math.round((Date.now() - startTime) / 60000);
    const { data: sd } = await supabase.from("training_sessions").insert({
      user_id: user.id, session_type: sessionType,
      completed_at: new Date().toISOString(), duration_minutes: duration,
    }).select().single();

    if (sd && sets.length) {
      const logs = session.exercises.flatMap((ex, i) =>
        sets[i].filter((s) => s.done).map((s, j) => ({
          session_id: sd.id, user_id: user.id, exercise_name: ex.name,
          sets_completed: j + 1, reps: s.reps || null,
          weight_kg: s.weight ? parseFloat(s.weight) : null, struggled: struggled[i],
        })),
      );
      if (logs.length) await supabase.from("exercise_logs").insert(logs);
    }
    // sd may be null if Supabase constraint rejects the new session type;
    // completion is already saved to localStorage above so the UI still works
    setCompleted(true);
  }

  if (!progLoaded) {
    return (
      <div style={{ minHeight: "100svh", background: S.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={sans(13, S.sub)}>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100svh", background: S.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={sans(13, S.sub)}>Session not found.</p>
      </div>
    );
  }

  // ── Completed ─────────────────────────────────────────────────────────────
  if (completed) {
    return (
      <div style={{ minHeight: "100svh", background: S.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(52,211,153,0.12)", border: `1px solid rgba(52,211,153,0.25)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={S.green} strokeWidth={2} style={{ width: 32, height: 32 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 style={{ ...serif(40), marginBottom: 6 }}>Session complete.</h1>
        <p style={{ ...sans(13, S.sub), marginBottom: 28 }}>{fmt(timer)} · {session.name}</p>
        <div style={{ background: S.surface, borderRadius: 18, padding: "16px 18px", border: `1px solid rgba(200,150,90,0.2)`, marginBottom: 28, maxWidth: 320, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(200,150,90,0.12)", border: `1px solid rgba(200,150,90,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={serif(11, S.bronze)}>N</span>
            </div>
            <p style={{ ...sans(13, "rgba(242,241,237,0.8)"), lineHeight: 1.5 }}>
              Session logged. That&apos;s one more than the man who didn&apos;t show up today.
            </p>
          </div>
        </div>
        <button onClick={() => router.push("/train")}
          style={{ width: "100%", maxWidth: 320, background: S.bronze, color: S.bg, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.12em", padding: "16px 0", borderRadius: 14, border: "none", cursor: "pointer" }}>
          Back to Training
        </button>
      </div>
    );
  }

  // ── Pre-session overview ──────────────────────────────────────────────────
  if (!started) {
    return (
      <div style={{ minHeight: "100svh", background: S.bg, display: "flex", flexDirection: "column", maxWidth: 512, margin: "0 auto", padding: "0 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: "max(env(safe-area-inset-top, 0px), 16px)", paddingBottom: 16 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 12, background: S.surface, border: `1px solid ${S.divide}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={S.text} strokeWidth={2} style={{ width: 16, height: 16 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ ...serif(20), marginBottom: 2 }}>{session.name}</h1>
            {isBlock && (
              <p style={sans(11, S.sub)}>Week {weekParam} · {effectiveSetsCount} sets per exercise</p>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 16 }}>

          {/* Warmup */}
          {session.warmup && session.warmup.length > 0 && (
            <div style={{ ...card, marginBottom: 10 }}>
              <p style={{ ...eyebrow, marginBottom: 10 }}>Warmup</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {session.warmup.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ color: S.bronze, flexShrink: 0, lineHeight: 1.4 }}>›</span>
                    <p style={{ ...sans(13, "rgba(242,241,237,0.8)"), lineHeight: 1.4 }}>{w}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exercises */}
          <div style={{ marginBottom: 10 }}>
            <p style={{ ...eyebrow, marginBottom: 10 }}>Exercises</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {session.exercises.map((ex, i) => (
                <div key={i} style={{ background: S.surface, borderRadius: 14, border: `1px solid ${S.divide}`, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <p style={{ ...serif(15), marginBottom: 4 }}>{ex.name}</p>
                    {lastWeights[ex.name]?.weight && (
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: S.bronze, background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.2)", borderRadius: 6, padding: "2px 7px", flexShrink: 0, marginTop: 2 }}>
                        Last {lastWeights[ex.name].weight}kg{lastWeights[ex.name].reps ? ` × ${lastWeights[ex.name].reps}` : ""}
                      </span>
                    )}
                  </div>
                  <p style={{ ...sans(12, S.bronze), marginBottom: ex.notes ? 4 : 0 }}>
                    {effectiveSetsCount ?? ex.sets} sets × {ex.reps}
                    {ex.rest && <span style={{ color: S.sub }}> · {ex.rest} rest</span>}
                  </p>
                  {ex.notes && <p style={sans(11, S.sub)}>{ex.notes}</p>}
                  {movementForExercise(ex.name) && (
                    <Link href={`/moves/${movementForExercise(ex.name)!.slug}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, textDecoration: "none",
                        background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.25)", borderRadius: 8, padding: "5px 10px" }}>
                      <span style={{ fontSize: 12 }}>🎬</span>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, color: S.bronze, textTransform: "uppercase", letterSpacing: "0.08em" }}>How to</span>
                    </Link>
                  )}
                  {ytId(ex.yt) && (
                    <a href={ex.yt} target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", marginTop: 10, position: "relative", borderRadius: 10, overflow: "hidden", textDecoration: "none" }}>
                      <img
                        src={`https://img.youtube.com/vi/${ytId(ex.yt)}/mqdefault.jpg`}
                        alt={`Demo: ${ex.name}`}
                        style={{ width: "100%", display: "block", opacity: 0.85 }}
                      />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(200,150,90,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg viewBox="0 0 24 24" fill="#0E1014" style={{ width: 18, height: 18, marginLeft: 2 }}>
                            <path d="M5 3l14 9-14 9V3z" />
                          </svg>
                        </div>
                      </div>
                      <div style={{ position: "absolute", bottom: 6, right: 8 }}>
                        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Watch demo</span>
                      </div>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Finisher */}
          {session.finisher && (
            <div style={{ ...card, marginBottom: 10 }}>
              <p style={{ ...eyebrow, marginBottom: 8 }}>Finisher</p>
              <p style={{ ...sans(13, "rgba(242,241,237,0.75)"), lineHeight: 1.5 }}>{session.finisher}</p>
            </div>
          )}

          {/* Coach note */}
          {session.coachNote && (
            <div style={{ background: S.surface, borderRadius: 16, border: `1px solid ${S.divide}`, borderLeft: `2.5px solid ${S.bronze}`, padding: "16px 16px 16px 18px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(200,150,90,0.12)", border: `1px solid rgba(200,150,90,0.25)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={serif(10, S.bronze)}>N</span>
                </div>
                <p style={{ ...eyebrow, color: S.bronze }}>Edge</p>
              </div>
              <p style={{ ...sans(13, "rgba(242,241,237,0.75)"), lineHeight: 1.5 }}>{session.coachNote}</p>
            </div>
          )}
        </div>

        <div style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)", paddingTop: 8 }}>
          <button onClick={() => setStarted(true)}
            style={{ width: "100%", background: S.bronze, color: S.bg, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.12em", padding: "18px 0", borderRadius: 16, border: "none", cursor: "pointer" }}>
            Start &amp; Log This Session
          </button>
        </div>
      </div>
    );
  }

  // ── Active tracker ────────────────────────────────────────────────────────
  const ex     = session.exercises[currentExercise];
  const exSets = sets[currentExercise] ?? [];
  const doneSets = exSets.filter((s) => s.done).length;

  return (
    <div style={{ minHeight: "100svh", background: S.bg, display: "flex", flexDirection: "column", maxWidth: 512, margin: "0 auto", padding: "0 16px" }}>

      {/* Progress header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "max(env(safe-area-inset-top, 0px), 16px)", paddingBottom: 12 }}>
        <p style={sans(13, S.sub)}>{currentExercise + 1}/{session.exercises.length} · {fmt(timer)}</p>
        <div style={{ display: "flex", gap: 6 }}>
          {session.exercises.map((_, i) => (
            <div key={i} style={{ height: 4, width: 22, borderRadius: 99, background: i === currentExercise ? S.bronze : i < currentExercise ? S.green : S.divide }} />
          ))}
        </div>
      </div>

      {/* Rest timer overlay */}
      {restTimer !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(14,16,20,0.93)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <p style={{ ...eyebrow, marginBottom: 12 }}>Rest</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 96, fontWeight: 700, color: S.text, lineHeight: 1 }}>{restTimer}</p>
          {ex.rest && <p style={{ ...sans(11, S.sub), marginTop: 8 }}>{ex.rest} prescribed</p>}
          <button onClick={() => setRestTimer(null)} style={{ marginTop: 24, background: "none", border: "none", color: S.sub, fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer", textDecoration: "underline" }}>
            Skip rest
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Exercise */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
            <h2 style={{ ...serif(30), flex: 1 }}>{ex.name}</h2>
            {ytId(ex.yt) ? (
              <a href={ex.yt} target="_blank" rel="noopener noreferrer"
                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.25)", borderRadius: 8, padding: "5px 10px", textDecoration: "none", marginTop: 4 }}>
                <svg viewBox="0 0 24 24" fill={S.bronze} style={{ width: 12, height: 12 }}>
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: S.bronze, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Demo</span>
              </a>
            ) : movementForExercise(ex.name) && (
              <Link href={`/moves/${movementForExercise(ex.name)!.slug}`}
                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.25)", borderRadius: 8, padding: "5px 10px", textDecoration: "none", marginTop: 4 }}>
                <span style={{ fontSize: 12 }}>🎬</span>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: S.bronze, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>How to</span>
              </Link>
            )}
          </div>
          <p style={{ ...sans(14, S.bronze) }}>
            {effectiveSetsCount ?? ex.sets} sets × {ex.reps}
            {ex.rest && <span style={{ color: S.sub, fontWeight: 400 }}> · {ex.rest} rest</span>}
          </p>
          {ex.notes && <p style={{ ...sans(12, S.sub), marginTop: 4 }}>{ex.notes}</p>}
        </div>

        {/* Last session hint */}
        {lastWeights[ex.name]?.weight && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 12px", background: "rgba(200,150,90,0.06)", border: "1px solid rgba(200,150,90,0.15)", borderRadius: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={S.bronze} strokeWidth={2} style={{ width: 12, height: 12, flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: S.bronze }}>
              Last session: {lastWeights[ex.name].weight}kg{lastWeights[ex.name].reps ? ` × ${lastWeights[ex.name].reps} reps` : ""}
            </p>
          </div>
        )}

        {/* Set rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {exSets.map((set, si) => (
            <div key={si} style={{ background: S.surface, borderRadius: 14, border: `1px solid ${set.done ? "rgba(52,211,153,0.3)" : S.divide}`, padding: "14px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ ...sans(12, set.done ? S.green : S.sub), fontWeight: 600, minWidth: 44 }}>Set {si + 1}</span>
                <input type="number" value={set.reps || ""} onChange={(e) => logSet(currentExercise, si, "reps", parseInt(e.target.value) || 0)}
                  placeholder={lastWeights[ex.name]?.reps ? `${lastWeights[ex.name].reps}` : "Reps"} disabled={set.done}
                  style={{ flex: 1, background: S.bg, border: `1px solid ${S.divide}`, borderRadius: 10, padding: "10px 8px", color: S.text, textAlign: "center", fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 600, outline: "none", opacity: set.done ? 0.5 : 1 }} />
                <input type="text" value={set.weight} onChange={(e) => logSet(currentExercise, si, "weight", e.target.value)}
                  placeholder={lastWeights[ex.name]?.weight ? `${lastWeights[ex.name].weight}` : "kg"} disabled={set.done}
                  style={{ width: 70, background: S.bg, border: `1px solid ${S.divide}`, borderRadius: 10, padding: "10px 8px", color: S.text, textAlign: "center", fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 600, outline: "none", opacity: set.done ? 0.5 : 1 }} />
                <button onClick={() => logSet(currentExercise, si, "done", !set.done)}
                  style={{ width: 42, height: 42, borderRadius: 12, background: set.done ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${set.done ? "rgba(52,211,153,0.3)" : S.divide}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke={set.done ? S.green : S.muted} strokeWidth={2.5} style={{ width: 18, height: 18 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Struggled */}
        <button onClick={() => setStruggled((p) => p.map((s, i) => i === currentExercise ? !s : s))}
          style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: `1px solid ${struggled[currentExercise] ? "rgba(200,150,90,0.4)" : S.divide}`, background: struggled[currentExercise] ? "rgba(200,150,90,0.06)" : "transparent", color: struggled[currentExercise] ? S.bronze : S.sub, fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer", marginBottom: 16 }}>
          {struggled[currentExercise] ? "Flagged — stay put next session" : "I struggled with this"}
        </button>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 10, paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)", paddingTop: 8 }}>
        {currentExercise > 0 && (
          <button onClick={() => setCurrentExercise((e) => e - 1)}
            style={{ width: 52, height: 54, borderRadius: 14, background: S.surface, border: `1px solid ${S.divide}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={S.text} strokeWidth={2} style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {currentExercise < session.exercises.length - 1 ? (
          <button onClick={() => setCurrentExercise((e) => e + 1)} disabled={doneSets === 0}
            style={{ flex: 1, background: doneSets === 0 ? S.divide : S.bronze, color: doneSets === 0 ? S.muted : S.bg, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.12em", padding: "16px 0", borderRadius: 14, border: "none", cursor: doneSets === 0 ? "default" : "pointer" }}>
            Next Exercise
          </button>
        ) : (
          <button onClick={finishSession}
            style={{ flex: 1, background: S.green, color: S.bg, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.12em", padding: "16px 0", borderRadius: 14, border: "none", cursor: "pointer" }}>
            Finish Session
          </button>
        )}
      </div>
    </div>
  );
}
