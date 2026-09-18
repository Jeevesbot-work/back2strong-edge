"use client";

import { useState } from "react";
import Link from "next/link";

const S = { bg: "#0E1014", surface: "#171B21", card: "#13161A", border: "#252A32", bronze: "#C8965A", text: "#F2F1ED", sub: "#9BA3AF", muted: "#3D434D", green: "#34D399" };

interface AuditRow {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  created_at: string;
  data: Record<string, unknown>;
}

function fmt(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "None selected";
  return String(v);
}

// Mirrors the sections of app/audit/page.tsx so the coach sees exactly what the client submitted.
function Section({ title, rows }: { title: string; rows: [string, unknown][] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: S.bronze, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8, borderBottom: `1px solid ${S.border}`, paddingBottom: 6 }}>{title}</p>
      {rows.map(([label, val]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "5px 0" }}>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: S.sub, flexShrink: 0 }}>{label}</span>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: S.text, textAlign: "right" }}>{fmt(val)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuditCard({ r }: { r: AuditRow }) {
  const [open, setOpen] = useState(false);
  const onboarded = r.status === "onboarded";
  const d = r.data || {};
  const goal = (d.ninety_day_goal as string) || (d.age_limitations as string) || "";
  const committed = d.committed as string | undefined;

  const avgEnergyParts = ["morning_energy", "afternoon_energy", "motivation", "sleep_quality", "recovery", "stress", "libido"]
    .map((k) => Number(d[k] ?? 0));
  const avgEnergy = avgEnergyParts.some((n) => n) ? (avgEnergyParts.reduce((a, b) => a + b, 0) / 7).toFixed(1) : null;

  return (
    <div style={{ background: S.surface, border: `1px solid ${onboarded ? S.border : "rgba(200,150,90,0.3)"}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 19, color: S.text }}>{r.full_name || "Unknown"}</p>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: onboarded ? S.green : S.bronze }}>{onboarded ? "Onboarded ✓" : "New"}</span>
      </div>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: S.sub, marginBottom: 4 }}>
        {r.email || "no email"} · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        {committed ? ` · committed: ${committed}` : ""}
        {avgEnergy ? ` · energy avg: ${avgEnergy}/5` : ""}
      </p>
      {goal && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: S.text, lineHeight: 1.5, margin: "8px 0 12px" }}>&ldquo;{goal.length > 120 ? goal.slice(0, 120) + "…" : goal}&rdquo;</p>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ background: "transparent", border: `1px solid ${S.border}`, color: S.sub, borderRadius: 10, padding: "10px 16px", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          {open ? "Hide full audit ▲" : "View full audit ▾"}
        </button>
        {!onboarded && (
          <Link href={`/admin/new?audit=${r.id}`} style={{ display: "inline-block", background: S.bronze, color: "#0E1014", borderRadius: 10, padding: "10px 18px", textDecoration: "none", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Build programme →</Link>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${S.border}`, background: S.card, borderRadius: 12, padding: 16 }}>
          <Section title="Contact" rows={[
            ["Phone / WhatsApp", d.phone],
          ]} />
          <Section title="Performance snapshot" rows={[
            ["Age", d.age], ["Height", d.height], ["Weight", d.weight], ["Waist (navel)", d.waist],
            ["Resting HR", d.resting_hr], ["Avg nightly sleep", d.avg_sleep], ["Alcohol nights/week", d.alcohol_nights],
            ["Training days/week", d.training_days], ["Structured programme?", d.structured_program],
            ["Bloodwork in last 18mo?", d.bloodwork],
          ]} />
          <Section title="Functional markers" rows={[
            ["10 strict push-ups", d.pushups], ["Hang 30 seconds", d.hang],
            ["Floor without hands", d.floor], ["10,000 steps comfortably", d.steps],
          ]} />
          <Section title="Energy & recovery (1–5)" rows={[
            ["Morning energy", d.morning_energy], ["Afternoon stability", d.afternoon_energy],
            ["Motivation to train", d.motivation], ["Sleep quality", d.sleep_quality],
            ["Recovery between sessions", d.recovery], ["Stress management", d.stress], ["Libido", d.libido],
          ]} />
          <Section title="Time & priority" rows={[
            ["Screen time/day", d.screen_time], ["TV hours/week", d.tv_hours], ["Social scroll/day", d.social_scroll],
            ["Wake time", d.wake_time], ["Bed time", d.bed_time], ["Health priority (1–10)", d.health_priority],
            ["Training barriers", d.barriers],
          ]} />
          <Section title="Age narrative" rows={[
            ["Limitations blamed on age", d.age_limitations], ["Age or habit-related?", d.habit_or_age],
          ]} />
          <Section title="Commitment & projection" rows={[
            ["Ready to commit", d.committed], ["Decade projection", d.decade_projection], ["90-day goal", d.ninety_day_goal],
          ]} />
        </div>
      )}
    </div>
  );
}
