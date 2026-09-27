"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { markSessionDone } from "@/components/SessionCards";
import { createClient } from "@/lib/supabase/client";
import { movementForExercise } from "@/lib/data/movements";
import type { Exercise, IntervalProtocol, Programme, SessionData } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Session player. Overview → active (one step at a time; a superset is one step)
// → summary. Weight and reps are big steppers, pre-filled from last time.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: "#0B0D10",
  panel: "#14171C",
  panelHi: "#1B1F26",
  line: "#252A32",
  text: "#F2F1ED",
  sub: "#9BA3AF",
  mute: "#5C636E",
  bronze: "#C8965A",
  bronzeHi: "#E3B887",
  green: "#4ADE80",
  work: "#F0714F",
  rest: "#6FA8F5",
};
const cond = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const inter = "Inter, system-ui, sans-serif";
const label: React.CSSProperties = { fontFamily: inter, fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: C.sub };

type SetLog = { weight: number | null; reps: number | null; done: boolean };
type Last = { weight: number | null; reps: number | null };
type Step = { exIdx: number[]; superset?: string };

function ytId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
const firstInt = (s: string) => { const m = s.match(/\d+/); return m ? parseInt(m[0], 10) : null; };
const restSeconds = (r?: string) => {
  if (!r || /none|straight/i.test(r)) return 0;
  const n = parseFloat(r);
  if (Number.isNaN(n)) return 90;
  return /min/i.test(r) ? Math.round(n * 60) : n;
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const kg = (n: number | null) => (n === null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));

function protocolForWeek(ex: Exercise, week: number): IntervalProtocol | null {
  const list = ex.intervals ?? [];
  const parity = week % 2 === 1 ? "odd" : "even";
  return list.find((p) => (p.weeks ?? "all") === parity) ?? list.find((p) => (p.weeks ?? "all") === "all") ?? list[0] ?? null;
}

// ── Ring ─────────────────────────────────────────────────────────────────────
function Ring({ pct, size, stroke, color = C.bronze, track = "rgba(255,255,255,0.07)", children }: {
  pct: number; size: number; stroke: number; color?: string; track?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - p)} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.22,1,.36,1), stroke .3s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ value, onChange, step, unit, placeholder, disabled, id }: {
  value: number | null; onChange: (v: number | null) => void; step: number; unit: string; placeholder?: string; disabled?: boolean; id: string;
}) {
  const bump = (d: number) => onChange(Math.max(0, Math.round(((value ?? 0) + d) * 10) / 10));
  const btn: React.CSSProperties = { width: 34, height: 56, border: "none", background: "transparent", color: disabled ? C.mute : C.text, fontSize: 24, fontWeight: 300, cursor: disabled ? "default" : "pointer", flexShrink: 0 };
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", background: C.bg, borderRadius: 14, border: `1px solid ${C.line}`, opacity: disabled ? 0.55 : 1 }}>
      <button type="button" aria-label={`Less ${unit}`} disabled={disabled} onClick={() => bump(-step)} style={btn}>−</button>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6px 0 5px" }}>
        <input id={id} inputMode="decimal" disabled={disabled} value={value ?? ""} placeholder={placeholder ?? "0"} aria-label={unit}
          onChange={(e) => { const v = e.target.value.replace(",", "."); onChange(v === "" ? null : Number.isNaN(parseFloat(v)) ? value : parseFloat(v)); }}
          style={{ width: "100%", minWidth: 0, background: "transparent", border: "none", outline: "none", textAlign: "center", color: C.text, fontFamily: cond, fontWeight: 700, fontSize: 28, lineHeight: 1, padding: 0 }} />
        <span style={{ fontFamily: inter, fontSize: 9, color: C.sub, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 3 }}>{unit}</span>
      </div>
      <button type="button" aria-label={`More ${unit}`} disabled={disabled} onClick={() => bump(step)} style={btn}>+</button>
    </div>
  );
}

// ── Demo media ───────────────────────────────────────────────────────────────
function Demo({ ex }: { ex: Exercise }) {
  if (ex.video) {
    // Nick's own demo: plays inline, tap for sound. Portrait clips keep their shape.
    return (
      <div style={{ borderRadius: 18, overflow: "hidden", background: "#000", border: `1px solid ${C.line}`, display: "flex", justifyContent: "center" }}>
        <video src={ex.video} poster={ex.video.replace(/\.mp4$/, ".jpg")} controls playsInline preload="metadata"
          style={{ width: "100%", maxHeight: "62vh", objectFit: "contain", display: "block", background: "#000" }} />
      </div>
    );
  }
  const id = ytId(ex.yt);
  if (id) return <EmbeddedDemo id={id} name={ex.name} />;
  const mv = movementForExercise(ex.name);
  if (mv) {
    return (
      <Link href={`/moves/${mv.slug}`} style={{ ...label, color: C.bronze, textDecoration: "none" }}>How to do it →</Link>
    );
  }
  return null;
}

