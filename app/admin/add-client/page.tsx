"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const GOALS = [
  { value: "stronger", label: "Get stronger" },
  { value: "back", label: "Fix back & movement" },
  { value: "energy", label: "More energy & vitality" },
  { value: "fat", label: "Lose body fat" },
  { value: "identity", label: "Rebuild identity" },
  { value: "all", label: "All of the above" },
];

const TRAINING_STATES = [
  { value: "none", label: "Not training at all" },
  { value: "occasional", label: "Occasional (1x/week or less)" },
  { value: "inconsistent", label: "Training inconsistently" },
  { value: "regular", label: "Regular but not progressing" },
];

export default function AddClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    email: "",
    full_name: "",
    age: "",
    goal: "",
    training_state: "",
    injuries: "",
    days_per_week: 3,
    body_weight_kg: "",
    protein_target: 0,
    calorie_target: 0,
  });

  function setWeight(kg: string) {
    const w = parseFloat(kg);
    if (!isNaN(w) && w > 0) {
      const multiplier = data.goal === "fat" ? 28 : data.goal === "stronger" ? 36 : 33;
      setData((d) => ({
        ...d,
        body_weight_kg: kg,
        protein_target: Math.round(w * 2),
        calorie_target: Math.round(w * multiplier),
      }));
    } else {
      setData((d) => ({ ...d, body_weight_kg: kg, protein_target: 0, calorie_target: 0 }));
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/add-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong");
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-edge-bg flex flex-col items-center justify-center px-6">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth={2.5} className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-condensed font-black text-3xl uppercase tracking-wide mb-3 text-center">
          {data.full_name.split(" ")[0]} is set up.
        </h1>
        <p className="text-edge-muted text-sm text-center mb-8">
          Profile created, approved, and access email sent to {data.email}.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => { setSent(false); setData({ email: "", full_name: "", age: "", goal: "", training_state: "", injuries: "", days_per_week: 3, body_weight_kg: "", protein_target: 0, calorie_target: 0 }); }}
            className="px-5 py-3 rounded-xl border border-white/10 bg-edge-surface font-condensed font-bold text-sm uppercase tracking-wide active:scale-95 transition-transform"
          >
            Add Another
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="px-5 py-3 rounded-xl bg-edge-bronze font-condensed font-bold text-sm uppercase tracking-wide text-edge-bg active:scale-95 transition-transform"
          >
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-edge-bg max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin" className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="font-condensed font-black text-2xl uppercase tracking-wide">Add New Client</h1>
          <p className="text-edge-muted text-xs">Creates profile, approves access, sends magic link. To copy a link and send it yourself, use <Link href="/admin/invite" className="text-edge-bronze">Invite a client</Link>.</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Identity */}
        <div className="bg-edge-surface rounded-xl border border-white/[0.08] p-5">
          <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-bronze mb-4">Identity</p>
          <div className="space-y-3">
            <div>
              <label className="text-edge-muted text-xs uppercase tracking-widest font-condensed block mb-1.5">Email *</label>
              <input
                type="email"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                placeholder="client@email.com"
                className="w-full bg-edge-bg border border-white/10 rounded-xl px-4 py-3 text-white font-body text-sm placeholder:text-edge-muted focus:outline-none focus:border-edge-bronze"
              />
            </div>
            <div>
              <label className="text-edge-muted text-xs uppercase tracking-widest font-condensed block mb-1.5">Full Name *</label>
              <input
                type="text"
                value={data.full_name}
                onChange={(e) => setData({ ...data, full_name: e.target.value })}
                placeholder="Lee Robinson"
                className="w-full bg-edge-bg border border-white/10 rounded-xl px-4 py-3 text-white font-body text-sm placeholder:text-edge-muted focus:outline-none focus:border-edge-bronze"
              />
            </div>
            <div>
              <label className="text-edge-muted text-xs uppercase tracking-widest font-condensed block mb-1.5">Age</label>
              <input
                type="number"
                value={data.age}
                onChange={(e) => setData({ ...data, age: e.target.value })}
                placeholder="e.g. 47"
                min={30}
                max={80}
                className="w-full bg-edge-bg border border-white/10 rounded-xl px-4 py-3 text-white font-body text-sm placeholder:text-edge-muted focus:outline-none focus:border-edge-bronze"
              />
            </div>
          </div>
        </div>

        {/* Goal */}
        <div className="bg-edge-surface rounded-xl border border-white/[0.08] p-5">
          <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-bronze mb-4">Primary Goal</p>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map((g) => (
              <button
                key={g.value}
                onClick={() => setData({ ...data, goal: g.value })}
                className={`text-left px-4 py-3 rounded-xl border font-body text-sm transition-all ${
                  data.goal === g.value
                    ? "border-edge-bronze bg-edge-bronze/10 text-white"
                    : "border-white/10 bg-edge-bg text-white/60"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Training state */}
        <div className="bg-edge-surface rounded-xl border border-white/[0.08] p-5">
          <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-bronze mb-4">Current Training State</p>
          <div className="space-y-2">
            {TRAINING_STATES.map((s) => (
              <button
                key={s.value}
                onClick={() => setData({ ...data, training_state: s.value })}
                className={`w-full text-left px-4 py-3 rounded-xl border font-body text-sm transition-all ${
                  data.training_state === s.value
                    ? "border-edge-bronze bg-edge-bronze/10 text-white"
                    : "border-white/10 bg-edge-bg text-white/60"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Programme setup */}
        <div className="bg-edge-surface rounded-xl border border-white/[0.08] p-5">
          <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-bronze mb-4">Programme Setup</p>

          <div className="mb-4">
            <label className="text-edge-muted text-xs uppercase tracking-widest font-condensed block mb-1.5">Days per week</label>
            <div className="flex gap-3">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setData({ ...data, days_per_week: n })}
                  className={`flex-1 py-3 rounded-xl border font-condensed font-black text-2xl transition-all ${
                    data.days_per_week === n
                      ? "border-edge-bronze bg-edge-bronze/10 text-white"
                      : "border-white/10 bg-edge-bg text-white/40"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-edge-muted text-xs uppercase tracking-widest font-condensed block mb-1.5">Body weight (kg)</label>
            <input
              type="number"
              value={data.body_weight_kg}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 90"
              min={50}
              max={200}
              className="w-full bg-edge-bg border border-white/10 rounded-xl px-4 py-3 text-white font-body text-sm placeholder:text-edge-muted focus:outline-none focus:border-edge-bronze"
            />
          </div>

          {data.protein_target > 0 && (
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-edge-bg rounded-xl p-3 border border-edge-bronze/20">
                <p className="text-edge-muted text-xs uppercase tracking-widest font-condensed mb-1">Protein</p>
                <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 24, color: "#F2F1ED", fontWeight: 400 }}>
                  {data.protein_target}<span style={{ fontSize: 13, color: "#9BA3AF", marginLeft: 3 }}>g/day</span>
                </p>
              </div>
              <div className="flex-1 bg-edge-bg rounded-xl p-3 border border-edge-bronze/20">
                <p className="text-edge-muted text-xs uppercase tracking-widest font-condensed mb-1">Calories</p>
                <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 24, color: "#F2F1ED", fontWeight: 400 }}>
                  {data.calorie_target}<span style={{ fontSize: 13, color: "#9BA3AF", marginLeft: 3 }}>kcal</span>
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="text-edge-muted text-xs uppercase tracking-widest font-condensed block mb-1.5">Injuries / limitations</label>
            <textarea
              value={data.injuries}
              onChange={(e) => setData({ ...data, injuries: e.target.value })}
              placeholder="Lower back, knee — or leave blank"
              rows={3}
              className="w-full bg-edge-bg border border-white/10 rounded-xl px-4 py-3 text-white font-body text-sm placeholder:text-edge-muted focus:outline-none focus:border-edge-bronze resize-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-edge-gold text-sm font-body text-center">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !data.email || !data.full_name}
          className="w-full bg-edge-bronze text-edge-bg font-condensed font-bold text-lg uppercase tracking-widest py-4 rounded-xl disabled:opacity-40 active:scale-95 transition-transform"
        >
          {loading ? "Setting up..." : "Create Profile & Send Access Link"}
        </button>

        <p className="text-edge-muted text-xs text-center pb-4">
          Profile is created, approved, and a 24-hour magic link is sent immediately.
        </p>
      </div>
    </div>
  );
}
