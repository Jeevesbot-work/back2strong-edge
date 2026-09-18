"use client";

import { useMemo, useState } from "react";
import { buildShoppingList } from "@/lib/shopping-list";
import { groupByAisle, formatForShare } from "@/lib/shopping-aisles";
import type { ShoppingListSource } from "@/lib/shopping-list";

const INK = "#12151C";
const CREAM = "#F4EEE2";
const BRASS = "#C9A24B";

interface Props {
  sources: ShoppingListSource[];
  subtitle: string;
  onBack: () => void;
}

export default function WeekShoppingList({ sources, subtitle, onBack }: Props) {
  const groups = useMemo(() => groupByAisle(buildShoppingList(sources)), [sources]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);

  const toggle = (display: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(display)) next.delete(display); else next.add(display);
      return next;
    });

  async function share() {
    const text = formatForShare(groups, checked, "This week's shop");
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Shopping list", text });
        return;
      }
    } catch {
      // user cancelled the share sheet — fall through to copy
    }
    await copy(text);
  }

  async function copy(text?: string) {
    const t = text ?? formatForShare(groups, checked, "This week's shop");
    try {
      await navigator.clipboard.writeText(t);
      setFlash("Copied — paste it anywhere");
    } catch {
      setFlash("Couldn't copy on this device");
    }
    setTimeout(() => setFlash(null), 2200);
  }

  return (
    <div className="min-h-screen bg-edge-bg max-w-lg mx-auto px-4 pt-safe pb-32">
      <div className="flex items-center gap-3 py-4 mb-4">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center flex-shrink-0" aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-semibold text-2xl leading-tight" style={{ color: CREAM }}>Shopping List</h1>
          <p className="text-edge-secondary text-xs mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-edge-surface px-5 py-8 text-center">
          <p className="text-white/70 text-sm leading-relaxed">Plan a few meals first — the list builds itself from your week.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-edge-muted text-xs">{checked.size} of {total} ticked off</p>
            {checked.size > 0 && (
              <button onClick={() => setChecked(new Set())} className="text-xs text-edge-secondary underline underline-offset-2">Clear ticks</button>
            )}
          </div>

          {groups.map((g) => (
            <section key={g.aisle} className="mb-6">
              <h2 className="font-condensed font-bold text-xs uppercase tracking-[0.18em] mb-2" style={{ color: BRASS }}>{g.aisle}</h2>
              <ul className="space-y-2">
                {g.items.map((item) => {
                  const isChecked = checked.has(item.display);
                  return (
                    <li key={item.display}>
                      <button
                        onClick={() => toggle(item.display)}
                        className="w-full flex items-start gap-3 rounded-xl px-4 py-3.5 text-left transition-colors"
                        style={{ backgroundColor: INK, border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <span
                          className="w-5 h-5 rounded-md border flex-shrink-0 mt-0.5 flex items-center justify-center"
                          style={{ borderColor: isChecked ? BRASS : "rgba(255,255,255,0.25)", backgroundColor: isChecked ? BRASS : "transparent" }}
                        >
                          {isChecked && (
                            <svg viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={3} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" /></svg>
                          )}
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm leading-snug" style={{ color: isChecked ? "#6B7280" : "rgba(255,255,255,0.9)", textDecoration: isChecked ? "line-through" : "none" }}>
                            {item.display}
                          </span>
                          <span className="block text-[11px] text-edge-muted mt-1">{item.usedIn.join(" · ")}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}

      {total > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pointer-events-none">
          <div className="max-w-lg mx-auto flex gap-2 pointer-events-auto">
            <button
              onClick={share}
              className="flex-1 py-3.5 rounded-xl font-condensed font-bold text-sm uppercase tracking-widest text-edge-bg"
              style={{ backgroundColor: BRASS }}
            >
              Share list
            </button>
            <button
              onClick={() => copy()}
              className="px-5 py-3.5 rounded-xl font-condensed font-bold text-sm uppercase tracking-widest text-white bg-edge-surface border border-white/10"
            >
              Copy
            </button>
          </div>
          {flash && <p className="text-center text-xs text-edge-secondary mt-2">{flash}</p>}
        </div>
      )}
    </div>
  );
}
