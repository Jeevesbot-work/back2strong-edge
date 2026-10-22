"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calcDurationHours } from "@/lib/utils";

export default function SleepPage() {
  const router = useRouter();
  const [bedtime, setBedtime] = useState("22:30");
  const [wakeTime, setWakeTime] = useState("06:30");
  const [quality, setQuality] = useState(7);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const duration = calcDurationHours(bedtime, wakeTime);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const saved = await fetch("/api/sleep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bedtime, wake_time: wakeTime, quality, duration_hours: duration }),
    });
    setSaving(false);
    if (!saved.ok) return;
    setSaved(true);
    setTimeout(() => router.push("/progress"), 1000);
  }

  return (
    <div className="min-h-screen bg-edge-bg flex flex-col max-w-lg mx-auto px-4 pt-safe">
      <div className="py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-condensed font-black text-2xl uppercase tracking-wide">Log Sleep</h1>
      </div>

      <div className="flex-1 py-6 space-y-6">
        <div>
          <label className="text-xs uppercase tracking-widest font-condensed text-edge-muted block mb-2">Bedtime</label>
          <input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)}
            className="w-full bg-edge-surface border border-white/10 rounded-xl px-4 py-4 text-white font-condensed text-xl focus:outline-none focus:border-edge-bronze" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest font-condensed text-edge-muted block mb-2">Wake time</label>
          <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)}
            className="w-full bg-edge-surface border border-white/10 rounded-xl px-4 py-4 text-white font-condensed text-xl focus:outline-none focus:border-edge-bronze" />
        </div>

        <div className="bg-edge-surface rounded-xl p-4 border border-white/[0.08] flex justify-around">
          <div className="text-center">
            <p className="font-condensed font-black text-3xl text-white">{duration}h</p>
            <p className="text-edge-muted text-xs">Duration</p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <p className="font-condensed font-black text-3xl" style={{ color: quality >= 7 ? "#10B981" : quality >= 5 ? "#F5A623" : "#F5A623" }}>{quality}/10</p>
            <p className="text-edge-muted text-xs">Quality</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs uppercase tracking-widest font-condensed text-edge-muted">Sleep Quality</label>
            <span className="text-white font-condensed font-bold">{quality}/10</span>
          </div>
          <input type="range" min={1} max={10} value={quality} onChange={(e) => setQuality(parseInt(e.target.value))} className="w-full" />
          <div className="flex justify-between mt-1">
            <span className="text-edge-muted text-xs">Terrible</span>
            <span className="text-edge-muted text-xs">Perfect</span>
          </div>
        </div>
      </div>

      <div className="pb-safe pb-4">
        <button onClick={save} disabled={saving || saved}
          className="w-full bg-edge-bronze text-white font-condensed font-bold text-xl uppercase tracking-widest py-4 rounded-xl disabled:opacity-50 active:scale-95">
          {saved ? "Saved" : saving ? "Saving..." : "Log Sleep"}
        </button>
      </div>
    </div>
  );
}
