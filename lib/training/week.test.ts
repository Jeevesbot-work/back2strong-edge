import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSystemPrompt } from "@/lib/claude/prompts";
import type { Profile } from "@/types";
import { countCompletedSessionsThisWeek, londonWeekStart } from "./week";

// Thursday 15 Oct 2026, 08:00 Europe/London (BST, UTC+1).
const THU_15_OCT = new Date("2026-10-15T07:00:00.000Z");

const profile = {
  id: "ed",
  email: "ed@example.com",
  full_name: "Ed",
  age: 48,
  goal: null,
  training_state: null,
  injuries: null,
  days_per_week: 3,
  commitment_answer: null,
  body_weight_kg: null,
  protein_target: 160,
  calorie_target: 2200,
  approved: true,
  created_at: "",
  updated_at: "",
} as Profile;

describe("London training week", () => {
  it("starts at Monday 00:00 London, including across the BST offset", () => {
    assert.equal(londonWeekStart(THU_15_OCT).toISOString(), "2026-10-11T23:00:00.000Z");
    // Thursday 15 Jan 2026 08:00 London is GMT, so Monday is midnight UTC.
    assert.equal(londonWeekStart(new Date("2026-01-15T08:00:00.000Z")).toISOString(), "2026-01-12T00:00:00.000Z");
  });

  it("counts Mon 13 and Tue 14, not a session from the previous Friday", () => {
    const sessions = [
      { completed_at: "2026-10-09T17:00:00.000Z" }, // Fri 9 Oct 18:00 London — last week
      { completed_at: "2026-10-13T17:00:00.000Z" }, // Mon 13 Oct 18:00 London
      { completed_at: "2026-10-14T18:00:00.000Z" }, // Tue 14 Oct 19:00 London
      { completed_at: null },
    ];
    assert.equal(countCompletedSessionsThisWeek(sessions, THU_15_OCT), 2);

    // A rolling 7×24h window from Thursday morning would have included Friday.
    const rolling = sessions.filter((s) => {
      if (!s.completed_at) return false;
      return new Date(s.completed_at).getTime() > THU_15_OCT.getTime() - 7 * 24 * 60 * 60 * 1000;
    }).length;
    assert.equal(rolling, 3);
  });

  it("keeps an early Monday London session in this week, and a late Sunday in the previous one", () => {
    const earlyMonday = [{ completed_at: "2026-10-11T23:30:00.000Z" }]; // Mon 12 Oct 00:30 London
    const lateSunday = [{ completed_at: "2026-10-11T22:30:00.000Z" }]; // Sun 11 Oct 23:30 London
    assert.equal(countCompletedSessionsThisWeek(earlyMonday, THU_15_OCT), 1);
    assert.equal(countCompletedSessionsThisWeek(lateSunday, THU_15_OCT), 0);
  });
});

describe("check-in prompt", () => {
  it("tells Edge that Ed has completed two sessions, and does not say three of three", () => {
    const prompt = buildSystemPrompt({
      profile,
      programme: null,
      recentCheckIns: [],
      recentSessions: [
        { id: "a", user_id: "ed", session_type: "lower-a", session_number: 1, completed_at: "2026-10-09T17:00:00.000Z", duration_minutes: 40, notes: null, created_at: "2026-10-09T17:00:00.000Z" },
        { id: "b", user_id: "ed", session_type: "upper-a", session_number: 2, completed_at: "2026-10-13T17:00:00.000Z", duration_minutes: 42, notes: null, created_at: "2026-10-13T17:00:00.000Z" },
        { id: "c", user_id: "ed", session_type: "lower-b", session_number: 3, completed_at: "2026-10-14T18:00:00.000Z", duration_minutes: 38, notes: null, created_at: "2026-10-14T18:00:00.000Z" },
      ],
      lessonProgress: [],
      adminNotes: [],
      messageCount: 0,
    }, THU_15_OCT);

    assert.match(prompt, /Completed sessions this week: 2/);
    assert.doesNotMatch(prompt, /Sessions completed this week: \d+ of 3/);
    assert.doesNotMatch(prompt, /Completed sessions this week: 3/);
  });
});
