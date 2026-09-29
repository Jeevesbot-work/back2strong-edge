import { macroStatus, type Macros, type MacroStatus } from "@/lib/fuel-report";

const STATUS: Record<MacroStatus, { label: string; color: string }> = {
  on: { label: "On target", color: "#34D399" },
  over: { label: "Over", color: "#F5A623" },
  short: { label: "A bit short", color: "#F5A623" },
  low: { label: "Too low", color: "#E8291C" },
};

const ROWS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "calories", label: "Calories", unit: "" },
];

// Four horizontal bars — logged vs target, with the target marked as a tick.
// Bar scale runs to 130% of target so "over" is visible without blowing out.
export default function MacroBars({ totals, targets }: { totals: Macros; targets: Macros }) {
  return (
    <div className="space-y-4">
      {ROWS.map(({ key, label, unit }) => {
        const actual = Math.round(totals[key]);
        const target = Math.round(targets[key]);
        const status = macroStatus(actual, target);
        const s = STATUS[status];
        const scale = Math.max(target * 1.3, actual, 1);
        const fillPct = Math.min(100, (actual / scale) * 100);
        const tickPct = (target / scale) * 100;
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between mb-1.5">
              <div className="flex items-baseline gap-2">
                <span className="font-condensed font-bold text-sm uppercase tracking-widest text-edge-text">{label}</span>
                <span className="text-[10px] uppercase tracking-wider font-condensed px-1.5 py-0.5 rounded" style={{ color: s.color, background: `${s.color}1A` }}>
                  {s.label}
                </span>
              </div>
              <p className="font-body text-sm tabular-nums">
                <span className="text-white font-semibold">{actual.toLocaleString("en-GB")}{unit}</span>
                <span className="text-edge-secondary"> / {target.toLocaleString("en-GB")}{unit}</span>
              </p>
            </div>
            <div className="relative h-2.5 rounded-full bg-white/[0.06] overflow-visible">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${fillPct}%`, background: s.color }} />
              <div className="absolute -top-1 -bottom-1 w-[2px] rounded bg-white/70" style={{ left: `calc(${tickPct}% - 1px)` }} aria-hidden />
            </div>
          </div>
        );
      })}
      <p className="text-edge-secondary text-[11px] font-body">White line = target</p>
    </div>
  );
}