// In-app demo: branded poster, tap to play inside the app (no trip to YouTube).
function EmbeddedDemo({ id, name }: { id: string; name: string }) {
  const [playing, setPlaying] = useState(false);
  const box: React.CSSProperties = { position: "relative", borderRadius: 18, overflow: "hidden", aspectRatio: "16 / 9", maxWidth: "100%", background: "#000", border: `1px solid ${C.line}` };
  if (playing) {
    return (
      <div style={box}>
        <iframe title={`Demo: ${name}`} src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&controls=1`}
          allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setPlaying(true)} aria-label={`Play demo: ${name}`} style={{ ...box, display: "block", width: "100%", padding: 0, cursor: "pointer" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.35) contrast(1.05) brightness(0.55)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(11,13,16,0.9), rgba(11,13,16,0.1) 60%)" }} />
      <div style={{ position: "absolute", left: 14, bottom: 12, right: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 42, height: 42, borderRadius: "50%", background: C.bronze, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill={C.bg} style={{ marginLeft: 2 }}><path d="M6 4l14 8-14 8z" /></svg>
        </span>
        <span style={{ ...label, color: C.text }}>Watch the demo</span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionType = params.session as string;
  const week = parseInt(searchParams.get("week") ?? "1") || 1;

  const [prog, setProg] = useState<{ programme: Programme; sessions: Record<string, SessionData> } | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/programme").then((r) => r.json()).then((d) => {
      if (d?.programme) setProg({ programme: d.programme as Programme, sessions: (d.sessions ?? {}) as Record<string, SessionData> });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const session = prog?.sessions[sessionType];
  const programme = prog?.programme;
  const weekRow = programme?.progression[Math.max(0, Math.min(week - 1, (programme?.lengthWeeks ?? 1) - 1))];
  const setsOverride = (() => { const n = parseInt(weekRow?.sets ?? "", 10); return Number.isNaN(n) ? null : n; })();

  // Optional-choice group ("pick 4 of 5"). Default: the first N.
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!session?.pick) return;
    const idx = session.exercises.map((e, i) => (e.group === session.pick!.group ? i : -1)).filter((i) => i >= 0);
    // A superset in the group counts as one choice: keep pairs together.
    const units: number[][] = [];
    idx.forEach((i) => {
      const ss = session.exercises[i].superset;
      const prev = units[units.length - 1];
      if (ss && prev && session.exercises[prev[0]].superset === ss) prev.push(i); else units.push([i]);
    });
    setChosen(new Set(units.slice(0, session.pick.count).flat()));
  }, [session]);

  const choiceUnits = useMemo(() => {
    if (!session?.pick) return [] as number[][];
    const units: number[][] = [];
    session.exercises.forEach((e, i) => {
      if (e.group !== session.pick!.group) return;
      const prev = units[units.length - 1];
      if (e.superset && prev && session.exercises[prev[0]].superset === e.superset) prev.push(i); else units.push([i]);
    });
    return units;
  }, [session]);

  const active = useMemo(() => session ? session.exercises.map((_, i) => i).filter((i) => !session.exercises[i].group || chosen.has(i)) : [], [session, chosen]);
  const steps: Step[] = useMemo(() => {
    if (!session) return [];
    const out: Step[] = [];
    active.forEach((i) => {
      const ss = session.exercises[i].superset;
      const prev = out[out.length - 1];
      if (ss && prev?.superset === ss) prev.exIdx.push(i); else out.push({ exIdx: [i], superset: ss });
    });
    return out;
  }, [session, active]);

  const setCount = (ex: Exercise) => (ex.mode === "timed" || ex.mode === "interval" ? 1 : setsOverride ?? ex.sets);

  const [phase, setPhase] = useState<"overview" | "active" | "done">("overview");
  const [stepIdx, setStepIdx] = useState(0);
  const [logs, setLogs] = useState<Record<number, SetLog[]>>({});
  const [last, setLast] = useState<Record<string, Last>>({});
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<{ left: number; total: number; next: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const startedAt = useRef<number>(0);

  // Last time's numbers for every exercise in the session.
  useEffect(() => {
    if (!session) return;
    const sb = createClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      sb.from("exercise_logs").select("exercise_name, weight_kg, reps, created_at").eq("user_id", user.id)
        .in("exercise_name", session.exercises.map((e) => e.name)).order("created_at", { ascending: false }).limit(300)
        .then(({ data }) => {
          const map: Record<string, Last> = {};
          for (const l of data ?? []) if (!map[l.exercise_name]) map[l.exercise_name] = { weight: l.weight_kg, reps: l.reps };
          setLast(map);
        });
    });
  }, [session]);

  function start() {
    if (!session) return;
    const init: Record<number, SetLog[]> = {};
    active.forEach((i) => {
      const ex = session.exercises[i];
      const l = last[ex.name];
      const target = ex.mode === "timed" ? firstInt(ex.reps) : l?.reps ?? firstInt(ex.reps);
      init[i] = Array.from({ length: setCount(ex) }, () => ({ weight: ex.mode ? null : l?.weight ?? null, reps: target, done: false }));
    });
    setLogs(init);
    startedAt.current = Date.now();
    setPhase("active");
    setStepIdx(0);
  }

  useEffect(() => {
    if (phase !== "active") return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!rest) return;
    if (rest.left <= 0) { setRest(null); try { navigator.vibrate?.(200); } catch { /* not supported */ } return; }
    const id = setTimeout(() => setRest((r) => (r ? { ...r, left: r.left - 1 } : r)), 1000);
    return () => clearTimeout(id);
  }, [rest]);

  const totalSets = active.reduce((s, i) => s + (logs[i]?.length ?? 0), 0);
  const doneSets = active.reduce((s, i) => s + (logs[i]?.filter((x) => x.done).length ?? 0), 0);

  function update(i: number, si: number, patch: Partial<SetLog>) {
    setLogs((prev) => {
      const rows = [...(prev[i] ?? [])];
      rows[si] = { ...rows[si], ...patch };
      // Carry a changed weight forward to the sets not yet done.
      if (patch.weight !== undefined) for (let k = si + 1; k < rows.length; k++) if (!rows[k].done) rows[k] = { ...rows[k], weight: patch.weight };
      return { ...prev, [i]: rows };
    });
  }

  function tick(i: number, si: number) {
    if (!session) return;
    const row = logs[i]?.[si];
    if (!row) return;
    if (row.done) { update(i, si, { done: false }); return; }
    update(i, si, { done: true });
    const step = steps[stepIdx];
    const pos = step.exIdx.indexOf(i);
    const ex = session.exercises[i];
    // In a superset, go straight to the partner; rest after the last one.
    if (pos < step.exIdx.length - 1) return;
    const secs = restSeconds(ex.rest);
    const moreSets = step.exIdx.some((j) => (logs[j] ?? []).some((r, k) => !(j === i && k === si) && !r.done));
    if (secs > 0 && moreSets) {
      const nextIdx = si + 1;
      const first = session.exercises[step.exIdx[0]];
      const nr = logs[step.exIdx[0]]?.[nextIdx];
      setRest({ left: secs, total: secs, next: `Set ${nextIdx + 1} · ${first.name}${nr?.weight ? ` · ${kg(nr.weight)}kg` : ""}${nr?.reps ? ` × ${nr.reps}` : ""}` });
    }
  }

  async function finish() {
    if (!session || saving) return;
    setSaving(true);
    markSessionDone(sessionType);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data: sd } = await sb.from("training_sessions").insert({
        user_id: user.id, session_type: sessionType, completed_at: new Date().toISOString(),
        duration_minutes: Math.max(1, Math.round(elapsed / 60)),
      }).select().single();
      if (sd) {
        const rows = active.flatMap((i) => (logs[i] ?? []).filter((s) => s.done).map((s, j) => ({
          session_id: sd.id, user_id: user.id, exercise_name: session.exercises[i].name,
          sets_completed: j + 1, reps: s.reps, weight_kg: s.weight, struggled: false,
        })));
        if (rows.length) await sb.from("exercise_logs").insert(rows);
      }
    }
    setSaving(false);
    setPhase("done");
  }

  // ── States ────────────────────────────────────────────────────────────────
  const shell: React.CSSProperties = { minHeight: "100svh", background: C.bg, color: C.text, maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column" };
  if (!loaded) return <div style={{ ...shell, alignItems: "center", justifyContent: "center" }}><p style={label}>Loading</p></div>;
  if (!session) return <div style={{ ...shell, alignItems: "center", justifyContent: "center" }}><p style={label}>Session not found</p></div>;

  const phaseLabel = weekRow ? `Week ${week} · ${weekRow.label}` : `Week ${week}`;

  // ── Overview ──────────────────────────────────────────────────────────────
  if (phase === "overview") {
    const estMin = Math.round(active.reduce((m, i) => {
      const ex = session.exercises[i];
      if (ex.mode === "timed") return m + (firstInt(ex.reps) ?? 20);
      if (ex.mode === "interval") { const p = protocolForWeek(ex, week); return m + (p ? ((p.work + p.rest) * p.rounds * (p.blocks ?? 1) + (p.blockRest ?? 0) * ((p.blocks ?? 1) - 1)) / 60 : 10); }
      return m + setCount(ex) * (0.75 + restSeconds(ex.rest) / 60);
    }, 5));
    const liftSets = active.reduce((s, i) => s + (session.exercises[i].mode ? 0 : setCount(session.exercises[i])), 0);
    let n = 0;
    return (
      <div style={shell}>
        <div style={{ padding: "max(env(safe-area-inset-top, 0px), 14px) 16px 0" }}>
          <button onClick={() => router.back()} aria-label="Back" style={{ width: 38, height: 38, borderRadius: 12, background: C.panel, border: `1px solid ${C.line}`, color: C.text, fontSize: 18, cursor: "pointer" }}>‹</button>
        </div>

        <div style={{ padding: "22px 16px 8px" }}>
          <p style={{ ...label, color: C.bronze }}>{phaseLabel}</p>
          <h1 style={{ fontFamily: cond, fontWeight: 700, fontSize: 44, lineHeight: 0.95, textTransform: "uppercase", margin: "8px 0 0", letterSpacing: "0.01em" }}>
            {session.name.replace(/^[A-Za-z]+day\s*[—-]\s*/, "")}
          </h1>
          <div style={{ display: "flex", gap: 22, marginTop: 18 }}>
            {[[String(steps.length), "Blocks"], [String(liftSets), "Sets"], [`~${estMin}`, "Minutes"]].map(([v, l]) => (
              <div key={l}><p style={{ fontFamily: cond, fontWeight: 700, fontSize: 30, lineHeight: 1 }}>{v}</p><p style={{ ...label, marginTop: 4 }}>{l}</p></div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, padding: "18px 16px 120px", display: "flex", flexDirection: "column", gap: 10 }}>
          {session.pick && (
            <div style={{ background: C.panel, border: `1px solid rgba(200,150,90,0.3)`, borderRadius: 18, padding: 16 }}>
              <p style={{ ...label, color: C.bronze }}>{session.pick.label ?? `Pick ${session.pick.count} of ${choiceUnits.length}`}</p>
              <p style={{ fontFamily: inter, fontSize: 13, color: C.sub, margin: "6px 0 12px" }}>Tap to choose, based on what kit is free today.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {choiceUnits.map((u) => {
                  const on = u.every((i) => chosen.has(i));
                  const count = choiceUnits.filter((x) => x.every((i) => chosen.has(i))).length;
                  const name = u.map((i) => session.exercises[i].name.replace(/^Chest option(?: \(superset A\d\))?:\s*/, "")).join(" + ");
                  return (
                    <button key={u[0]} type="button" aria-pressed={on}
                      onClick={() => setChosen((prev) => {
                        const nx = new Set(prev);
                        if (on) u.forEach((i) => nx.delete(i)); else if (count < session.pick!.count) u.forEach((i) => nx.add(i));
                        return nx;
                      })}
                      style={{ fontFamily: inter, fontSize: 13, fontWeight: 600, padding: "9px 13px", borderRadius: 99, cursor: "pointer",
                        background: on ? C.bronze : "transparent", color: on ? C.bg : C.text, border: `1px solid ${on ? C.bronze : C.line}`,
                        opacity: !on && count >= session.pick!.count ? 0.4 : 1 }}>
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {steps.map((st, si) => (
            <div key={si} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "14px 16px", display: "flex", gap: 14 }}>
              <div style={{ fontFamily: cond, fontWeight: 700, fontSize: 22, color: st.superset ? C.bronze : C.mute, width: 26, flexShrink: 0, lineHeight: 1.2 }}>
                {st.superset ? st.superset : String(++n).padStart(2, "0")}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {st.superset && <p style={{ ...label, color: C.bronze, marginBottom: -4 }}>Superset · back to back</p>}
                {st.exIdx.map((i) => {
                  const ex = session.exercises[i];
                  const p = ex.mode === "interval" ? protocolForWeek(ex, week) : null;
                  const l = last[ex.name];
                  return (
                    <div key={i}>
                      <p style={{ fontFamily: inter, fontSize: 15, fontWeight: 600 }}>{ex.name.replace(/^(Chest option(?: \(superset A\d\))?|Superset [A-Z]\d|Finisher):\s*/, "")}</p>
                      <p style={{ fontFamily: inter, fontSize: 12, color: C.bronzeHi, marginTop: 3 }}>
                        {p ? `${p.label} · ${p.work}s on / ${p.rest}s off × ${p.rounds}${(p.blocks ?? 1) > 1 ? ` × ${p.blocks} blocks` : ""}`
                          : ex.mode === "timed" ? ex.reps : `${setCount(ex)} × ${ex.reps}`}
                        {!p && ex.mode !== "timed" && restSeconds(ex.rest) > 0 && <span style={{ color: C.sub }}> · {ex.rest} rest</span>}
                      </p>
                      {l?.weight != null && <p style={{ fontFamily: inter, fontSize: 11, color: C.sub, marginTop: 3 }}>Last time {kg(l.weight)}kg{l.reps ? ` × ${l.reps}` : ""}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {session.coachNote && (
            <div style={{ padding: "6px 4px", display: "flex", gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid rgba(200,150,90,0.4)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, Georgia, serif", color: C.bronze, fontSize: 13, flexShrink: 0 }}>N</div>
              <p style={{ fontFamily: inter, fontSize: 13, lineHeight: 1.55, color: "rgba(242,241,237,0.75)" }}>{session.coachNote}</p>
            </div>
          )}
        </div>

        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)", background: `linear-gradient(to top, ${C.bg} 60%, transparent)` }}>
          <button onClick={start} style={{ display: "block", width: "100%", maxWidth: 488, margin: "0 auto", background: C.bronze, color: C.bg, fontFamily: cond, fontWeight: 700, fontSize: 20, letterSpacing: "0.12em", textTransform: "uppercase", padding: "17px 0", borderRadius: 16, border: "none", cursor: "pointer" }}>
            Start session
          </button>
        </div>
      </div>
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  if (phase === "done") {
    let volume = 0;
    const prs: string[] = [];
    active.forEach((i) => {
      const ex = session.exercises[i];
      const best = Math.max(0, ...(logs[i] ?? []).filter((s) => s.done && s.weight).map((s) => s.weight as number));
      (logs[i] ?? []).forEach((s) => { if (s.done && s.weight && s.reps) volume += s.weight * s.reps; });
      const prev = last[ex.name]?.weight;
      if (best > 0 && prev != null && best > prev) prs.push(`${ex.name.replace(/^.*?:\s*/, "")} · ${kg(best)}kg (was ${kg(prev)}kg)`);
    });
    return (
      <div style={{ ...shell, padding: "max(env(safe-area-inset-top, 0px), 28px) 16px 24px", alignItems: "center" }}>
        <p style={{ ...label, color: C.bronze }}>{phaseLabel}</p>
        <div style={{ margin: "22px 0 18px" }}>
          <Ring pct={totalSets ? doneSets / totalSets : 1} size={200} stroke={12} color={C.green}>
            <span style={{ fontFamily: cond, fontWeight: 700, fontSize: 58, lineHeight: 1 }}>{totalSets ? Math.round((doneSets / totalSets) * 100) : 100}%</span>
            <span style={{ ...label, marginTop: 4 }}>Complete</span>
          </Ring>
        </div>
        <h1 style={{ fontFamily: cond, fontWeight: 700, fontSize: 38, textTransform: "uppercase", lineHeight: 1 }}>Session done</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: "100%", marginTop: 24 }}>
          {[[clock(elapsed), "Time"], [String(doneSets), "Sets"], [volume ? `${Math.round(volume).toLocaleString("en-GB")}` : "—", "Kg lifted"]].map(([v, l]) => (
            <div key={l} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px 10px", textAlign: "center" }}>
              <p style={{ fontFamily: cond, fontWeight: 700, fontSize: 28, lineHeight: 1 }}>{v}</p>
              <p style={{ ...label, marginTop: 6 }}>{l}</p>
            </div>
          ))}
        </div>
        {prs.length > 0 && (
          <div style={{ width: "100%", marginTop: 12, background: "rgba(200,150,90,0.08)", border: `1px solid rgba(200,150,90,0.3)`, borderRadius: 16, padding: 16 }}>
            <p style={{ ...label, color: C.bronze }}>New bests</p>
            {prs.map((p) => <p key={p} style={{ fontFamily: inter, fontSize: 14, marginTop: 8 }}>↑ {p}</p>)}
          </div>
        )}
        <p style={{ fontFamily: inter, fontSize: 14, color: "rgba(242,241,237,0.75)", textAlign: "center", lineHeight: 1.55, marginTop: 20, maxWidth: 340 }}>
          Logged. That&apos;s one more than the man who didn&apos;t show up today.
        </p>
        <div style={{ flex: 1 }} />
        <button onClick={() => router.push("/train")} style={{ width: "100%", marginTop: 24, background: C.bronze, color: C.bg, fontFamily: cond, fontWeight: 700, fontSize: 20, letterSpacing: "0.12em", textTransform: "uppercase", padding: "17px 0", borderRadius: 16, border: "none", cursor: "pointer" }}>
          Done
        </button>
      </div>
    );
  }

  // ── Active ────────────────────────────────────────────────────────────────
  const step = steps[stepIdx];
  const stepDone = step.exIdx.every((i) => (logs[i] ?? []).every((s) => s.done));
  const isLast = stepIdx === steps.length - 1;

  return (
    <div style={shell}>
      {/* Header */}
      <div style={{ padding: "max(env(safe-area-inset-top, 0px), 14px) 16px 12px", display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${C.line}` }}>
        <Ring pct={totalSets ? doneSets / totalSets : 0} size={54} stroke={5}>
          <span style={{ fontFamily: cond, fontWeight: 700, fontSize: 17, lineHeight: 1 }}>{doneSets}</span>
          <span style={{ fontFamily: inter, fontSize: 8, color: C.sub }}>/ {totalSets}</span>
        </Ring>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={label}>Block {stepIdx + 1} of {steps.length}</p>
          <div style={{ display: "flex", gap: 3, marginTop: 7 }}>
            {steps.map((st, k) => {
              const d = st.exIdx.every((i) => (logs[i] ?? []).every((s) => s.done));
              return <div key={k} style={{ flex: 1, height: 4, borderRadius: 99, background: d ? C.green : k === stepIdx ? C.bronze : C.line }} />;
            })}
          </div>
        </div>
        <p style={{ fontFamily: cond, fontWeight: 600, fontSize: 22, fontVariantNumeric: "tabular-nums" }}>{clock(elapsed)}</p>
      </div>

      <div style={{ flex: 1, padding: "18px 16px 130px", display: "flex", flexDirection: "column", gap: 22 }}>
        {step.superset && <p style={{ ...label, color: C.bronze }}>Superset {step.superset} · do one set of each, then rest</p>}
        {step.exIdx.map((i, pos) => {
          const ex = session.exercises[i];
          const rows = logs[i] ?? [];
          const l = last[ex.name];
          const nextOpen = rows.findIndex((r) => !r.done);
          const cleanName = ex.name.replace(/^(Chest option(?: \(superset A\d\))?|Superset [A-Z]\d|Finisher):\s*/, "");
          return (
            <section key={i} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                {step.superset && <p style={{ fontFamily: cond, fontWeight: 700, fontSize: 16, color: C.bronze }}>{step.superset}{pos + 1}</p>}
                <h2 style={{ fontFamily: cond, fontWeight: 700, fontSize: 32, lineHeight: 1, textTransform: "uppercase" }}>{cleanName}</h2>
                {ex.mode !== "interval" && (
                  <p style={{ fontFamily: inter, fontSize: 13, color: C.bronzeHi, marginTop: 6 }}>
                    {ex.mode === "timed" ? ex.reps : `${rows.length} × ${ex.reps}`}{restSeconds(ex.rest) > 0 && ex.mode !== "timed" && <span style={{ color: C.sub }}> · {ex.rest} rest</span>}
                  </p>
                )}
              </div>
              <Demo ex={ex} />
              {ex.notes && <p style={{ fontFamily: inter, fontSize: 13, lineHeight: 1.5, color: "rgba(242,241,237,0.7)" }}>{ex.notes}</p>}
              {l?.weight != null && ex.mode !== "interval" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(200,150,90,0.07)", border: `1px solid rgba(200,150,90,0.2)`, borderRadius: 12, padding: "10px 12px" }}>
                  <span style={{ ...label, color: C.bronze }}>Last time</span>
                  <span style={{ fontFamily: cond, fontWeight: 700, fontSize: 18 }}>{kg(l.weight)}kg{l.reps ? ` × ${l.reps}` : ""} <span style={{ fontFamily: inter, fontWeight: 500, fontSize: 11, color: C.sub }}>· beat it</span></span>
                </div>
              )}

              {ex.mode === "interval" ? (
                <IntervalTimer ex={ex} week={week} done={rows[0]?.done ?? false} onDone={() => update(i, 0, { done: true, reps: protocolForWeek(ex, week)?.rounds ?? null })} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rows.map((r, si) => {
                    const current = si === nextOpen;
                    return (
                      <div key={si} style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, borderRadius: 18, background: current ? C.panelHi : "transparent", border: `1px solid ${current ? "rgba(200,150,90,0.35)" : "transparent"}` }}>
                        <span style={{ width: 26, textAlign: "center", fontFamily: cond, fontWeight: 700, fontSize: 18, color: r.done ? C.green : current ? C.bronze : C.mute }}>{si + 1}</span>
                        {ex.mode === "timed" ? (
                          <Stepper id={`m-${i}-${si}`} value={r.reps} step={5} unit="min" disabled={r.done} onChange={(v) => update(i, si, { reps: v })} />
                        ) : (
                          <>
                            <Stepper id={`w-${i}-${si}`} value={r.weight} step={2.5} unit="kg" placeholder="—" disabled={r.done} onChange={(v) => update(i, si, { weight: v })} />
                            <Stepper id={`r-${i}-${si}`} value={r.reps} step={1} unit="reps" disabled={r.done} onChange={(v) => update(i, si, { reps: v })} />
                          </>
                        )}
                        <button type="button" aria-label={r.done ? `Undo set ${si + 1}` : `Complete set ${si + 1}`} onClick={() => tick(i, si)}
                          style={{ width: 44, height: 52, borderRadius: 14, flexShrink: 0, cursor: "pointer", border: `1px solid ${r.done ? C.green : current ? C.bronze : C.line}`,
                            background: r.done ? C.green : current ? "rgba(200,150,90,0.12)" : "transparent", color: r.done ? C.bg : current ? C.bronze : C.mute,
                            display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)", background: `linear-gradient(to top, ${C.bg} 65%, transparent)` }}>
        <div style={{ display: "flex", gap: 10, maxWidth: 488, margin: "0 auto" }}>
          {stepIdx > 0 && (
            <button onClick={() => { setStepIdx((s) => s - 1); window.scrollTo({ top: 0 }); }} aria-label="Previous block"
              style={{ width: 56, borderRadius: 16, background: C.panel, border: `1px solid ${C.line}`, color: C.text, fontSize: 22, cursor: "pointer" }}>‹</button>
          )}
          <button
            onClick={() => { if (isLast) finish(); else { setStepIdx((s) => s + 1); window.scrollTo({ top: 0 }); } }}
            style={{ flex: 1, background: isLast ? C.green : stepDone ? C.bronze : C.panelHi, color: isLast || stepDone ? C.bg : C.text,
              fontFamily: cond, fontWeight: 700, fontSize: 20, letterSpacing: "0.12em", textTransform: "uppercase", padding: "17px 0", borderRadius: 16,
              border: `1px solid ${isLast || stepDone ? "transparent" : C.line}`, cursor: "pointer" }}>
            {isLast ? (saving ? "Saving…" : "Finish session") : stepDone ? "Next" : "Skip to next"}
          </button>
        </div>
      </div>

      {/* Rest overlay */}
      {rest && (
        <div role="dialog" aria-label="Rest timer" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,10,12,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <p style={{ ...label, color: C.rest }}>Rest</p>
          <div style={{ margin: "20px 0" }}>
            <Ring pct={rest.left / rest.total} size={230} stroke={12} color={C.rest}>
              <span style={{ fontFamily: cond, fontWeight: 700, fontSize: 76, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{clock(rest.left)}</span>
            </Ring>
          </div>
          <p style={label}>Up next</p>
          <p style={{ fontFamily: inter, fontSize: 15, marginTop: 6, textAlign: "center" }}>{rest.next.replace(/^(Set \d+ · )(?:Chest option(?: \(superset A\d\))?|Superset [A-Z]\d|Finisher):\s*/, "$1")}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
            <button onClick={() => setRest((r) => r ? { ...r, left: r.left + 15, total: r.total + 15 } : r)} style={{ padding: "13px 22px", borderRadius: 99, background: "transparent", border: `1px solid ${C.line}`, color: C.text, fontFamily: cond, fontWeight: 700, fontSize: 17, letterSpacing: "0.08em", cursor: "pointer" }}>+15s</button>
            <button onClick={() => setRest(null)} style={{ padding: "13px 26px", borderRadius: 99, background: C.text, border: "none", color: C.bg, fontFamily: cond, fontWeight: 700, fontSize: 17, letterSpacing: "0.08em", cursor: "pointer" }}>SKIP REST</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Interval timer (sprints) ─────────────────────────────────────────────────
function IntervalTimer({ ex, week, done, onDone }: { ex: Exercise; week: number; done: boolean; onDone: () => void }) {
  const p = protocolForWeek(ex, week);
  const blocks = p?.blocks ?? 1;
  const [running, setRunning] = useState(false);
  const [state, setState] = useState<{ kind: "ready" | "work" | "rest" | "block" | "finished"; left: number; round: number; block: number }>({ kind: "ready", left: 0, round: 1, block: 1 });

  useEffect(() => {
    if (!running || !p) return;
    const id = setInterval(() => {
      setState((s) => {
        if (s.left > 1) return { ...s, left: s.left - 1 };
        try { navigator.vibrate?.(s.kind === "work" ? [120, 60, 120] : 250); } catch { /* not supported */ }
        if (s.kind === "work") {
          if (s.round < p.rounds) return { ...s, kind: "rest", left: p.rest };
          if (s.block < blocks) return { ...s, kind: "block", left: p.blockRest ?? 180 };
          return { ...s, kind: "finished", left: 0 };
        }
        if (s.kind === "rest") return { ...s, kind: "work", left: p.work, round: s.round + 1 };
        if (s.kind === "block") return { kind: "work", left: p.work, round: 1, block: s.block + 1 };
        return s;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, p, blocks]);

  useEffect(() => { if (state.kind === "finished") { setRunning(false); onDone(); } }, [state.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null;
  const total = state.kind === "work" ? p.work : state.kind === "rest" ? p.rest : state.kind === "block" ? (p.blockRest ?? 180) : 1;
  const color = state.kind === "work" ? C.work : state.kind === "finished" || done ? C.green : C.rest;
  const title = done || state.kind === "finished" ? "Done" : state.kind === "ready" ? "Ready" : state.kind === "work" ? "Go" : state.kind === "block" ? "Block rest" : "Rest";

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 22, padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <p style={{ ...label, color: C.bronze }}>{p.label} · {p.work}s on / {p.rest}s off × {p.rounds}{blocks > 1 ? ` × ${blocks} blocks` : ""}</p>
      <Ring pct={state.kind === "ready" || state.kind === "finished" || done ? 1 : state.left / total} size={210} stroke={12} color={color}>
        <span style={{ fontFamily: cond, fontWeight: 700, fontSize: 24, letterSpacing: "0.14em", color, textTransform: "uppercase" }}>{title}</span>
        <span style={{ fontFamily: cond, fontWeight: 700, fontSize: 64, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {state.kind === "ready" ? p.work : done || state.kind === "finished" ? "✓" : state.left}
        </span>
      </Ring>
      <div style={{ display: "flex", gap: 22 }}>
        <div style={{ textAlign: "center" }}><p style={{ fontFamily: cond, fontWeight: 700, fontSize: 24 }}>{Math.min(state.round, p.rounds)}/{p.rounds}</p><p style={label}>Round</p></div>
        {blocks > 1 && <div style={{ textAlign: "center" }}><p style={{ fontFamily: cond, fontWeight: 700, fontSize: 24 }}>{state.block}/{blocks}</p><p style={label}>Block</p></div>}
      </div>
      {!done && state.kind !== "finished" && (
        <button onClick={() => { if (state.kind === "ready") setState({ kind: "work", left: p.work, round: 1, block: 1 }); setRunning((r) => !r); }}
          style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", cursor: "pointer", background: running ? C.panelHi : C.work, color: running ? C.text : C.bg, fontFamily: cond, fontWeight: 700, fontSize: 19, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {state.kind === "ready" ? "Start intervals" : running ? "Pause" : "Resume"}
        </button>
      )}
      {!done && state.kind !== "ready" && state.kind !== "finished" && (
        <button onClick={() => { setRunning(false); onDone(); }} style={{ background: "none", border: "none", color: C.sub, fontFamily: inter, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>End early and log it</button>
      )}
    </div>
  );
}
