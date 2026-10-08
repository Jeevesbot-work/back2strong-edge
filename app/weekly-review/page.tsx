"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WeeklyReviewPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ wentWell: "", gotInWay: "", commitment: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const questions = [
    { key: "wentWell", label: "What went well this week?", placeholder: "Training, sleep, mindset, relationships — anything that moved..." },
    { key: "gotInWay", label: "What got in the way?", placeholder: "Not what should have gone better — what actually got in the way, and why..." },
    { key: "commitment", label: "What's your one commitment for next week?", placeholder: "One specific thing. Not a list. One commitment that makes next week better..." },
  ];

  const q = questions[step];

  async function finish() {
    setSaving(true);
    setError("");
    // Store in messages as a structured journal entry.
    // Read the body to the end before leaving: fetch resolves on the headers,
    // and navigating away then aborts the stream before the reply is saved.
    const summary = `WEEKLY REVIEW:\nWent well: ${answers.wentWell}\nGot in way: ${answers.gotInWay}\nCommitment: ${answers.commitment}`;
    try {
      const res = await fetch("/api/edge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: summary }),
      });
      const text = await res.text();
      if (!res.ok) {
        let message = "Couldn't save your review. Try again.";
        try {
          const data = JSON.parse(text) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // The body wasn't JSON.
        }
        setError(message);
        setSaving(false);
        return;
      }
    } catch {
      setError("Couldn't save your review. Check your connection and try again.");
      setSaving(false);
      return;
    }
    setSaving(false);
    router.push("/progress");
  }

  return (
    <div className="min-h-screen bg-edge-bg flex flex-col max-w-lg mx-auto px-4 pt-safe">
      <div className="py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-condensed font-black text-2xl uppercase tracking-wide">Weekly Review</h1>
          <p className="text-edge-muted text-xs">{step + 1}/3</p>
        </div>
      </div>

      <div className="h-1 bg-white/10 mb-8">
        <div className="h-full bg-edge-bronze transition-all" style={{ width: `${((step + 1) / 3) * 100}%` }} />
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h2 className="font-condensed font-bold text-2xl uppercase tracking-wide text-white mb-6 leading-tight">{q.label}</h2>
          <textarea
            value={answers[q.key as keyof typeof answers]}
            onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
            placeholder={q.placeholder}
            rows={6}
            autoFocus
            className="w-full bg-edge-surface border border-white/10 rounded-xl px-4 py-4 text-white font-body placeholder:text-edge-muted focus:outline-none focus:border-edge-bronze resize-none"
          />
        </div>

        <div className="pb-safe pb-4">
          {step < 2 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="w-full bg-edge-bronze text-edge-bg font-condensed font-bold text-xl uppercase tracking-widest py-4 rounded-xl active:scale-95"
            >
              Next
            </button>
          ) : (
            <>
              {error && (
                <p className="text-white/80 font-body text-sm mb-3 leading-relaxed">{error}</p>
              )}
              <button
                onClick={finish}
                disabled={saving}
                className="w-full bg-edge-bronze text-edge-bg font-condensed font-bold text-xl uppercase tracking-widest py-4 rounded-xl disabled:opacity-50 active:scale-95"
              >
                {saving ? "Saving..." : "Submit Review"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
