"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MacroBars from "@/components/fuel/MacroBars";
import type { Macros, ReportItem } from "@/lib/fuel-report";

interface Report {
  id: string;
  date: string;
  totals: Macros;
  targets: Macros;
  items: ReportItem[];
  note: string | null;
  created_at: string;
}

// Nick's latest Fuel Report (last 3 days) — pinned at the top of Fuel > Today.
// `preview`: undefined = normal client load; null/report = coach preview data.
export default function CoachFuelReport({ preview }: { preview?: unknown } = {}) {
  const [report, setReport] = useState<Report | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (preview !== undefined) { setReport((preview as Report) ?? null); return; }
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("fuel_reports")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.[0]) setReport(data[0] as Report);
    })();
  }, [preview]);

  if (!report) return null;

  const dayLabel = new Date(report.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  const dupes = (report.items ?? []).filter((i) => i.duplicate);

  return (
    <div className="anim-0 rounded-[20px] mb-6 overflow-hidden border border-edge-bronze/30" style={{ background: "linear-gradient(160deg, #1D1812 0%, #13161A 55%)" }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-4 text-left">
        <div className="w-10 h-10 rounded-full bg-edge-bronze/20 border border-edge-bronze/40 flex items-center justify-center flex-shrink-0">
          <span className="font-condensed font-black text-edge-bronze text-sm">NA</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-condensed text-[11px] uppercase tracking-[0.2em] text-edge-bronze">Coach review</p>
          <p className="font-display text-lg leading-tight text-edge-text">Your fuel, {dayLabel}</p>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-edge-secondary transition-transform ${open ? "rotate-180" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-5">
          {report.note && (
            <div className="rounded-xl bg-black/25 border border-white/[0.06] p-4">
              <p className="text-edge-text/90 text-[15px] font-body leading-relaxed whitespace-pre-line">{report.note}</p>
              <p className="text-edge-bronze font-condensed text-xs uppercase tracking-widest mt-3">Nick</p>
            </div>
          )}

          <MacroBars totals={report.totals} targets={report.targets} />

          {dupes.length > 0 && (
            <div className="rounded-xl bg-edge-red/[0.08] border border-edge-red/25 p-3">
              <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-red mb-1">Logged twice?</p>
              <p className="text-edge-text/80 text-sm font-body">
                {Array.from(new Set(dupes.map((d) => d.meal_name))).join(", ")}. If that was a double tap, delete the extra one from your log.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
