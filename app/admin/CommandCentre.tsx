"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const B = "#C8965A";
const BG = "#0A0A0A";
const SURFACE = "#111318";
const SURFACE2 = "#181C22";
const BORDER = "rgba(255,255,255,0.06)";
const MUTED = "#6B7280";
const TEXT = "#F2F1ED";
const fraunces = "Fraunces, Georgia, serif";
const inter = "Inter, sans-serif";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

interface EarlyWarning {
  userId: string;
  name: string;
  kind: string;
  message: string;
  severity: 1 | 2 | 3;
}

interface Props {
  active: Row[];
  earlyWarnings?: EarlyWarning[];
  pending: Row[];
  recentCheckIns: Row[];
  recentMessages: Row[];
  recentMealLogs: Row[];
  recentTrainingSessions: Row[];
  tasks: Row[];
  coachNotes: Row[];
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function daysSinceOf(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

interface BriefingItem {
  key: string;
  text: string;
  href?: string;
  tone: "urgent" | "warn" | "info";
}

// ── Daily Briefing ── the home-screen-first ranked to-do list. Reuses the
// same data the panels below already compute (quiet clients, pending
// approvals, high-priority tasks, low-readiness check-ins) but turns it into
// one short, ordered, plain-English list so the day's priorities are visible
// the instant this page opens — no scanning three columns required.
function DailyBriefing({ items }: { items: BriefingItem[] }) {
  const [open, setOpen] = useState(true);
  const toneColor = (t: BriefingItem["tone"]) => (t === "urgent" ? "#F87171" : t === "warn" ? "#FBBF24" : B);

  return (
    <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: "18px 20px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open && items.length > 0 ? 12 : 0 }}>
        <p style={{ fontFamily: fraunces, fontSize: 19, color: TEXT, fontWeight: 400 }}>
          {greetingWord()}, Nick.{" "}
          {items.length === 0 ? (
            <span style={{ color: "#34D399" }}>Nothing urgent — clear runway today.</span>
          ) : (
            <span style={{ color: MUTED, fontWeight: 400 }}>
              {items.length} thing{items.length === 1 ? "" : "s"} need{items.length === 1 ? "s" : ""} you today.
            </span>
          )}
        </p>
        {items.length > 0 && (
          <button onClick={() => setOpen((o) => !o)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: inter, fontSize: 10, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>
            {open ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {open && items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item, i) => {
            const row = (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: SURFACE2 }}>
                <span style={{ fontFamily: inter, fontSize: 11, fontWeight: 700, color: toneColor(item.tone), width: 16, flexShrink: 0 }}>{i + 1}.</span>
                <p style={{ flex: 1, fontFamily: inter, fontSize: 13, color: TEXT, lineHeight: 1.4 }}>{item.text}</p>
                {item.href && (
                  <span style={{ fontFamily: inter, fontSize: 11, color: B, fontWeight: 600, flexShrink: 0 }}>Open →</span>
                )}
              </div>
            );
            return item.href ? (
              <Link key={item.key} href={item.href} style={{ textDecoration: "none" }}>{row}</Link>
            ) : (
              <div key={item.key}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      setDate(now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toUpperCase());
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ textAlign: "right" }}>
      <p style={{ fontFamily: inter, fontSize: 18, fontWeight: 700, color: B, letterSpacing: "0.05em", lineHeight: 1 }}>{time}</p>
      <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginTop: 2 }}>{date}</p>
    </div>
  );
}

function Pill({ n, label, tone }: { n: number; label: string; tone: "good" | "warn" | "muted" }) {
  const color = tone === "warn" ? B : tone === "good" ? "#34D399" : MUTED;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: n > 0 ? color : MUTED }} />
      <span style={{ fontFamily: inter, fontSize: 10, color: n > 0 ? color : MUTED, fontWeight: 600, letterSpacing: "0.08em" }}>
        {n} {label}
      </span>
    </div>
  );
}

// Detect a narrow (phone) viewport so we can swap the 3-column desktop grid for
// a single-column, tabbed layout.
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

