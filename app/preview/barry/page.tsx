"use client";

import { useState } from "react";
import { BARRY_PROGRAMME } from "@/lib/data/barry-programme";
import { RECIPES } from "@/lib/recipes";

const B = "#C8965A";
const BG = "#0E1014";
const SURFACE = "#171B21";
const BORDER = "#252A32";
const MUTED = "#9BA3AF";
const TEXT = "#F2F1ED";

const fraunces = "Fraunces, Georgia, serif";
const inter = "Inter, sans-serif";

type Screen = "train" | "fuel" | "checkin" | "edge";

export default function BarryPreview() {
  const [screen, setScreen] = useState<Screen>("train");
  const [fuelTab, setFuelTab] = useState<"today" | "cookbook" | "road">("today");

  const prog = BARRY_PROGRAMME;
  const currentWeek = 1;
  const weekInfo = prog.progression[0];

  return (
    <div style={{ minHeight: "100svh", background: "#0A0A0A", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px 40px" }}>

      {/* Admin header */}
      <div style={{ width: "100%", maxWidth: 420, marginBottom: 20 }}>
        <div style={{ background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.3)", borderRadius: 14, padding: "14px 18px" }}>
          <p style={{ fontFamily: inter, fontSize: 11, color: B, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>
            PREVIEW — Barry's view
          </p>
          <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
            This is exactly what Barry sees when he logs in. Tap the tabs below to explore each section.
          </p>
        </div>
      </div>

      {/* Phone frame */}
      <div style={{
        width: "100%", maxWidth: 390,
        background: BG,
        borderRadius: 44,
        border: "8px solid #1C1C1E",
        boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px #2C2C2E",
        overflow: "hidden",
        minHeight: 780,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}>

        {/* Status bar */}
        <div style={{ background: BG, padding: "14px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: inter, fontSize: 15, fontWeight: 600, color: TEXT }}>9:41</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <svg width="17" height="12" viewBox="0 0 17 12" fill={TEXT}><rect x="0" y="3" width="3" height="9" rx="1"/><rect x="4.5" y="2" width="3" height="10" rx="1"/><rect x="9" y="0" width="3" height="12" rx="1"/><rect x="13.5" y="0" width="3" height="12" rx="1" opacity="0.3"/></svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill={TEXT}><path d="M8 2.4C5.2 2.4 2.7 3.6 1 5.5L0 4.4C2 2.2 4.8.8 8 .8s6 1.4 8 3.6l-1 1.1C13.3 3.6 10.8 2.4 8 2.4z"/><path d="M8 5.6C6.2 5.6 4.6 6.4 3.4 7.7L2.4 6.6C3.8 5 5.8 4 8 4s4.2 1 5.6 2.6l-1 1.1C11.4 6.4 9.8 5.6 8 5.6z"/><circle cx="8" cy="10" r="1.5"/></svg>
            <div style={{ width: 25, height: 12, border: `1.5px solid ${TEXT}`, borderRadius: 4, padding: 1.5, display: "flex", alignItems: "center" }}>
              <div style={{ width: "75%", height: "100%", background: TEXT, borderRadius: 2 }}/>
            </div>
          </div>
        </div>

        {/* Screen content */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>
          {screen === "train" && <TrainScreen prog={prog} currentWeek={currentWeek} weekInfo={weekInfo} />}
          {screen === "fuel" && <FuelScreen tab={fuelTab} setTab={setFuelTab} />}
          {screen === "checkin" && <CheckInScreen />}
          {screen === "edge" && <EdgeScreen />}
        </div>

        {/* Bottom nav */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(14,16,20,0.95)",
          borderTop: `1px solid ${BORDER}`,
          display: "flex",
          paddingBottom: 20,
          paddingTop: 10,
        }}>
          {([
            { key: "train", label: "Train", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
            { key: "fuel", label: "Fuel", icon: "M9 3H5a2 2 0 00-2 2v4m6-6h4a2 2 0 012 2v4M9 3v18m0 0h6a2 2 0 002-2v-4M9 21H3a2 2 0 01-2-2v-4m0 0h18" },
            { key: "checkin", label: "Check-in", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
            { key: "edge", label: "Edge", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
          ] as const).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setScreen(key as Screen)}
              style={{
                flex: 1, background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke={screen === key ? B : MUTED} strokeWidth={1.8}
                style={{ width: 22, height: 22 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              <span style={{ fontFamily: inter, fontSize: 10, color: screen === key ? B : MUTED, fontWeight: screen === key ? 600 : 400 }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ maxWidth: 390, width: "100%", marginTop: 20 }}>
        <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 1.6 }}>
          Tap each tab above to preview Train, Fuel, Check-in, and Edge chat sections.
          <br />This page is only visible to you — Barry cannot access it.
        </p>
      </div>
    </div>
  );
}

function TrainScreen({ prog, currentWeek, weekInfo }: { prog: typeof BARRY_PROGRAMME; currentWeek: number; weekInfo: typeof BARRY_PROGRAMME.progression[0] }) {
  const today = new Date().getDay(); // 0=Sun
  const DAY_JS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return (
    <div style={{ padding: "16px 20px" }}>
      <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 4 }}>
        0 of 0 sessions this week
      </p>
      <h1 style={{ fontFamily: fraunces, fontSize: 36, fontWeight: 400, color: TEXT, lineHeight: 1, marginBottom: 4 }}>
        Train.
      </h1>
      <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, marginBottom: 12 }}>
        {prog.title} · {prog.subtitle}
      </p>

      {/* Week progress */}
      <div style={{ display: "flex", gap: 5, marginBottom: 20 }}>
        {[1,2,3,4].map((w) => (
          <div key={w} style={{ flex: 1, height: 2, borderRadius: 99, background: w <= currentWeek ? B : BORDER, opacity: w === currentWeek ? 1 : 0.5 }} />
        ))}
      </div>

      {/* Current week card */}
      <div style={{ background: SURFACE, borderRadius: 20, border: `1px solid rgba(200,150,90,0.2)`, padding: 20, marginBottom: 14 }}>
        <p style={{ fontFamily: inter, fontSize: 9, color: B, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 4 }}>
          Week {currentWeek} of {prog.lengthWeeks}
        </p>
        <h2 style={{ fontFamily: fraunces, fontSize: 26, fontWeight: 400, color: TEXT, lineHeight: 1, marginBottom: 10 }}>
          {weekInfo.label}
        </h2>
        <p style={{ fontFamily: inter, fontSize: 13, color: "rgba(242,241,237,0.6)", lineHeight: 1.5, marginBottom: 14 }}>
          {weekInfo.change}
        </p>
        <div style={{ borderTop: `1px solid rgba(255,255,255,0.05)`, paddingTop: 12 }}>
          <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
            <span style={{ color: "rgba(242,241,237,0.45)" }}>Rule: </span>{prog.progressionRule}
          </p>
        </div>
      </div>

      {/* Weekly schedule */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {prog.weeklySchedule.map(({ day, type }) => {
          const isToday = DAY_JS[day] === today;
          return (
            <div key={day} style={{
              flex: 1, textAlign: "center",
              background: isToday && type === "cardio" ? "rgba(96,165,250,0.2)" : type === "rest" ? "#0E1014" : SURFACE,
              borderRadius: 10, padding: "8px 2px", border: `1px solid ${BORDER}`,
            }}>
              <p style={{ fontFamily: inter, fontSize: 9, fontWeight: 700, color: isToday ? B : type === "rest" ? BORDER : "#3D434D", letterSpacing: "0.06em" }}>
                {day}
              </p>
            </div>
          );
        })}
      </div>

      {/* Cardio cards — skipped when a block is absent so a partial programme cannot crash the preview */}
      <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 12 }}>Cardio</p>

      {prog.cardio?.inclineWalk && (
      <div style={{ background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: "18px 20px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>🚶</span>
          <div>
            <p style={{ fontFamily: fraunces, fontSize: 17, color: TEXT, fontWeight: 400 }}>{prog.cardio.inclineWalk.label}</p>
            <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, marginTop: 2 }}>{prog.cardio.inclineWalk.days}</p>
          </div>
        </div>
        <p style={{ fontFamily: inter, fontSize: 12, color: "rgba(242,241,237,0.6)", marginBottom: 10, lineHeight: 1.5 }}>{prog.cardio.inclineWalk.setup}</p>
        <div style={{ display: "flex", gap: 8 }}>
          {(prog.cardio.inclineWalk.byWeek ?? []).map(({ week, duration }) => (
            <div key={week} style={{
              flex: 1, textAlign: "center", padding: "8px 4px",
              background: week === currentWeek ? "rgba(200,150,90,0.1)" : BORDER,
              border: `1px solid ${week === currentWeek ? "rgba(200,150,90,0.3)" : "transparent"}`,
              borderRadius: 10,
            }}>
              <p style={{ fontFamily: inter, fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Wk {week}</p>
              <p style={{ fontFamily: inter, fontSize: 11, color: week === currentWeek ? B : MUTED, fontWeight: week === currentWeek ? 600 : 400 }}>{duration}</p>
            </div>
          ))}
        </div>
      </div>
      )}

      {prog.cardio?.assaultBike && (
      <div style={{ background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>🌙</span>
          <div>
            <p style={{ fontFamily: fraunces, fontSize: 17, color: TEXT, fontWeight: 400 }}>{prog.cardio.assaultBike.label}</p>
            <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, marginTop: 2 }}>{prog.cardio.assaultBike.days}</p>
          </div>
        </div>
        <div style={{ background: "rgba(200,150,90,0.06)", border: "1px solid rgba(200,150,90,0.2)", borderRadius: 10, padding: "8px 12px" }}>
          <p style={{ fontFamily: inter, fontSize: 11, color: "rgba(200,150,90,0.8)" }}>{prog.cardio.assaultBike.rule}</p>
        </div>
      </div>
      )}

      {/* Nutrition */}
      <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 12 }}>Nutrition</p>
      <div style={{ background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 20 }}>
        <p style={{ fontFamily: fraunces, fontSize: 16, color: TEXT, fontWeight: 400, lineHeight: 1.45, marginBottom: 14 }}>{prog.nutrition.headline}</p>
        <p style={{ fontFamily: inter, fontSize: 9, color: B, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>Targets</p>
        {prog.nutrition.targets.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: B, flexShrink: 0, marginTop: 5 }} />
            <p style={{ fontFamily: inter, fontSize: 13, color: "rgba(242,241,237,0.75)", lineHeight: 1.4 }}>{t}</p>
          </div>
        ))}
        <p style={{ fontFamily: inter, fontSize: 9, color: B, textTransform: "uppercase", letterSpacing: "0.15em", margin: "14px 0 8px" }}>Tactics</p>
        {prog.nutrition.tactics.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
            <span style={{ fontFamily: inter, fontSize: 11, color: B, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
            <p style={{ fontFamily: inter, fontSize: 13, color: "rgba(242,241,237,0.75)", lineHeight: 1.4 }}>{t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FuelScreen({ tab, setTab }: { tab: "today" | "cookbook" | "road"; setTab: (t: "today" | "cookbook" | "road") => void }) {
  const totalProtein = 0;
  const totalCalories = 0;

  return (
    <div style={{ padding: "16px 20px" }}>
      <h1 style={{ fontFamily: fraunces, fontSize: 36, fontWeight: 400, color: TEXT, lineHeight: 1, marginBottom: 16 }}>Fuel.</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, background: SURFACE, padding: 4, borderRadius: 14 }}>
        {(["today", "cookbook", "road"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 10, border: "none", cursor: "pointer",
            background: tab === t ? B : "transparent",
            fontFamily: inter, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
            color: tab === t ? BG : MUTED,
          }}>
            {t === "today" ? "Today" : t === "cookbook" ? "Cookbook" : "On the Road"}
          </button>
        ))}
      </div>

      {tab === "today" && (
        <div>
          {/* Macro summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Protein", value: `${totalProtein}g`, target: "200g target", pct: totalProtein / 200 },
              { label: "Calories", value: `${totalCalories}`, target: "2,200 target", pct: totalCalories / 2200 },
            ].map(({ label, value, target, pct }) => (
              <div key={label} style={{ background: SURFACE, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
                <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6 }}>{label}</p>
                <p style={{ fontFamily: fraunces, fontSize: 28, color: B, fontWeight: 400, lineHeight: 1 }}>{value}</p>
                <p style={{ fontFamily: inter, fontSize: 10, color: MUTED, marginTop: 4 }}>{target}</p>
                <div style={{ marginTop: 8, height: 3, background: BORDER, borderRadius: 99 }}>
                  <div style={{ width: `${Math.min(100, pct * 100)}%`, height: "100%", background: B, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Snap button */}
          <div style={{ background: SURFACE, borderRadius: 20, border: `1px solid rgba(200,150,90,0.2)`, padding: 24, textAlign: "center", marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(200,150,90,0.1)", border: `1px solid rgba(200,150,90,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth={1.5} style={{ width: 24, height: 24 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
            <p style={{ fontFamily: fraunces, fontSize: 20, color: TEXT, fontWeight: 400, marginBottom: 6 }}>Snap Your Meal</p>
            <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
              Take a photo — Edge analyses the calories<br />and protein instantly
            </p>
          </div>

          <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 20, textAlign: "center" }}>
            <p style={{ fontFamily: inter, fontSize: 13, color: MUTED }}>No meals logged yet today.</p>
            <p style={{ fontFamily: inter, fontSize: 12, color: "rgba(155,163,175,0.6)", marginTop: 4 }}>Snap a photo above to get started.</p>
          </div>
        </div>
      )}

      {tab === "cookbook" && (
        <div>
          <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 16 }}>
            {RECIPES.length} high-protein recipes
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {RECIPES.map((r) => (
              <div key={r.id} style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: fraunces, fontSize: 17, color: TEXT, fontWeight: 400, lineHeight: 1.2, marginBottom: 4 }}>{r.title}</p>
                    <p style={{ fontFamily: inter, fontSize: 11, color: MUTED }}>Serves {r.serves} · {r.section}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    <p style={{ fontFamily: fraunces, fontSize: 20, color: B, fontWeight: 400 }}>{r.macros_per_serving.protein_g}g</p>
                    <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em" }}>protein</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "road" && (
        <div>
          <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 4 }}>Field guide</p>
          <h2 style={{ fontFamily: fraunces, fontSize: 22, color: TEXT, fontWeight: 400, marginBottom: 4 }}>Fuel On The Road</h2>
          <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 20 }}>
            Eating away from home doesn't mean falling off. Use this guide to stay on target anywhere.
          </p>

          {[
            { label: "Green — Go", color: "#34D399", bg: "rgba(52,211,153,0.06)", border: "rgba(52,211,153,0.2)", items: ["Grilled chicken breast / steak", "Eggs any style", "Greek yoghurt (plain)", "Cottage cheese", "Protein shake", "Smoked salmon", "Tuna / sardines"] },
            { label: "Amber — Once a day max", color: "#F59E0B", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.2)", items: ["Rice / jacket potato", "Wholegrain bread (1–2 slices)", "Pasta (small portion)", "Banana / apple", "Nuts (small handful)", "Protein bar"] },
            { label: "Red — Avoid", color: "#F87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.2)", items: ["Pastries / croissants", "Crisps / chocolate", "Fizzy drinks / juice", "Fast food burgers", "Alcohol (save for target units)", "White bread / chips"] },
          ].map(({ label, color, bg, border, items }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 12 }}>
              <p style={{ fontFamily: inter, fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 10 }}>{label}</p>
              {items.map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <p style={{ fontFamily: inter, fontSize: 13, color: "rgba(242,241,237,0.8)" }}>{item}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckInScreen() {
  const fields = [
    "Morning walk — done Y/N + minutes",
    "Evening walk — done Y/N",
    "Morning weight (post-toilet, before food)",
    "In bed by 10pm last night Y/N",
    "Sleep quality 1–5",
    "Alcohol units today",
    "Energy on waking 1–5",
    "One line — how did today go?",
  ];

  return (
    <div style={{ padding: "16px 20px" }}>
      <h1 style={{ fontFamily: fraunces, fontSize: 36, fontWeight: 400, color: TEXT, lineHeight: 1, marginBottom: 6 }}>Check In.</h1>
      <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, marginBottom: 24 }}>Daily — 2 minutes each morning</p>

      <div style={{ background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 }}>
        <p style={{ fontFamily: inter, fontSize: 9, color: B, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 14 }}>Today's check-in</p>
        {fields.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid #3D434D`, flexShrink: 0 }} />
            <p style={{ fontFamily: inter, fontSize: 13, color: "rgba(242,241,237,0.75)" }}>{f}</p>
          </div>
        ))}
        <button style={{
          width: "100%", background: B, color: BG, border: "none", borderRadius: 14,
          padding: "14px", fontFamily: inter, fontSize: 13, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.15em", cursor: "pointer", marginTop: 6,
        }}>
          Submit Check-in
        </button>
      </div>

      <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 16 }}>
        <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 10 }}>Recent</p>
        <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, textAlign: "center", padding: "10px 0" }}>No check-ins logged yet.</p>
      </div>
    </div>
  );
}

