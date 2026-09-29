"use client";

import { useEffect, useRef, useState } from "react";

type Log = {
  id: string; meal_name: string; calories: number; protein_g: number;
  carbs_g: number; fat_g: number; edge_comment: string; created_at: string;
};
type Item = { meal_name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; edge_comment?: string };
type Stage = "idle" | "thinking" | "question" | "review" | "saving";

// Minimal typing for the browser speech API (Chrome/Android, Safari where allowed).
type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};

// "Tell Edge what you ate" — speak or type, Edge splits it into items,
// asks one question if a portion is vague, then logs on confirm.
export default function TellEdge({ onLogged }: { onLogged: (logs: Log[]) => void }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef("");

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
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
    setError(""); setDone("");
    rec.start(); setListening(true);
  }

  async function parse(withAnswer?: string) {
    if (!text.trim()) return;
    recRef.current?.stop();
    setStage("thinking"); setError(""); setDone("");
    try {
      const res = await fetch("/api/nutrition/describe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "parse", text, answer: withAnswer ?? "" }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Couldn't read that."); setStage("idle"); return; }
      if (d.question) { setQuestion(d.question); setAnswer(""); setStage("question"); return; }
      setItems(d.items ?? []); setComment(d.edge_comment ?? ""); setStage("review");
    } catch { setError("No connection. Try again."); setStage("idle"); }
  }

  async function save() {
    setStage("saving"); setError("");
    try {
      const res = await fetch("/api/nutrition/describe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "save", items }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Couldn't save."); setStage("review"); return; }
      onLogged(d.logs ?? []);
      setDone(`Logged ${items.length} item${items.length === 1 ? "" : "s"}.`);
      setText(""); setItems([]); setStage("idle");
    } catch { setError("No connection. Try again."); setStage("review"); }
  }

  const total = items.reduce((a, i) => ({ c: a.c + i.calories, p: a.p + i.protein_g }), { c: 0, p: 0 });
  const busy = stage === "thinking" || stage === "saving";

  return (
    <div className="anim-1 rounded-[20px] mb-6 border border-edge-bronze/30 overflow-hidden" style={{ background: "linear-gradient(160deg, #1D1812 0%, #171B21 60%)" }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-condensed font-bold text-xl uppercase tracking-wide text-white leading-none">Tell Edge what you ate</p>
            <p className="text-edge-secondary text-xs mt-1">Say it like you&apos;d text a mate. Edge does the numbers.</p>
          </div>
          {canListen && stage !== "review" && (
            <button
              onClick={toggleMic}
              disabled={busy}
              aria-label={listening ? "Stop listening" : "Speak"}
              className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${listening ? "bg-edge-red animate-pulse" : "bg-edge-bronze"}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-6 h-6">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path strokeLinecap="round" d="M5 11a7 7 0 0014 0M12 18v3" />
              </svg>
            </button>
          )}
        </div>

        {(stage === "idle" || stage === "thinking" || stage === "question") && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy || stage === "question"}
              rows={3}
              placeholder={listening ? "Listening..." : "e.g. two bacon rolls with ketchup and a coffee with milk"}
              className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-[15px] font-body placeholder:text-white/30 focus:outline-none focus:border-edge-bronze/60 resize-none"
            />
            {!canListen && (
              <p className="text-edge-secondary text-[11px] mt-1.5">Tip: tap the 🎤 on your keyboard to speak instead of typing.</p>
            )}
          </>
        )}

        {stage === "question" && (
          <div className="mt-3 rounded-xl bg-black/25 border border-edge-bronze/30 p-3">
            <p className="text-edge-bronze font-condensed text-[11px] uppercase tracking-widest mb-1">Edge asks</p>
            <p className="text-white text-[15px] font-body mb-2">{question}</p>
            <div className="flex gap-2">
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && answer.trim()) parse(answer); }}
                autoFocus
                placeholder="Your answer"
                className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-body focus:outline-none focus:border-edge-bronze/60"
              />
              <button onClick={() => parse(answer || "not sure, use a normal portion")} className="bg-edge-bronze text-white font-condensed font-bold text-sm uppercase px-4 rounded-lg">
                {answer.trim() ? "Go" : "Skip"}
              </button>
            </div>
          </div>
        )}

        {stage === "review" && (
          <div>
            <p className="text-edge-secondary text-xs mb-2">Here&apos;s what Edge heard. Look right?</p>
            <div className="rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] bg-black/20">
              {items.map((i, idx) => (
                <div key={idx} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-body">{i.meal_name}</p>
                    <p className="text-edge-secondary text-[11px] tabular-nums">P {i.protein_g}g · C {i.carbs_g}g · F {i.fat_g}g</p>
                  </div>
                  <p className="text-white/85 text-sm tabular-nums flex-shrink-0">{i.calories}</p>
                  <button onClick={() => setItems((prev) => prev.filter((_, j) => j !== idx))} aria-label="Remove" className="text-edge-secondary active:text-white flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2">
                <span className="font-condensed text-xs uppercase tracking-widest text-edge-secondary">Total</span>
                <span className="text-white text-sm font-semibold tabular-nums">{total.p}g protein · {total.c} kcal</span>
              </div>
            </div>
            {comment && <p className="text-white/75 text-sm font-body mt-3 leading-relaxed">{comment}</p>}
          </div>
        )}

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        {done && stage === "idle" && <p className="text-green-400 text-xs mt-2">{done} Your totals below are updated.</p>}

        <div className="flex gap-2 mt-3">
          {stage === "review" || stage === "saving" ? (
            <>
              <button onClick={() => { setStage("idle"); setItems([]); }} disabled={busy} className="flex-1 bg-white/[0.06] border border-white/10 text-white font-condensed font-bold text-sm uppercase tracking-wider py-3 rounded-xl">Change it</button>
              <button onClick={save} disabled={busy || !items.length} className="flex-[2] bg-edge-bronze text-white font-condensed font-bold text-sm uppercase tracking-wider py-3 rounded-xl disabled:opacity-50">
                {stage === "saving" ? "Logging..." : "Log it"}
              </button>
            </>
          ) : stage !== "question" && (
            <button onClick={() => parse()} disabled={busy || !text.trim()} className="w-full bg-edge-bronze text-white font-condensed font-bold text-sm uppercase tracking-wider py-3 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              {stage === "thinking" && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {stage === "thinking" ? "Working it out..." : "Check it"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
