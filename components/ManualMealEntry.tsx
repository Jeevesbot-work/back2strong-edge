"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Log = {
  id: string; meal_name: string; calories: number; protein_g: number;
  carbs_g: number; fat_g: number; edge_comment: string; created_at: string;
};

const B = "#C8965A";
const SURFACE = "#171B21";
const BORDER = "#252A32";
const MUTED = "#9BA3AF";
const TEXT = "#F2F1ED";
const inter = "Inter, sans-serif";

export default function ManualMealEntry({ onLogged }: { onLogged: (log: Log) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"describe" | "macros">("describe");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // describe
  const [desc, setDesc] = useState("");
  // macros
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [pro, setPro] = useState("");
  const [carb, setCarb] = useState("");
  const [fat, setFat] = useState("");

  function reset() {
    setDesc(""); setName(""); setCal(""); setPro(""); setCarb(""); setFat(""); setError("");
  }

  async function submitDescribe() {
    if (!desc.trim()) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/nutrition/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: desc.trim() }),
      });
      if (!res.ok) { const e = await res.json(); setError(e.error || "Couldn't read that. Try the macros tab."); return; }
      const log: Log = await res.json();
      onLogged(log);
      reset(); setOpen(false);
    } catch {
      setError("Something went wrong. Check your connection.");
    } finally { setBusy(false); }
  }

  async function submitMacros() {
    const calories = Math.round(Number(cal));
    const protein_g = Math.round(Number(pro) * 10) / 10;
    if (!name.trim() || !calories || calories <= 0) { setError("Give it a name and calories at least."); return; }
    setBusy(true); setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — reopen the app."); return; }
      const carbs_g = carb ? Math.round(Number(carb) * 10) / 10 : 0;
      const fat_g = fat ? Math.round(Number(fat) * 10) / 10 : 0;
      const edge_comment =
        protein_g >= 30 ? "Big protein hit — that's the good stuff."
        : protein_g >= 15 ? "Solid protein. Keep them stacking up."
        : "Logged. Aim to get some protein alongside it next time.";
      const { data: log, error: insErr } = await supabase
        .from("nutrition_logs")
        .insert({ user_id: user.id, meal_name: name.trim(), calories, protein_g, carbs_g, fat_g, edge_comment })
        .select().single();
      if (insErr || !log) { setError("Couldn't save that. Try again."); return; }
      onLogged(log as Log);
      reset(); setOpen(false);
    } finally { setBusy(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 12,
    background: "rgba(0,0,0,0.3)", border: "1px solid " + BORDER,
    color: TEXT, fontFamily: inter, fontSize: 14, outline: "none",
  };

  if (!open) {
    return (
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="anim-1 pressable"
        style={{
          width: "100%", background: SURFACE, border: "1px solid " + BORDER, borderRadius: 20,
          padding: 16, display: "flex", alignItems: "center", gap: 16, marginBottom: 24,
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth={2} style={{ width: 20, height: 20 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div style={{ textAlign: "left", flex: 1 }}>
          <p style={{ fontFamily: "'Bebas Neue', Inter, sans-serif", fontWeight: 700, fontSize: 16, textTransform: "uppercase", letterSpacing: "0.04em", color: TEXT, lineHeight: 1 }}>Add Manually</p>
          <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, marginTop: 3 }}>Describe it, or type the macros yourself</p>
        </div>
      </button>
    );
  }

  return (
    <div style={{ background: SURFACE, border: "1px solid " + BORDER, borderRadius: 20, padding: 18, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: 4 }}>
          {(["describe", "macros"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setError(""); }} style={{
              padding: "7px 14px", borderRadius: 9, border: "none", cursor: "pointer",
              background: tab === t ? B : "transparent",
              fontFamily: inter, fontSize: 12, fontWeight: 700,
              color: tab === t ? "#0E1014" : MUTED,
            }}>{t === "describe" ? "Describe" : "Macros"}</button>
          ))}
        </div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 18, height: 18 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {tab === "describe" ? (
        <div>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. Two scrambled eggs on one slice of toast, and a flat white"
            rows={3}
            style={{ ...inputStyle, resize: "none", marginBottom: 10 }}
          />
          <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, marginBottom: 12 }}>Edge estimates the calories and protein from your description.</p>
          <button onClick={submitDescribe} disabled={busy || !desc.trim()} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: B, color: "#0E1014", fontFamily: inter, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer", opacity: !desc.trim() ? 0.5 : 1 }}>
            {busy ? "Reading…" : "Estimate & Log"}
          </button>
        </div>
      ) : (
        <div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meal name" style={{ ...inputStyle, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={cal} onChange={(e) => setCal(e.target.value)} inputMode="numeric" placeholder="Calories" style={inputStyle} />
            <input value={pro} onChange={(e) => setPro(e.target.value)} inputMode="numeric" placeholder="Protein (g)" style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={carb} onChange={(e) => setCarb(e.target.value)} inputMode="numeric" placeholder="Carbs (g) · optional" style={inputStyle} />
            <input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="numeric" placeholder="Fat (g) · optional" style={inputStyle} />
          </div>
          <button onClick={submitMacros} disabled={busy} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: B, color: "#0E1014", fontFamily: inter, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer" }}>
            {busy ? "Saving…" : "Log It"}
          </button>
        </div>
      )}

      {error && <p style={{ fontFamily: inter, fontSize: 12, color: "#F87171", marginTop: 10 }}>{error}</p>}
    </div>
  );
}
