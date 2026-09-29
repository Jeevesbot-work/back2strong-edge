"use client";

import { useEffect, useState } from "react";
import MacroBars from "@/components/fuel/MacroBars";
import type { Macros, ReportItem } from "@/lib/fuel-report";

interface Day {
  firstName: string;
  items: ReportItem[];
  totals: Macros;
  targets: Macros;
  suggestedNote: string;
  lastSentAt: string | null;
}

function ukDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD
}

export default function FuelReportPanel({ userId }: { userId: string }) {
  const [date, setDate] = useState(ukDate());
  const [day, setDay] = useState<Day | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    setMsg(null);
    fetch(`/api/admin/fuel-report?userId=${userId}&date=${date}`)
      .then((r) => r.json())
      .then((d: Day) => { setDay(d); setNote(d.suggestedNote ?? ""); })
      .catch(() => setDay(null))
      .finally(() => setLoading(false));
  }, [userId, date]);

  async function send() {
    setSending(true);
    setMsg(null);
    const res = await fetch("/api/admin/fuel-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, date, note }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Failed to send" });
    setMsg({ ok: true, text: `Sent. ${day?.firstName ?? "They"} will see it at the top of their Fuel tab.` });
    setDay((d) => (d ? { ...d, lastSentAt: new Date().toISOString() } : d));
  }

  const days = [0, -1, -2, -3, -4, -5, -6].map((o) => {
    const v = ukDate(o);
    const label = o === 0 ? "Today" : o === -1 ? "Yesterday" : new Date(v + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
    return { v, label };
  });

  return (
    <div className="bg-edge-surface rounded-xl border border-white/[0.08] overflow-hidden">
      {/* Day picker */}
      <div className="flex gap-1.5 p-3 overflow-x-auto border-b border-white/[0.06]">
        {days.map((d) => (
          <button
            key={d.v}
            onClick={() => setDate(d.v)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg font-condensed text-xs uppercase tracking-wider transition-colors ${date === d.v ? "bg-edge-bronze text-white" : "bg-white/[0.04] text-edge-secondary hover:text-white"}`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {loading && <div className="p-6 flex justify-center"><div className="w-5 h-5 border-2 border-edge-bronze border-t-transparent rounded-full animate-spin" /></div>}

      {!loading && day && day.items.length === 0 && (
        <p className="text-edge-secondary text-sm font-body p-4">Nothing logged that day.</p>
      )}

      {!loading && day && day.items.length > 0 && (
        <div className="p-4 space-y-5">
          <MacroBars totals={day.totals} targets={day.targets} />

          {/* Food list */}
          <div>
            <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-secondary mb-2">What he logged ({day.items.length})</p>
            <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.06]">
              {day.items.map((i, idx) => (
                <div key={idx} className={`flex items-center gap-3 px-3 py-2 ${i.duplicate ? "bg-edge-red/[0.08]" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-body truncate">{i.meal_name}</p>
                    <p className="text-edge-secondary text-[11px] font-body tabular-nums">
                      P {Math.round(i.protein_g)}g · C {Math.round(i.carbs_g)}g · F {Math.round(i.fat_g)}g
                      {i.created_at && <> · {new Date(i.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}</>}
                    </p>
                  </div>
                  {i.duplicate && <span className="text-[9px] uppercase tracking-wider font-condensed px-1.5 py-0.5 rounded text-edge-red bg-edge-red/10 flex-shrink-0">Double tap?</span>}
                  <p className="text-white/80 text-sm font-body tabular-nums flex-shrink-0">{Math.round(i.calories)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-secondary mb-2">Your note to {day.firstName} (edit as you like)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={6}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm font-body leading-relaxed placeholder:text-white/30 focus:outline-none focus:border-edge-gold/50 resize-y"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-body">
              {msg ? <span className={msg.ok ? "text-green-400" : "text-red-400"}>{msg.text}</span>
                : day.lastSentAt ? <span className="text-edge-secondary">Last sent for this day at {new Date(day.lastSentAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}</span>
                : <span className="text-edge-secondary">Shows at the top of their Fuel tab</span>}
            </p>
            <button
              onClick={send}
              disabled={sending}
              className="flex-shrink-0 bg-edge-bronze text-white font-condensed font-bold text-sm uppercase tracking-wider px-5 py-2.5 rounded-lg active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              {sending ? "Sending..." : `Send to ${day.firstName}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
