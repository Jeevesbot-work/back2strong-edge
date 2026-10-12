import Link from "next/link";

export type ProtocolStep = { order: number; title: string; detail: string; reps?: string[]; timer_label?: string | null };
export type ProtocolNote = { label: string; detail: string };
export type Protocol = {
  slug: string; title: string; subtitle: string | null; category: string | null; intro: string | null;
  steps: ProtocolStep[]; after_notes: ProtocolNote[]; total_time_label: string | null;
};

const serif = { fontFamily: "Fraunces, Georgia, serif" };

export default function ProtocolView({ p }: { p: Protocol }) {
  const steps = [...(p.steps ?? [])].sort((a, b) => a.order - b.order);
  return (
    <div className="max-w-lg mx-auto bg-edge-bg min-h-screen px-5 pb-12" style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 16px)" }}>
      <div className="flex items-center justify-between pt-2 mb-6">
        <Link href="/home" aria-label="Back" className="w-9 h-9 rounded-full bg-[#171B21] border border-[#252A32] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        {p.total_time_label && (
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#9BA3AF] font-body border border-[#252A32] rounded-full px-3 py-1.5">{p.total_time_label}</span>
        )}
      </div>

      <p className="text-[9px] uppercase tracking-[0.25em] text-edge-bronze font-body mb-2">Protocol{p.category ? ` · ${p.category}` : ""}</p>
      <h1 className="text-[34px] text-[#F2F1ED] leading-[1.05] mb-3" style={serif}>{p.title}</h1>
      {p.subtitle && <p className="text-[15px] text-white/70 font-body leading-relaxed mb-4">{p.subtitle}</p>}
      {p.intro && (
        <div className="relative rounded-[16px] bg-[#171B21] border border-[#252A32] p-4 pl-5 mb-6 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-edge-bronze" />
          <p className="text-[13px] text-white/75 font-body leading-relaxed">{p.intro}</p>
        </div>
      )}

      <ol className="space-y-2.5 mb-8">
        {steps.map((s, i) => (
          <li key={s.order} className="rounded-[16px] bg-[#171B21] border border-[#252A32] p-4 flex gap-4">
            <span className="text-[26px] text-edge-bronze leading-none w-6 flex-shrink-0" style={serif}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <p className="font-condensed font-bold text-[17px] uppercase tracking-wide text-[#F2F1ED] leading-tight">{s.title}</p>
                {s.timer_label && <span className="text-[10px] text-[#9BA3AF] font-body whitespace-nowrap">{s.timer_label}</span>}
              </div>
              <p className="text-[13px] text-white/65 font-body leading-relaxed">{s.detail}</p>
              {!!s.reps?.length && (
                <ul className="mt-2 space-y-1">{s.reps.map((r) => <li key={r} className="text-[13px] text-[#F2F1ED] font-body">· {r}</li>)}</ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      {!!p.after_notes?.length && (
        <>
          <p className="text-[9px] uppercase tracking-[0.25em] text-[#9BA3AF] font-body mb-3">Next day</p>
          <div className="space-y-2.5">
            {p.after_notes.map((n) => (
              <div key={n.label} className="rounded-[16px] border border-edge-bronze/25 p-4" style={{ background: "linear-gradient(160deg, #1D1812 0%, #171B21 70%)" }}>
                <p className="font-condensed font-bold text-[15px] uppercase tracking-wide text-edge-bronze mb-1">{n.label}</p>
                <p className="text-[13px] text-white/70 font-body leading-relaxed">{n.detail}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
