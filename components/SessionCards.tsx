"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RevealGroup } from "@/components/Reveal";
import type { ProgrammeScheduleDay, ProgrammeWeek, SessionData } from "@/types";

const DAY_TO_JS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

// Monday of the current week — used as the localStorage key scope
function weekKey(): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export function markSessionDone(sessionType: string) {
  try {
    const key = `b2s-done-${weekKey()}`;
    const existing: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!existing.includes(sessionType)) {
      localStorage.setItem(key, JSON.stringify([...existing, sessionType]));
    }
  } catch { /**/ }
}

export function getLocalDoneTypes(): Set<string> {
  try {
    const key = `b2s-done-${weekKey()}`;
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch { return new Set(); }
}

interface Props {
  weeklySchedule: ProgrammeScheduleDay[];
  sessions: Record<string, SessionData>;
  supabaseDoneTypes: string[];
  currentWeek: number;
  weekInfo: ProgrammeWeek;
}

export default function SessionCards({ weeklySchedule, sessions, supabaseDoneTypes, currentWeek, weekInfo }: Props) {
  const [localDoneTypes, setLocalDoneTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalDoneTypes(getLocalDoneTypes());
  }, []);

  const todayJS = new Date().getDay();
  const supaSet = new Set(supabaseDoneTypes);
  const completedTypes = new Set([...Array.from(supaSet), ...Array.from(localDoneTypes)]);

  // Only show lift sessions that are active this week (e.g. strength from Week 3).
  const liftDays = weeklySchedule.filter((d) => d.type === "lift" && (d.fromWeek ?? 1) <= currentWeek);

  return (
    <RevealGroup style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {liftDays.map(({ day, label, sessionKey }) => {
        if (!sessionKey) return null;
        const session  = sessions[sessionKey];
        const done     = completedTypes.has(sessionKey);
        const isToday  = DAY_TO_JS[day] === todayJS;

        return (
          <Link key={sessionKey} href={`/train/${sessionKey}?week=${currentWeek}`}
            className="pressable" style={{ textDecoration: "none" }}>
            <div style={{
              background: "#171B21", borderRadius: 20, padding: "18px 20px",
              border: done ? "1px solid rgba(52,211,153,0.12)" : isToday ? "1px solid rgba(200,150,90,0.3)" : "1px solid #252A32",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              opacity: done ? 0.55 : 1, position: "relative", overflow: "hidden",
            }}>
              {isToday && !done && (
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2.5, background: "#C8965A", borderRadius: "20px 0 0 20px" }} />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: done ? "rgba(52,211,153,0.08)" : "rgba(200,150,90,0.08)",
                  border: `1px solid ${done ? "rgba(52,211,153,0.15)" : "rgba(200,150,90,0.15)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {done ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth={2.5} style={{ width: 16, height: 16 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 14, color: "#C8965A", fontWeight: 400 }}>
                      {label.split(" ")[0][0]}{label.split(" ")[1]}
                    </span>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 9, color: isToday ? "#C8965A" : "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "Inter, sans-serif", marginBottom: 3 }}>
                    {day}{isToday ? " · Today" : ""}{label !== (session?.name ?? "") ? ` · ${label}` : ""}
                  </p>
                  <h3 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 19, fontWeight: 400, color: "#F2F1ED", lineHeight: 1 }}>
                    {session?.name ?? label}
                  </h3>
                  <p style={{ fontSize: 11, color: "#9BA3AF", fontFamily: "Inter, sans-serif", marginTop: 3 }}>
                    {session?.exercises.length ?? 6} exercises{/\d/.test(weekInfo.sets) ? ` · ${weekInfo.sets} sets · RPE ${weekInfo.rpe}` : ""}
                  </p>
                </div>
              </div>
              {!done && (
                <svg viewBox="0 0 24 24" fill="none" stroke="#3D434D" strokeWidth={1.5} style={{ width: 16, height: 16, flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          </Link>
        );
      })}
    </RevealGroup>
  );
}
