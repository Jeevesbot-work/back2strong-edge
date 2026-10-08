"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// stress/soreness: 1=low/good, 5=high/bad — intuitive scale, inverted in readiness calc
const QUESTIONS = [
  { key: "sleep_quality",  label: "How well did you sleep?",      low: "Terrible", high: "Excellent", invert: false },
  { key: "morning_energy", label: "Energy levels right now",      low: "Flat",      high: "Charged",   invert: false },
  { key: "stress_level",   label: "How stressed are you today?",  low: "Calm",      high: "Maxed out", invert: true  },
  { key: "soreness",       label: "Muscle soreness",               low: "None",      high: "Wrecked",   invert: true  },
  { key: "motivation",     label: "Motivation to train",           low: "Zero",      high: "Ready",     invert: false },
];

const B = "#C8965A";
const BG = "#0E1014";
const SURFACE = "#171B21";
const BORDER = "#252A32";

export default function CheckInPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({
    sleep_quality: 3, morning_energy: 3, stress_level: 3, soreness: 3, motivation: 3,
  });
  const [notes, setNotes] = useState("");
  const [weight, setWeight] = useState("");
  const [loading, setLoading] = useState(false);
  const [edgeResponse, setEdgeResponse] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const isNotesStep = step === QUESTIONS.length;
  const q = QUESTIONS[step];
  const progressPct = (step / (QUESTIONS.length + 1)) * 100;

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scores, notes, weight_kg: weight ? parseFloat(weight) : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save your check-in. Try again.");
        setLoading(false);
        return;
      }
      setEdgeResponse(data.response ?? "");
    } catch {
      // silently continue — check-in saved even if AI response fails
    }
    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <div style={{ minHeight: "100svh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth={2.5} style={{ width: 22, height: 22 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 28, color: "#F2F1ED", fontWeight: 400, marginBottom: 16 }}>Check-in done.</h1>
        {edgeResponse && (
          <div style={{ background: SURFACE, borderRadius: 16, padding: "16px 20px", border: "1px solid rgba(200,150,90,0.15)", marginBottom: 32, maxWidth: 320, textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 11, color: B }}>N</span>
              </div>
              <span style={{ fontSize: 9, color: B, fontFamily: "Inter, sans-serif", textTransform: "uppercase" as const, letterSpacing: "0.15em" }}>Nick</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(242,241,237,0.75)", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>{edgeResponse}</p>
          </div>
        )}
        <button onClick={() => router.push("/home")} style={{ background: B, color: BG, fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13, textTransform: "uppercase" as const, letterSpacing: "0.15em", padding: "15px 48px", borderRadius: 14, border: "none", cursor: "pointer", width: "100%", maxWidth: 320 }}>
          Back to Today
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100svh", background: BG, display: "flex", flexDirection: "column", maxWidth: 512, margin: "0 auto", padding: "0 20px" }}>
      {/* Progress bar */}
      <div style={{ height: 2, background: BORDER, position: "fixed" as const, top: 0, left: 0, right: 0, zIndex: 10 }}>
        <div style={{ height: "100%", background: B, width: `${progressPct}%`, transition: "width 0.4s ease" }} />
      </div>

      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, paddingTop: 40, paddingBottom: 8 }}>
        {QUESTIONS.map((_, i) => (
          <div key={i} style={{ height: 4, borderRadius: 99, transition: "all 0.3s", width: i === step ? 24 : 10, background: i <= step ? B : BORDER, opacity: i < step ? 0.45 : 1 }} />
        ))}
        <div style={{ height: 4, borderRadius: 99, width: step === QUESTIONS.length ? 24 : 10, background: step === QUESTIONS.length ? B : BORDER }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 40 }}>
        {!isNotesStep ? (
          <div>
            <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase" as const, letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 12 }}>
              {step + 1} of {QUESTIONS.length}
            </p>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 28, color: "#F2F1ED", fontWeight: 400, lineHeight: 1.2, marginBottom: 40 }}>
              {q.label}
            </h2>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: "#9BA3AF", fontFamily: "Inter, sans-serif" }}>{q.low}</span>
              <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 48, color: "#F2F1ED", fontWeight: 400, lineHeight: 1 }}>{scores[q.key]}</span>
              <span style={{ fontSize: 11, color: "#9BA3AF", fontFamily: "Inter, sans-serif" }}>{q.high}</span>
            </div>
            <input type="range" min={1} max={5} value={scores[q.key]} onChange={(e) => setScores({ ...scores, [q.key]: parseInt(e.target.value) })} style={{ width: "100%", marginBottom: 10, accentColor: B }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 48 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} style={{ fontSize: 11, fontFamily: "Inter, sans-serif", color: scores[q.key] === n ? B : "#3D434D", fontWeight: scores[q.key] === n ? 600 : 400, transition: "color 0.15s" }}>{n}</span>
              ))}
            </div>
            <button onClick={() => setStep((s) => s + 1)} style={{ width: "100%", background: B, color: BG, fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13, textTransform: "uppercase" as const, letterSpacing: "0.15em", padding: "16px", borderRadius: 16, border: "none", cursor: "pointer" }}>
              Next →
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase" as const, letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 12 }}>Optional</p>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 28, color: "#F2F1ED", fontWeight: 400, marginBottom: 8 }}>Anything Nick should know today?</h2>
            <p style={{ fontSize: 13, color: "#9BA3AF", fontFamily: "Inter, sans-serif", marginBottom: 24 }}>Back tight, tough night, big week at work... or skip.</p>

            {/* Morning weight */}
            <label style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase" as const, letterSpacing: "0.15em", fontFamily: "Inter, sans-serif", display: "block", marginBottom: 8 }}>
              Morning weight (kg) — optional
            </label>
            <div style={{ position: "relative", marginBottom: 24 }}>
              <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 124"
                style={{ width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "14px 16px", color: "#F2F1ED", fontFamily: "Inter, sans-serif", fontSize: 16, outline: "none", boxSizing: "border-box" as const }}
              />
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything relevant..."
              rows={4}
              style={{ width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "14px 16px", color: "#F2F1ED", fontFamily: "Inter, sans-serif", fontSize: 14, outline: "none", resize: "none" as const, marginBottom: 24, boxSizing: "border-box" as const }}
            />
            {error && (
              <p style={{ fontSize: 13, color: "#F2F1ED", fontFamily: "Inter, sans-serif", lineHeight: 1.45, marginBottom: 12 }}>{error}</p>
            )}
            <button
              onClick={submit}
              disabled={loading}
              style={{ width: "100%", background: loading ? BORDER : B, color: loading ? "#9BA3AF" : BG, fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13, textTransform: "uppercase" as const, letterSpacing: "0.15em", padding: "16px", borderRadius: 16, border: "none", cursor: loading ? "default" : "pointer" }}
            >
              {loading ? "Saving..." : "Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
