"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type DayTask = { id: string; text: string; done: boolean; position: number };

type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};
type Stage = "idle" | "thinking" | "review" | "saving";

// Today's list + "Clear your head" voice brain-dump for tomorrow.
// Talk it out before bed → Edge writes the list → it's waiting on Today in the morning.
export default function DayList({
  todayDate, tomorrowDate, initialToday, initialTomorrow,
}: {
  todayDate: string; tomorrowDate: string; initialToday: DayTask[]; initialTomorrow: DayTask[];
}) {
  const [today, setToday] = useState<DayTask[]>(initialToday);
  const [tomorrow, setTomorrow] = useState<DayTask[]>(initialTomorrow);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [draft, setDraft] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [showTomorrow, setShowTomorrow] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef("");

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setCanListen(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-GB"; rec.interimResults = true; rec.continuous = true;
    baseRef.current = text ? text.trim() + " " : "";
    rec.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      setText(baseRef.current + said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); setCanListen(false); };
    recRef.current = rec;
    setError(""); setSaved("");
    rec.start(); setListening(true);
  }

  async function makeList() {
    if (!text.trim()) return;
    recRef.current?.stop();
    setStage("thinking"); setError("");
    try {
      const res = await fetch("/api/tasks/parse", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Couldn't read that."); setStage("idle"); return; }
      setDraft(d.tasks ?? []); setComment(d.edge_comment ?? ""); setStage("review");
    } catch { setError("No connection. Try again."); setStage("idle"); }
  }

  async function saveList() {
    setStage("saving"); setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Please log in again."); setStage("review"); return; }
      const start = tomorrow.length;
      const rows = draft.map((t, i) => ({ user_id: user.id, for_date: tomorrowDate, text: t, position: start + i }));
      const { data, error: err } = await supabase.from("day_tasks").insert(rows).select("id, text, done, position");
      if (err) { setError("Couldn't save. Try again."); setStage("review"); return; }
      setTomorrow((prev) => [...prev, ...((data ?? []) as DayTask[])]);
      setSaved(comment || "Saved. It's out of your head now — switch off.");
      setText(""); setDraft([]); setStage("idle"); setOpen(false); setShowTomorrow(true);
    } catch { setError("No connection. Try again."); setStage("review"); }
  }

  async function toggle(task: DayTask) {
    setToday((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    const supabase = createClient();
    await supabase.from("day_tasks").update({ done: !task.done }).eq("id", task.id);
  }

  async function remove(list: "today" | "tomorrow", id: string) {
    (list === "today" ? setToday : setTomorrow)((prev) => prev.filter((t) => t.id !== id));
    const supabase = createClient();
    await supabase.from("day_tasks").delete().eq("id", id);
  }

  const doneCount = today.filter((t) => t.done).length;
  const busy = stage === "thinking" || stage === "saving";

  return (
    <div className="rounded-[20px] border border-[#252A32] overflow-hidden" style={{ background: "#171B21" }}>
      {/* Today's list */}
      {today.length > 0 && (
        <div className="p-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] uppercase tracking-[0.2em] text-edge-bronze font-body">Today&apos;s list</span>
            <span className={`text-[11px] font-body tabular-nums ${doneCount === today.length ? "text-[#34D399]" : "text-[#9BA3AF]"}`}>
              {doneCount === today.length ? "All done ✓" : `${doneCount} of ${today.length}`}
            </span>
          </div>
          <div className="h-[3px] rounded-full bg-white/[0.08] overflow-hidden mb-3">
            <div className="h-full rounded-full bg-edge-bronze transition-all duration-500" style={{ width: `${(doneCount / today.length) * 100}%` }} />
          </div>
          <ul className="space-y-0.5">
            {today.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <button
                  onClick={() => toggle(t)}
                  aria-label={t.done ? "Mark not done" : "Mark done"}
                  className={`w-[22px] h-[22px] rounded-full flex-shrink-0 flex items-center justify-center border transition-all ${t.done ? "bg-edge-bronze border-edge-bronze" : "border-white/25"}`}
                >
                  {t.done && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  )}
                </button>
                <span className={`flex-1 text-[14px] font-body leading-snug ${t.done ? "text-white/35 line-through" : "text-[#F2F1ED]"}`}>{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clear your head — for tomorrow */}
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.2em] text-[#9BA3AF] font-body mb-1.5">Tomorrow</p>
            <p className="text-[20px] text-[#F2F1ED] leading-tight" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
              {tomorrow.length > 0 ? `${tomorrow.length} thing${tomorrow.length === 1 ? "" : "s"} sorted.` : "Clear your head."}
            </p>
            <p className="text-[12px] text-[#9BA3AF] font-body mt-1">
              {tomorrow.length > 0 ? "Waiting for you on Today in the morning." : "Talk it out. Edge writes the list. No pen needed."}
            </p>
          </div>
          {!open && (
            <button
              onClick={() => { setOpen(true); setSaved(""); }}
              aria-label="Speak tomorrow's list"
              className="w-12 h-12 rounded-full bg-edge-bronze flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-6 h-6">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path strokeLinecap="round" d="M5 11a7 7 0 0014 0M12 18v3" />
              </svg>
            </button>
          )}
        </div>

        {saved && !open && <p className="text-[13px] text-white/75 font-body mt-3 leading-relaxed">{saved}</p>}

        {tomorrow.length > 0 && !open && (
          <div className="mt-3">
            <button onClick={() => setShowTomorrow((s) => !s)} className="text-[11px] uppercase tracking-[0.15em] text-edge-bronze font-body font-semibold">
              {showTomorrow ? "Hide list" : "See list"}
            </button>
            {showTomorrow && (
              <ul className="mt-2 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] bg-black/20">
                {tomorrow.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-edge-bronze flex-shrink-0" />
                    <span className="flex-1 text-[14px] text-[#F2F1ED] font-body leading-snug">{t.text}</span>
                    <button onClick={() => remove("tomorrow", t.id)} aria-label="Remove" className="text-[#9BA3AF] active:text-white flex-shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {open && (
          <div className="mt-4">
            {(stage === "idle" || stage === "thinking") && (
              <>
                <div className="relative">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={busy}
                    rows={4}
                    placeholder={listening ? "Listening… just talk." : "e.g. ring the garage about the car first thing, pick the kids up at 3, train at 6, email Dave back"}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 pr-14 text-white text-[15px] font-body placeholder:text-white/30 focus:outline-none focus:border-edge-bronze/60 resize-none"
                  />
                  {canListen && (
                    <button
                      onClick={toggleMic}
                      disabled={busy}
                      aria-label={listening ? "Stop listening" : "Speak"}
                      className={`absolute right-2 top-2 w-10 h-10 rounded-full flex items-center justify-center transition-all ${listening ? "bg-edge-red animate-pulse" : "bg-edge-bronze"}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5">
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path strokeLinecap="round" d="M5 11a7 7 0 0014 0M12 18v3" />
                      </svg>
                    </button>
                  )}
                </div>
                {!canListen && <p className="text-[#9BA3AF] text-[11px] mt-1.5">Tip: tap the 🎤 on your keyboard to talk instead of typing.</p>}
              </>
            )}

            {(stage === "review" || stage === "saving") && (
              <div>
                <p className="text-[#9BA3AF] text-xs mb-2">Here&apos;s your list for tomorrow. Bin anything you don&apos;t need.</p>
                <ul className="rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] bg-black/20">
                  {draft.map((t, i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-edge-bronze flex-shrink-0" />
                      <span className="flex-1 text-[14px] text-[#F2F1ED] font-body leading-snug">{t}</span>
                      <button onClick={() => setDraft((p) => p.filter((_, j) => j !== i))} aria-label="Remove" className="text-[#9BA3AF] active:text-white flex-shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
                {comment && <p className="text-white/75 text-[13px] font-body mt-3 leading-relaxed">{comment}</p>}
              </div>
            )}

            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

            <div className="flex gap-2 mt-3">
              {stage === "review" || stage === "saving" ? (
                <>
                  <button onClick={() => { setStage("idle"); setDraft([]); }} disabled={busy} className="flex-1 bg-white/[0.06] border border-white/10 text-white font-condensed font-bold text-sm uppercase tracking-wider py-3 rounded-xl">Redo</button>
                  <button onClick={saveList} disabled={busy || !draft.length} className="flex-[2] bg-edge-bronze text-white font-condensed font-bold text-sm uppercase tracking-wider py-3 rounded-xl disabled:opacity-50">
                    {stage === "saving" ? "Saving…" : "Save for tomorrow"}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { recRef.current?.stop(); setOpen(false); setText(""); setError(""); }} disabled={busy} className="flex-1 bg-white/[0.06] border border-white/10 text-white font-condensed font-bold text-sm uppercase tracking-wider py-3 rounded-xl">Cancel</button>
                  <button onClick={makeList} disabled={busy || !text.trim()} className="flex-[2] bg-edge-bronze text-white font-condensed font-bold text-sm uppercase tracking-wider py-3 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                    {stage === "thinking" && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {stage === "thinking" ? "Writing your list…" : "Make my list"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