export default function CommandCentre({ active, earlyWarnings = [], pending, recentCheckIns, recentMessages, recentMealLogs, recentTrainingSessions, tasks: initialTasks, coachNotes }: Props) {
  const [tasks, setTasks] = useState<Row[]>(initialTasks);
  const [newTask, setNewTask] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"HIGH" | "MED" | "LOW">("MED");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"clients" | "activity" | "actions">("activity");
  const narrow = useIsNarrow();

  const clientMembers = active.filter(
    (p) => !["n.adams3@icloud.com", "nicosmada3@googlemail.com", "nick@back2strong.online"].includes(p.email)
  );

  // Live client interactions — check-ins, training, meals, messages, newest first.
  const activityItems = [
    ...recentCheckIns.map((c) => ({ type: "checkin" as const, name: c.profiles?.full_name ?? "Member", text: `Energy ${c.morning_energy}/5 · Sleep ${c.sleep_quality}/5${c.weight_kg ? ` · ${c.weight_kg}kg` : ""}${c.notes ? ` · "${c.notes}"` : ""}`, time: c.created_at })),
    ...recentTrainingSessions.map((s) => ({ type: "training" as const, name: s.profiles?.full_name ?? "Member", text: `${s.session_type ?? "Session"}${s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}`, time: s.completed_at ?? s.created_at })),
    ...recentMessages.map((m) => ({ type: "message" as const, name: m.profiles?.full_name ?? "Member", text: m.content?.slice(0, 160), time: m.created_at })),
    ...recentMealLogs.map((l) => ({ type: "meal" as const, name: l.profiles?.full_name ?? "Member", text: `${l.meal_name} · ${l.protein_g}g protein · ${l.calories} kcal`, time: l.created_at })),
  ].filter((i) => !!i.time).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 30);

  // ── Needs attention ── clients gone quiet across ALL activity (check-ins,
  // training, meals) — not check-ins alone, so a client training and eating
  // well but skipping the morning check-in doesn't get falsely flagged.
  const quietClients = clientMembers
    .map((p) => ({ p, d: daysSinceOf(p.last_seen ?? p.last_check_in) }))
    .filter(({ d }) => d === null || d >= 3)
    .sort((a, b) => (b.d ?? 999) - (a.d ?? 999));

  const lowReadiness = recentCheckIns.filter(
    (c) => (c.morning_energy && c.morning_energy <= 2) || (c.sleep_quality && c.sleep_quality <= 2)
  );

  const attentionCount = quietClients.length + lowReadiness.length;

  // ── Briefing items ── same underlying data as the panels below, ranked:
  // longest-quiet clients first, then pending sign-ups, then high-priority
  // open tasks, then low-readiness flags. Capped so the list stays a glance,
  // not another wall to read.
  const highPriorityOpenTasks = tasks.filter((t) => !t.done && (t.priority ?? "MED") === "HIGH");
  const briefingItems: BriefingItem[] = [
    ...quietClients.map(({ p, d }) => ({
      key: `q-${p.id}`,
      href: `/admin/users/${p.id}`,
      tone: "urgent" as const,
      text: d === null ? `${p.full_name ?? p.email} hasn't checked in yet — reach out.` : `${p.full_name ?? p.email} has gone quiet for ${d} days — worth a nudge.`,
    })),
    // Early-warning signals sit directly under the already-quiet clients:
    // these people are still engaged, so reaching them now is cheaper than a
    // recovery conversation later.
    ...earlyWarnings.map((w) => ({
      key: `ew-${w.userId}-${w.kind}`,
      href: `/admin/users/${w.userId}`,
      tone: (w.severity >= 3 ? "urgent" : w.severity === 2 ? "warn" : "info") as "urgent" | "warn" | "info",
      text: w.message,
    })),
    ...(pending.length > 0
      ? [{ key: "pending", tone: "warn" as const, text: `${pending.length} new sign-up${pending.length === 1 ? "" : "s"} waiting on approval.` }]
      : []),
    ...highPriorityOpenTasks.map((t) => ({ key: `task-${t.id}`, tone: "warn" as const, text: t.text })),
    ...lowReadiness.slice(0, 3).map((c, i) => ({
      key: `lr-${i}`,
      tone: "info" as const,
      text: `${c.profiles?.full_name ?? "A client"} logged low readiness — energy ${c.morning_energy}/5, sleep ${c.sleep_quality}/5.`,
    })),
  ].slice(0, 8);

  async function addTask() {
    if (!newTask.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: newTask.trim(), priority: newTaskPriority }) });
    const data = await res.json();
    if (res.ok) setTasks((t) => [data, ...t]);
    setNewTask("");
    setSaving(false);
  }

  async function toggleTask(id: string, done: boolean) {
    await fetch("/api/admin/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, done }) });
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, done } : x)));
  }

  const openTasks = tasks.filter((t) => !t.done);
  const priorityColor = (p: string) => (p === "HIGH" ? "#F87171" : p === "MED" ? B : MUTED);
  const sectionHeader = { fontFamily: inter, fontSize: 11, color: TEXT, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.2em", marginBottom: 12 };

  // ── LEFT: client roster ──────────────────────────────────────────────────
  const rosterPanel = (
    <div style={{ overflowY: "auto", padding: "16px 14px", height: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
        <div style={{ background: SURFACE2, borderRadius: 12, padding: "14px", textAlign: "center" }}>
          <p style={{ fontFamily: fraunces, fontSize: 32, color: "#34D399", fontWeight: 400, lineHeight: 1 }}>{clientMembers.length}</p>
          <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>Active</p>
        </div>
        <div style={{ background: SURFACE2, borderRadius: 12, padding: "14px", textAlign: "center" }}>
          <p style={{ fontFamily: fraunces, fontSize: 32, color: pending.length > 0 ? B : MUTED, fontWeight: 400, lineHeight: 1 }}>{pending.length}</p>
          <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>Pending</p>
        </div>
      </div>

      <p style={{ ...sectionHeader, fontSize: 10 }}>Active Members</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 18 }}>
        {clientMembers.map((p) => {
          const d = daysSinceOf(p.last_seen ?? p.last_check_in);
          const alertColor = d === null ? MUTED : d >= 3 ? "#F87171" : d >= 2 ? "#FBBF24" : "#34D399";
          const alertLabel = d === null ? "No activity yet" : d === 0 ? "Active today" : `Quiet ${d}d`;
          const stale = d !== null && d >= 3;
          return (
            <Link key={p.id} href={`/admin/users/${p.id}`} style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 12, background: stale ? "rgba(248,113,113,0.06)" : SURFACE2, border: stale ? "1px solid rgba(248,113,113,0.25)" : "1px solid transparent" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(200,150,90,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontFamily: inter, fontSize: 12, fontWeight: 700, color: B }}>{(p.full_name ?? p.email)[0].toUpperCase()}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: inter, fontSize: 13, fontWeight: 600, color: TEXT }}>{p.full_name ?? "Unnamed"}</p>
                  <p style={{ fontFamily: inter, fontSize: 11, color: alertColor, marginTop: 1 }}>{alertLabel}</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={2} style={{ width: 13, height: 13, flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>

      <Link href="/admin/new" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", borderRadius: 12, border: `1px dashed rgba(200,150,90,0.3)`, marginBottom: 6 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth={2} style={{ width: 15, height: 15 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span style={{ fontFamily: inter, fontSize: 12, color: B, fontWeight: 600 }}>Add New Client</span>
      </Link>
      <Link href="/admin/audits" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", borderRadius: 12, border: `1px dashed rgba(200,150,90,0.3)` }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth={2} style={{ width: 15, height: 15 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M3 8v8a2 2 0 002 2h14a2 2 0 002-2V8M3 8l9-4 9 4" />
        </svg>
        <span style={{ fontFamily: inter, fontSize: 12, color: B, fontWeight: 600 }}>Audit Inbox</span>
      </Link>
    </div>
  );

  // ── CENTRE: client interactions ──────────────────────────────────────────
  const interactionsPanel = (
    <div style={{ overflowY: "auto", padding: "16px 20px", height: "100%" }}>
      {/* Needs attention */}
      <div style={{ marginBottom: 26 }}>
        <p style={sectionHeader}>Needs Attention {attentionCount > 0 && <span style={{ color: B }}>· {attentionCount}</span>}</p>
        {attentionCount === 0 ? (
          <div style={{ background: SURFACE2, borderRadius: 14, border: `1px solid ${BORDER}`, padding: "18px 20px" }}>
            <p style={{ fontFamily: inter, fontSize: 13, color: "#34D399", fontWeight: 600 }}>Everyone&apos;s recently active.</p>
            <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, marginTop: 3 }}>No clients gone quiet, no low-readiness flags.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {quietClients.map(({ p, d }) => (
              <Link key={p.id} href={`/admin/users/${p.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F87171", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: inter, fontSize: 14, fontWeight: 600, color: TEXT }}>{p.full_name ?? p.email}</p>
                    <p style={{ fontFamily: inter, fontSize: 12, color: "#F87171", marginTop: 2 }}>
                      {d === null ? "Hasn't checked in yet — reach out" : `Quiet for ${d} days — worth a nudge`}
                    </p>
                  </div>
                  <span style={{ fontFamily: inter, fontSize: 11, color: B, fontWeight: 600, flexShrink: 0 }}>Open →</span>
                </div>
              </Link>
            ))}
            {lowReadiness.map((c, i) => (
              <Link key={`lr-${i}`} href="#" style={{ textDecoration: "none" }}>
                <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.22)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FBBF24", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: inter, fontSize: 14, fontWeight: 600, color: TEXT }}>{c.profiles?.full_name ?? "Member"}</p>
                    <p style={{ fontFamily: inter, fontSize: 12, color: "#FBBF24", marginTop: 2 }}>
                      Low readiness — energy {c.morning_energy}/5, sleep {c.sleep_quality}/5
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Live activity */}
      <div>
        <p style={sectionHeader}>Client Activity</p>
        {activityItems.length === 0 ? (
          <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, textAlign: "center", padding: "16px 0" }}>No recent activity.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activityItems.map((item, i) => (
              <div key={i} style={{ background: SURFACE2, borderRadius: 14, padding: "14px 16px", border: `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.type === "checkin" ? "#34D399" : item.type === "meal" ? B : item.type === "training" ? "#60A5FA" : "#818CF8", flexShrink: 0 }} />
                    <p style={{ fontFamily: inter, fontSize: 14, fontWeight: 600, color: TEXT }}>{item.name}</p>
                    <span style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 4 }}>
                      {item.type === "checkin" ? "Check-in" : item.type === "meal" ? "Meal" : item.type === "training" ? "Training" : "Message"}
                    </span>
                  </div>
                  <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, flexShrink: 0 }}>{timeAgo(item.time)}</p>
                </div>
                <p style={{ fontFamily: inter, fontSize: 13, color: "rgba(242,241,237,0.72)", lineHeight: 1.55, paddingLeft: 16 }}>{item.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── RIGHT: working tools (tasks + notes) ─────────────────────────────────
  const toolsPanel = (
    <div style={{ overflowY: "auto", padding: "16px 14px", height: "100%" }}>
      {/* Action items */}
      <div style={{ marginBottom: 26 }}>
        <p style={sectionHeader}>Action Items</p>
        <div style={{ marginBottom: 12 }}>
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add action item..."
            style={{ width: "100%", background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px", fontFamily: inter, fontSize: 13, color: TEXT, outline: "none", boxSizing: "border-box", marginBottom: 6 }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {(["HIGH", "MED", "LOW"] as const).map((p) => (
              <button key={p} onClick={() => setNewTaskPriority(p)} style={{
                flex: 1, padding: "6px 0", borderRadius: 6, border: `1px solid ${newTaskPriority === p ? priorityColor(p) : BORDER}`,
                background: newTaskPriority === p ? `${priorityColor(p)}15` : "none", cursor: "pointer",
                fontFamily: inter, fontSize: 9, fontWeight: 700, color: newTaskPriority === p ? priorityColor(p) : MUTED,
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>{p}</button>
            ))}
            <button onClick={addTask} disabled={!newTask.trim() || saving} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: newTask.trim() ? B : SURFACE2, cursor: "pointer", fontFamily: inter, fontSize: 9, fontWeight: 700, color: newTask.trim() ? BG : MUTED }}>
              ADD
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {openTasks.length === 0 && <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, textAlign: "center", padding: "8px 0" }}>No open actions.</p>}
          {openTasks.map((task) => (
            <div key={task.id} style={{ background: SURFACE2, borderRadius: 12, padding: "12px 14px", border: `1px solid ${BORDER}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontFamily: inter, fontSize: 8, fontWeight: 700, color: priorityColor(task.priority ?? "MED"), background: `${priorityColor(task.priority ?? "MED")}15`, padding: "3px 6px", borderRadius: 4, flexShrink: 0, marginTop: 1 }}>
                {task.priority ?? "MED"}
              </span>
              <p style={{ flex: 1, fontFamily: inter, fontSize: 13, color: TEXT, lineHeight: 1.45 }}>{task.text}</p>
              <button onClick={() => toggleTask(task.id, true)} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: 2 }} aria-label="Complete">
                <div style={{ width: 17, height: 17, borderRadius: 4, border: `1.5px solid rgba(200,150,90,0.4)` }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Notes from Claude */}
      <div>
        <p style={sectionHeader}>Notes from Claude</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {coachNotes.length === 0 && (
            <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, textAlign: "center", padding: "14px 0" }}>No notes yet.</p>
          )}
          {coachNotes.map((n) => (
            <div key={n.id} style={{ background: SURFACE2, borderRadius: 12, padding: "14px 16px", border: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 7, alignItems: "center" }}>
                <span style={{ fontFamily: inter, fontSize: 10, fontWeight: 700, color: B, letterSpacing: "0.1em" }}>CLAUDE</span>
                <span style={{ fontFamily: inter, fontSize: 10, color: MUTED }}>· {new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              </div>
              <p style={{ fontFamily: inter, fontSize: 13, color: "rgba(242,241,237,0.85)", lineHeight: 1.6 }}>{n.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100svh", background: BG, display: "flex", flexDirection: "column" }}>
      {/* ── Top bar ── */}
      <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: "0 16px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: B, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: fraunces, fontSize: 13, fontWeight: 700, color: BG }}>B</span>
          </div>
          <div>
            <p style={{ fontFamily: inter, fontSize: 12, fontWeight: 700, color: TEXT, letterSpacing: "0.05em" }}>Back2Strong · Edge</p>
            <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, letterSpacing: "0.15em", textTransform: "uppercase" }}>Command Centre</p>
          </div>
        </div>

        {!narrow && (
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Pill n={attentionCount} label="NEED ATTENTION" tone="warn" />
            <Pill n={pending.length} label="PENDING" tone="warn" />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/admin/jarvis" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 16, border: `1px solid rgba(200,150,90,0.35)`, background: "rgba(200,150,90,0.08)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: B, boxShadow: `0 0 6px ${B}` }} />
            <span style={{ fontFamily: inter, fontSize: 10, fontWeight: 700, color: B, letterSpacing: "0.1em" }}>JARVIS</span>
          </Link>
          <Clock />
        </div>
      </div>

      <DailyBriefing items={briefingItems} />

      {narrow ? (
        <>
          {/* ── Mobile tabs ── */}
          <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, background: SURFACE, position: "sticky", top: 52, zIndex: 40 }}>
            {([
              { k: "activity", label: "Activity", badge: attentionCount },
              { k: "clients", label: "Clients", badge: pending.length },
              { k: "actions", label: "Actions", badge: openTasks.length },
            ] as const).map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                flex: 1, background: "none", border: "none", cursor: "pointer", padding: "12px 0",
                fontFamily: inter, fontSize: 12, fontWeight: tab === t.k ? 700 : 500,
                color: tab === t.k ? B : MUTED, textTransform: "uppercase", letterSpacing: "0.1em",
                borderBottom: tab === t.k ? `2px solid ${B}` : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                {t.label}
                {t.badge > 0 && (
                  <span style={{ fontFamily: inter, fontSize: 9, fontWeight: 700, color: BG, background: B, borderRadius: 8, padding: "1px 6px" }}>{t.badge}</span>
                )}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            {tab === "clients" ? rosterPanel : tab === "activity" ? interactionsPanel : toolsPanel}
          </div>
        </>
      ) : (
        // ── Desktop 3-column layout ──
        <div style={{ display: "grid", gridTemplateColumns: "270px 1fr 360px", flex: 1, overflow: "hidden", minHeight: 0 }}>
          <div style={{ borderRight: `1px solid ${BORDER}`, minHeight: 0 }}>{rosterPanel}</div>
          <div style={{ minHeight: 0 }}>{interactionsPanel}</div>
          <div style={{ borderLeft: `1px solid ${BORDER}`, minHeight: 0 }}>{toolsPanel}</div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop: `1px solid ${BORDER}`, background: SURFACE, padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>BACK2STRONG · EDGE</p>
        <div style={{ display: "flex", gap: 16 }}>
          <a href="https://app.back2strong.online" style={{ fontFamily: inter, fontSize: 9, color: MUTED, textDecoration: "none" }}>CLIENT APP</a>
          <a href="https://back2strong.online" style={{ fontFamily: inter, fontSize: 9, color: MUTED, textDecoration: "none" }}>WEBSITE</a>
        </div>
      </div>
    </div>
  );
}
