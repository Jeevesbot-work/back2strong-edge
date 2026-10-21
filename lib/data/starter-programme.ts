import type { Programme, SessionData } from "@/types";
import { STARTER_PROGRAMME_ID } from "@/lib/clients/assignment";

// Holding plan Nick can assign by hand while he writes the real one.
// Nothing in the invite flow reads this file.

const session = (
  type: string,
  name: string,
  exercises: SessionData["exercises"],
): SessionData => ({
  type,
  name,
  coachNote: "Holding session. Leave a couple of reps in the tank. Nick replaces this with your programme.",
  warmup: ["5 minutes easy walk", "10 bodyweight squats", "10 arm circles each way"],
  exercises,
});

export const STARTER_SESSIONS: Record<string, SessionData> = {
  "full-a": session("full-a", "Full body A", [
    { name: "Goblet squat", sets: 3, reps: "8", rest: "90s", notes: "Sit between your hips. A light dumbbell is enough." },
    { name: "Push-up", sets: 3, reps: "6–10", rest: "90s", notes: "Hands on a bench if the floor is too hard." },
    { name: "One-arm row", sets: 3, reps: "8 each side", rest: "90s" },
  ]),
  "full-b": session("full-b", "Full body B", [
    { name: "Hip hinge", sets: 3, reps: "8", rest: "90s", notes: "Dumbbell or kettlebell. Flat back." },
    { name: "Split squat", sets: 3, reps: "6 each side", rest: "90s", notes: "Hold a support if balance is shaky." },
    { name: "Face pull or band pull-apart", sets: 3, reps: "12", rest: "60s" },
  ]),
  "full-c": session("full-c", "Full body C", [
    { name: "Step-up", sets: 3, reps: "8 each side", rest: "90s" },
    { name: "Dumbbell press", sets: 3, reps: "8", rest: "90s", notes: "Bench or floor." },
    { name: "Dead bug", sets: 3, reps: "6 each side", rest: "60s", notes: "Lower back stays down." },
  ]),
};

export const STARTER_PROGRAMME: Programme = {
  id: STARTER_PROGRAMME_ID,
  title: "Starter foundations",
  subtitle: "Holding plan · 2 weeks",
  owner: "Starter",
  lengthWeeks: 2,
  summary: "A simple holding plan so the app is not empty. Nick replaces it with a programme written for you.",
  considerations: [
    "This is not a personalised programme.",
    "Stop any movement that hurts and tell Nick.",
  ],
  rpeNote: "Leave two reps in the tank. Nothing should grind.",
  weeklySchedule: [
    { day: "Mon", label: "Full body A", sessionKey: "full-a", type: "lift" },
    { day: "Tue", label: "Easy walk", sessionKey: null, type: "cardio" },
    { day: "Wed", label: "Full body B", sessionKey: "full-b", type: "lift" },
    { day: "Thu", label: "Easy walk", sessionKey: null, type: "cardio" },
    { day: "Fri", label: "Full body C", sessionKey: "full-c", type: "lift" },
    { day: "Sat", label: "Easy walk", sessionKey: null, type: "cardio" },
    { day: "Sun", label: "Off", sessionKey: null, type: "rest" },
  ],
  progression: [
    { week: 1, label: "Learn it", sets: "2–3", rpe: "6", change: "Learn the movements. The weight should feel easy." },
    { week: 2, label: "Repeat it", sets: "3", rpe: "7", change: "Same sessions. Add a little weight only where week 1 felt easy." },
  ],
  progressionRule: "Hit the reps with reps left in the tank? Add the smallest weight next time. Form slips? Stay put.",
  cardio: {
    inclineWalk: {
      label: "Easy walk",
      days: "Tue, Thu, Sat",
      setup: "20–30 minutes. You can talk in full sentences.",
      byWeek: [
        { week: 1, duration: "20 min" },
        { week: 2, duration: "20–30 min" },
      ],
      timingTip: "A walk after the biggest meal is enough. This is not a fitness test.",
    },
    assaultBike: {
      label: "Not in this holding plan",
      days: "Nick adds harder cardio in your real programme",
      rule: "Do not turn the walks into intervals.",
      byWeek: [
        { week: 1, format: "Walk only" },
        { week: 2, format: "Walk only" },
      ],
    },
  },
  nutrition: {
    headline: "Protein at each meal. Nick will replace these numbers with yours.",
    targets: [
      "Protein at breakfast, lunch, and dinner",
      "These targets are placeholders, not a prescription",
    ],
    tactics: [
      "Eat a proper breakfast",
      "Put protein on the plate first",
      "Tell Nick about injuries before the next session",
    ],
    proteinTarget: 160,
    calorieTarget: 2200,
    medicalLabel: "General guidance",
    medicalNote: "Holding plan only. It is not medical advice and it is not your finished programme.",
    recipes: [],
  },
  checkIn: {
    frequency: "When you train",
    fields: ["Session done", "Anything hurt", "Energy 1–5"],
    photoNote: "No photos needed on this holding plan.",
  },
};
