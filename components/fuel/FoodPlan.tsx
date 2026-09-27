"use client";

import { useEffect, useState } from "react";
import type { FoodPlan as Plan } from "@/types";

// The client's written food plan: how to build the day, meal options per slot,
// a normal week, and a tickable shopping list. Data lives on the client's
// programme (nutrition.plan), so every client can have their own.

const C = { panel: "#171B21", line: "#252A32", text: "#F2F1ED", sub: "#9BA3AF", bronze: "#C8965A", bronzeHi: "#E3B887", fish: "#6FA8F5", bg: "#0E1014" };
const cond = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const eyebrow: React.CSSProperties = { fontFamily: cond, fontWeight: 600, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: C.bronze };
const card: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16 };

type View = "day" | "week" | "shop";

export default function FoodPlan({ plan, proteinTarget, calorieTarget }: { plan: Plan; proteinTarget: number; calorieTarget: number }) {
  const [view, setView] = useState<View>("day");
  const [open, setOpen] = useState<string | null>(plan.slots[0]?.slot ?? null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const key = "edge_foodplan_ticks";

  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setTicked(new Set(JSON.parse(raw))); } catch { /* storage unavailable */ }
  }, []);
  const toggle = (id: string) => setTicked((prev) => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id);
    try { localStorage.setItem(key, JSON.stringify(Array.from(n))); } catch { /* storage unavailable */ }
    return n;
  });
  const total = plan.shopping.reduce((s, a) => s + a.items.length, 0);

  return (
    <div className="pb-10">
      <h2 style={{ fontFamily: cond, fontWeight: 700, fontSize: 32, lineHeight: 1, textTransform: "uppercase", color: C.text }}>Your food plan</h2>
      <p className="text-edge-secondary text-sm mt-2 leading-relaxed">{plan.intro}</p>

      {/* Sub-nav */}
      <div className="flex gap-2 mt-4 mb-4">
        {([["day", "Your day"], ["week", "The week"], ["shop", "Shopping list"]] as [View, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ flex: 1, padding: "9px 0", borderRadius: 99, fontFamily: cond, fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase",
              background: view === v ? C.text : "transparent", color: view === v ? C.bg : C.sub, border: `1px solid ${view === v ? C.text : C.line}` }}>
            {l}
          </button>
        ))}
      </div>

      {view === "day" && (
        <div className="flex flex-col gap-3">
          <div style={card}>
            <div className="flex items-baseline justify-between">
              <p style={{ ...eyebrow, color: C.sub }}>Every day</p>
              <p style={{ fontFamily: cond, fontWeight: 700, fontSize: 20, color: C.text }}>{proteinTarget}g protein <span style={{ color: C.sub, fontSize: 14 }}>· {calorieTarget.toLocaleString("en-GB")} kcal</span></p>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {plan.split.map((s) => (
                <div key={s.slot} style={{ borderTop: `2px solid ${s.slot === "Dinner" ? C.bronze : C.line}`, paddingTop: 6 }}>
                  <p style={{ fontSize: 10, color: s.slot === "Dinner" ? C.bronzeHi : C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.slot}</p>
                  <p style={{ fontFamily: cond, fontWeight: 700, fontSize: 20, color: C.text, lineHeight: 1.1 }}>{s.protein}g</p>
                  <p style={{ fontSize: 10, color: C.sub }}>~{s.kcal} kcal</p>
                </div>
              ))}
            </div>
          </div>

          {plan.slots.map((s) => {
            const isOpen = open === s.slot;
            return (
              <div key={s.slot} style={{ ...card, padding: 0, overflow: "hidden" }}>
                <button onClick={() => setOpen(isOpen ? null : s.slot)} className="w-full flex items-center justify-between" style={{ padding: "14px 16px", background: "none", border: "none" }}>
                  <span style={{ fontFamily: cond, fontWeight: 700, fontSize: 19, textTransform: "uppercase", color: C.text }}>{s.slot}</span>
                  <span style={{ fontFamily: cond, fontWeight: 700, fontSize: 16, color: C.bronzeHi }}>~{s.protein}g <span style={{ color: C.sub, marginLeft: 6 }}>{isOpen ? "−" : "+"}</span></span>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {s.options.map((o, i) => (
                      <div key={i} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, color: C.text }}>
                          {o.name}{o.fish && <span style={{ color: C.fish, fontSize: 11, marginLeft: 6, fontWeight: 600 }}>FISH</span>}
                        </p>
                        <p style={{ fontSize: 13, color: "rgba(242,241,237,0.7)", marginTop: 3, lineHeight: 1.45 }}>{o.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {plan.rules && (
            <div style={card}>
              <p style={eyebrow}>The rules</p>
              <div className="flex flex-col gap-2.5 mt-3">
                {plan.rules.map((r) => (
                  <div key={r.title}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{r.title}</p>
                    <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.45 }}>{r.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {view === "week" && (
        <div className="flex flex-col gap-2">
          {plan.week.map((d) => (
            <div key={d.day} style={{ ...card, padding: "12px 14px", borderColor: d.training ? "rgba(200,150,90,0.35)" : C.line }}>
              <div className="flex items-baseline justify-between">
                <p style={{ fontFamily: cond, fontWeight: 700, fontSize: 18, textTransform: "uppercase", color: C.text }}>{d.day}</p>
                <p style={{ fontSize: 11, color: d.training ? C.bronzeHi : C.sub }}>{d.training ? "Training day" : "Rest day"} · carbs {d.carbs}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[["Breakfast", d.breakfast], ["Lunch", d.lunch], ["Dinner", d.dinner]].map(([k, v]) => (
                  <div key={k}>
                    <p style={{ fontSize: 10, color: C.sub, textTransform: "uppercase", letterSpacing: "0.1em" }}>{k}</p>
                    <p style={{ fontSize: 12.5, color: /tuna|mackerel|salmon|fish/i.test(v) ? C.fish : C.text, lineHeight: 1.35, marginTop: 2 }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {plan.weekNote && <p className="text-edge-secondary text-xs mt-1 leading-relaxed">{plan.weekNote}</p>}
          {plan.tip && (
            <div style={{ ...card, marginTop: 6 }}>
              <p style={eyebrow}>{plan.tip.title}</p>
              <p style={{ fontSize: 13, color: "rgba(242,241,237,0.8)", marginTop: 6, lineHeight: 1.5 }}>{plan.tip.body}</p>
            </div>
          )}
        </div>
      )}

      {view === "shop" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-edge-muted text-xs">{ticked.size} of {total} in the basket</p>
            {ticked.size > 0 && <button onClick={() => { setTicked(new Set()); try { localStorage.removeItem(key); } catch { /* ignore */ } }} className="text-xs text-edge-secondary underline">Start a new week</button>}
          </div>
          {plan.shoppingNote && <p className="text-edge-secondary text-xs leading-relaxed -mt-1">{plan.shoppingNote}</p>}
          {plan.shopping.map((a) => (
            <div key={a.aisle} style={card}>
              <p style={eyebrow}>{a.aisle}</p>
              <div className="flex flex-col mt-2">
                {a.items.map((it) => {
                  const id = `${a.aisle}|${it.name}`;
                  const on = ticked.has(id);
                  return (
                    <button key={id} onClick={() => toggle(id)} className="flex items-start gap-3 text-left" style={{ padding: "8px 0", borderTop: `1px solid ${C.line}`, background: "none", borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, border: `1.5px solid ${on ? C.bronze : "#4A515C"}`, background: on ? C.bronze : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {on && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={C.bg} strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      <span style={{ fontSize: 14, color: on ? C.sub : C.text, textDecoration: on ? "line-through" : "none" }}>
                        {it.name}{it.note && <span style={{ color: C.sub, fontSize: 12 }}> · {it.note}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {plan.supplements && (
            <div style={card}>
              <p style={eyebrow}>Supplements · as your doctor recommended</p>
              <div className="flex flex-col gap-1.5 mt-2">
                {plan.supplements.map((s) => <p key={s.name} style={{ fontSize: 13.5, color: C.text }}>{s.name} <span style={{ color: C.sub, fontSize: 12 }}>· {s.note}</span></p>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