function EdgeScreen() {
  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", height: "100%" }}>
      <h1 style={{ fontFamily: fraunces, fontSize: 36, fontWeight: 400, color: TEXT, lineHeight: 1, marginBottom: 6 }}>Edge.</h1>
      <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, marginBottom: 24 }}>Your AI coaching assistant</p>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: SURFACE, borderRadius: 20, padding: "16px 18px", border: `1px solid rgba(200,150,90,0.15)` }}>
          <p style={{ fontFamily: inter, fontSize: 9, color: B, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6 }}>Edge</p>
          <p style={{ fontFamily: inter, fontSize: 14, color: TEXT, lineHeight: 1.6 }}>
            Morning Barry. How are you feeling today? Have you done your walk yet?
          </p>
        </div>
        <div style={{ background: "rgba(200,150,90,0.08)", borderRadius: 20, padding: "16px 18px", border: `1px solid rgba(200,150,90,0.15)`, alignSelf: "flex-end", maxWidth: "80%" }}>
          <p style={{ fontFamily: inter, fontSize: 9, color: B, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6 }}>Barry</p>
          <p style={{ fontFamily: inter, fontSize: 14, color: TEXT, lineHeight: 1.6 }}>Just got back. 32 minutes on the treadmill.</p>
        </div>
        <div style={{ background: SURFACE, borderRadius: 20, padding: "16px 18px", border: `1px solid rgba(200,150,90,0.15)` }}>
          <p style={{ fontFamily: inter, fontSize: 9, color: B, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6 }}>Edge</p>
          <p style={{ fontFamily: inter, fontSize: 14, color: TEXT, lineHeight: 1.6 }}>
            That's the habit being built. 32 minutes fasted — job done. Log your weight and breakfast and we'll keep the momentum going.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "12px 16px" }}>
          <p style={{ fontFamily: inter, fontSize: 14, color: MUTED }}>Message Edge...</p>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: B, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={BG} strokeWidth={2} style={{ width: 18, height: 18 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
