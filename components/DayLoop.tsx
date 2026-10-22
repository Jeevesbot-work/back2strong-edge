"use client";

import { useEffect, useRef, useState } from "react";

export type DayTask = { id: string; text: string; done: boolean; position: number };
export type MorningReport = {
  headline: string;
  first_move: string;
  on_your_mind: { worry: string; suggestion: string }[];
  wins: string[];
  day_summary: string;
  edge_note: string;
  support?: boolean;
};

type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};

const serif = { fontFamily: "Fraunces, Georgia, serif" };
const eyebrow = "text-[9px] uppercase tracking-[0.2em] font-body";

function Mic({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M5 11a7 7 0 0014 0M12 18v3" />
    </svg>
  );
}

// The night-to-morning loop on Today:
//   Morning — the report Edge built from last night (to-dos, first move, worries + fixes, wins).
//   Evening — "Close the day": talk it all out, Edge sorts it, switch off.
export default function DayLoop({
  dateLabel, todayTasks, todayReport, tonightReport, tonightTaskCount, readOnly = false,
}: {
  dateLabel: string;
  todayTasks: DayTask[];
  todayReport: MorningReport | null;
  tonightReport: MorningReport | null;
  tonightTaskCount: number;
  readOnly?: boolean;
}) {
  const [tasks, setTasks] = useState(todayTasks);
  const [closed, setClosed] = useState<{ report: MorningReport; count: number } | null>(
    tonightReport ? { report: tonightReport, count: tonightTaskCount } : null,
  );
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef("");
  const boxRef = useRef<HTMLTextAreaElement | null>(null);

  // Keep the latest words in view while he talks.
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setCanListen(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function listen(current: string) {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-GB"; rec.interimResults = true; rec.continuous = true;
    baseRef.current = current ? current.trim() + " " : "";
    rec.onresult = (e) => {
      let s = "";
      for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      setText(baseRef.current + s);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); setCanListen(false); };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  function start() {
    if (readOnly) { setError("Viewing as a client is read-only."); return; }
    setOpen(true); setError("");
    if (canListen) listen("");
  }

  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    listen(text);
  }

  async function finish() {
    if (readOnly) { setError("Viewing as a client is read-only."); return; }
    if (!text.trim()) return;
    recRef.current?.stop();
    setThinking(true); setError("");
    try {
      const res = await fetch("/api/tasks/parse", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Couldn't read that."); setThinking(false); return; }
      setClosed({ report: d.report, count: (d.tasks ?? []).length });
      setText(""); setOpen(false); setThinking(false);
    } catch { setError("No connection. Try again."); setThinking(false); }
  }

  async function toggle(task: DayTask) {
    if (readOnly) return;
    const done = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done } : t)));
    const res = await fetch("/api/tasks/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, done }),
    });
    if (!res.ok) setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const r = todayReport;

  return (
    <div className="space-y-3">
      {/* ── Morning report ─────────────────────────────── */}
      {(r || tasks.length > 0) && (
        <div className="rounded-[20px] border border-edge-bronze/30 overflow-hidden" style={{ background: "linear-gradient(165deg, #1D1812 0%, #171B21 45%)" }}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className={`${eyebrow} text-edge-bronze`}>{r ? "Morning report" : "Today's list"}</span>
              <span className="text-[11px] text-[#9BA3AF] font-body">{dateLabel}</span>
            </div>

            {r?.headline && <p className="text-[24px] text-[#F2F1ED] leading-[1.15] mb-4" style={serif}>{r.headline}</p>}

            {r?.support && (
              <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3.5 mb-4">
                <p className="text-[13px] text-[#F2F1ED] font-body leading-relaxed">
                  Sounds like a heavy one. Talk to someone today — Nick, a mate, or Samaritans on <a href="tel:116123" className="text-edge-bronze font-semibold">116 123</a> (free, any time).
                </p>
              </div>
            )}

            {r?.first_move && (
              <div className="rounded-xl bg-edge-bronze/[0.12] border border-edge-bronze/35 px-4 py-3 mb-4">
                <p className={`${eyebrow} text-edge-bronze mb-1`}>First move</p>
                <p className="text-[14px] text-[#F2F1ED] font-body leading-snug">{r.first_move}</p>
              </div>
            )}

            {tasks.length > 0 && (
              <div className="mb-1">
                <div className="flex items-center justify-between mb-2">
                  <span className={`${eyebrow} text-[#9BA3AF]`}>To do</span>
                  <span className={`text-[11px] font-body tabular-nums ${doneCount === tasks.length ? "text-[#34D399]" : "text-[#9BA3AF]"}`}>
                    {doneCount === tasks.length ? "All done ✓" : `${doneCount} of ${tasks.length}`}
                  </span>
                </div>
                <div className="h-[3px] rounded-full bg-white/[0.08] overflow-hidden mb-1.5">
                  <div className="h-full rounded-full bg-edge-bronze transition-all duration-500" style={{ width: `${(doneCount / tasks.length) * 100}%` }} />
                </div>
                <ul>
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2">
                      <button
                        onClick={() => toggle(t)}
                        aria-label={t.done ? "Mark not done" : "Mark done"}
                        className={`w-[22px] h-[22px] rounded-full flex-shrink-0 flex items-center justify-center border transition-all ${t.done ? "bg-edge-bronze border-edge-bronze" : "border-white/25"}`}
                      >
                        {t.done && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </button>
                      <span className={`flex-1 text-[14px] font-body leading-snug ${t.done ? "text-white/35 line-through" : "text-[#F2F1ED]"}`}>{t.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {r && r.on_your_mind.length > 0 && (
            <div className="px-5 py-4 border-t border-white/[0.06]">
              <p className={`${eyebrow} text-[#9BA3AF] mb-3`}>On your mind</p>
              <div className="space-y-3">
                {r.on_your_mind.map((m, i) => (
                  <div key={i}>
                    <p className="text-[14px] text-[#F2F1ED] font-body font-medium leading-snug">{m.worry}</p>
                    <p className="text-[13px] text-white/65 font-body leading-relaxed mt-0.5">
                      <span className="text-edge-bronze font-semibold">Try this → </span>{m.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {r && (r.day_summary || r.wins.length > 0) && (
            <div className="px-5 py-4 border-t border-white/[0.06]">
              <p className={`${eyebrow} text-[#9BA3AF] mb-2`}>Yesterday</p>
              {r.day_summary && <p className="text-[13px] text-white/70 font-body leading-relaxed">{r.day_summary}</p>}
              {r.wins.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {r.wins.map((w) => (
                    <span key={w} className="text-[11px] text-[#34D399] font-body bg-[#34D399]/10 border border-[#34D399]/20 rounded-full px-2.5 py-1">✓ {w}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {r?.edge_note && (
            <div className="px-5 py-4 border-t border-white/[0.06] flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#252A32] border border-edge-bronze/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] text-edge-bronze" style={serif}>E</span>
              </div>
              <p className="text-[13px] text-white/75 font-body leading-relaxed">{r.edge_note}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Close the day ──────────────────────────────── */}
      <div className="rounded-[20px] border border-[#252A32] overflow-hidden" style={{ background: "#171B21" }}>
        <div className="p-5">
          {!open && !closed && (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`${eyebrow} text-[#9BA3AF] mb-1.5`}>Tonight</p>
                <p className="text-[22px] text-[#F2F1ED] leading-tight" style={serif}>Close the day.</p>
                <p className="text-[12px] text-[#9BA3AF] font-body mt-1 leading-snug">Jobs, worries, how it went. Say it all, then switch off. Wake up to a plan.</p>
              </div>
              <button onClick={start} aria-label="Close the day" className="w-14 h-14 rounded-full bg-edge-bronze flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform shadow-[0_0_0_6px_rgba(200,150,90,0.12)]">
                <Mic />
              </button>
            </div>
          )}

          {!open && closed && (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`${eyebrow} text-[#34D399] mb-1.5`}>Day closed ✓</p>
                <p className="text-[22px] text-[#F2F1ED] leading-tight" style={serif}>It&apos;s out of your head.</p>
                <p className="text-[12px] text-[#9BA3AF] font-body mt-1 leading-snug">
                  Your morning report is ready{closed.count ? ` — ${closed.count} job${closed.count === 1 ? "" : "s"}` : ""}
                  {closed.report.on_your_mind.length ? `, ${closed.report.on_your_mind.length} thing${closed.report.on_your_mind.length === 1 ? "" : "s"} on your mind sorted` : ""}. Lights down.
                </p>
              </div>
              <button onClick={start} className="text-[11px] uppercase tracking-[0.15em] text-edge-bronze font-body font-semibold flex-shrink-0">Add more</button>
            </div>
          )}

          {open && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className={`${eyebrow} ${listening ? "text-edge-red" : "text-[#9BA3AF]"}`}>{listening ? "● Listening" : "Close the day"}</p>
                  <p className="text-[18px] text-[#F2F1ED] leading-tight mt-1" style={serif}>{listening ? "Just talk. Take your time." : "Say it, or type it."}</p>
                </div>
                {canListen && (
                  <button onClick={toggleMic} disabled={thinking} aria-label={listening ? "Pause" : "Speak"}
                    className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${listening ? "bg-edge-red animate-pulse" : "bg-edge-bronze"}`}>
                    <Mic />
                  </button>
                )}
              </div>

              {!text && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {["What's on tomorrow?", "How did today go?", "What's bugging you?"].map((h) => (
                    <span key={h} className="text-[11px] text-white/55 font-body border border-white/10 rounded-full px-2.5 py-1">{h}</span>
                  ))}
                </div>
              )}

              <textarea
                ref={boxRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={thinking}
                rows={5}
                placeholder={canListen ? "Your words appear here…" : "Tap the 🎤 on your keyboard and talk."}
                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-[15px] font-body placeholder:text-white/30 focus:outline-none focus:border-edge-bronze/60 resize-none"
              />
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

              <div className="flex gap-2 mt-3">
                <button onClick={() => { recRef.current?.stop(); setOpen(false); setText(""); setError(""); }} disabled={thinking}
                  className="flex-1 bg-white/[0.06] border border-white/10 text-white font-condensed font-bold text-sm uppercase tracking-wider py-3 rounded-xl">Cancel</button>
                <button onClick={finish} disabled={thinking || !text.trim()}
                  className="flex-[2] bg-edge-bronze text-white font-condensed font-bold text-sm uppercase tracking-wider py-3 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                  {thinking && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {thinking ? "Edge is sorting it…" : "Done — switch off"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
