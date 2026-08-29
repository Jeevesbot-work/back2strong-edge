import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ADMINS = ["n.adams3@icloud.com", "nicosmada3@googlemail.com", "nick@back2strong.online"];

// The exact shape the Edge app renders from. The generator MUST hit this — the
// outer keys never change, only the data inside. Matches lib/supabase/migrations
// 0002 + the Train/Fuel render code.
const SCHEMA = `
{
  "programme": {
    "id": "kebab-case-id (e.g. \\"barry-strong90-w1-2\\")",
    "title": "Strong90 — Weeks 1 & 2",
    "subtitle": "Foundation · Recomp (one short line)",
    "owner": "<first name>",
    "lengthWeeks": 2,
    "summary": "2-3 sentences. Plain English. What this block is and why.",
    "considerations": ["bullet per injury/medical/life factor — be specific and safety-first"],
    "rpeNote": "RPE 7 = 3 reps left in the tank. RPE 8 = 2 reps left. We live at RPE 7–8. Never to failure.",
    "weeklySchedule": [
      { "day": "Mon", "label": "Day A — Push", "sessionKey": "day-a", "type": "lift" },
      { "day": "Tue", "label": "Rest", "sessionKey": null, "type": "rest" },
      { "day": "Wed", "label": "Day B — Pull", "sessionKey": "day-b", "type": "lift" },
      { "day": "Thu", "label": "Rest", "sessionKey": null, "type": "rest" },
      { "day": "Fri", "label": "Day C — Legs", "sessionKey": "day-c", "type": "lift" },
      { "day": "Sat", "label": "Walk / light", "sessionKey": null, "type": "cardio" },
      { "day": "Sun", "label": "Off", "sessionKey": null, "type": "rest" }
    ],
    "progression": [
      { "week": 1, "label": "Foundation", "sets": "2–3", "rpe": "7", "change": "what to do this week" },
      { "week": 2, "label": "Progressive", "sets": "3", "rpe": "7–8", "change": "what changes this week" }
    ],
    "progressionRule": "Hit the top of the rep range on all sets at RPE 7 or easier? Add a small load next session. Felt genuinely hard at the same weight? Stay there. Earn the jump.",
    "cardio": {
      "inclineWalk": { "label": "Light Walk", "days": "e.g. Saturday — optional", "setup": "one line", "byWeek": [ { "week": 1, "duration": "20 min" }, { "week": 2, "duration": "20–30 min" } ], "timingTip": "optional one line" },
      "assaultBike": { "label": "N/A — this block", "days": "Not programmed this block", "byWeek": [] }
    },
    "nutrition": {
      "headline": "1-2 sentences. Protein-first. Tie to their goal and life.",
      "targets": ["Protein: Xg / day", "Carbs: Xg / day", "Fat: Xg / day", "Calories: ~X kcal"],
      "tactics": ["Meal 1 (...): ... → ~Xg P", "Meal 2 ...", "Meal 3 ...", "Meal 4 ...", "Meal 5 (top-up) ..."],
      "proteinTarget": 190,
      "calorieTarget": 2400,
      "medicalLabel": "only if a medical flag exists, else empty string",
      "medicalNote": "only if a medical flag exists — defer all medical decisions to their clinician. Else empty string.",
      "recipes": [
        { "emoji": "🍳", "tag": "Breakfast", "name": "...", "kcal": 520, "p": 48, "time": 8, "desc": "one line", "steps": ["step", "step", "step"] }
      ]
    },
    "checkIn": {
      "frequency": "Weekly — Sunday, 5 minutes",
      "fields": ["Bodyweight (kg)", "Lifting sessions completed (of N)", "Protein target hit? Y/N", "Energy 1–10", "Sleep 1–10", "Win of the week"],
      "photoNote": "Front / side / back on Day 1 and end of block. Same light, same time, same kit."
    }
  },
  "sessions": {
    "day-a": {
      "type": "day-a",
      "name": "Day A — Monday (Push)",
      "warmup": ["5 min easy cardio", "2 light ramp-up sets of the first lift"],
      "exercises": [
        { "name": "Goblet squat", "sets": 3, "reps": "10", "rest": "90s", "notes": "coaching cue — form-first, joint-safe", "weight": "optional starting guidance" }
      ],
      "coachNote": "1-2 sentences for the session in Nick's voice."
    }
  }
}`;

const METHOD = `You are writing a bespoke training + nutrition programme in the method of Nick Adams (Back2Strong / Strong90). Nick is a former professional rugby player who rebuilt after serious back injury. His clients are men 40+ who used to be fit and have drifted — sceptical of hype, moved by being treated as serious adults.

Coaching principles you MUST follow:
- Joint-safe, intelligent strength. Progressive overload earned, never forced. We live at RPE 7–8, never grinding to failure.
- Default split is full-body or push/pull/legs across the client's available days. 3 days = A/B/C. 4 days = upper/lower or PPL+1. 2 days = two full-body sessions (day-a, day-b).
- Four movement patterns covered across the week: squat/hinge/push/pull. Spine-neutral by default; offer regressions for any back/joint history.
- Nutrition is protein-first fuelling, not dieting. Build around five hero meals. Realistic British food.
- Plain English. Direct. Warm. British. No hype, no emojis in prose, no motivational-poster lines.

Hard rules:
- Output ONLY valid JSON matching the schema. No markdown, no code fences, no commentary before or after.
- sessions keys MUST exactly match every weeklySchedule entry where type is "lift" (its sessionKey). Every lift day needs a matching session object.
- progression array length MUST equal lengthWeeks.
- Do NOT invent YouTube links. Omit the "yt" field entirely on every exercise.
- If a medical condition is given, add it to considerations, set medicalLabel/medicalNote, and never override clinical advice. If none, set medicalLabel and medicalNote to empty strings.
- Numbers (sets, kcal, p, time, proteinTarget, calorieTarget) are real numbers, not strings, where the schema shows numbers.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!(await isAuthorisedAdmin())) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured (ANTHROPIC_API_KEY missing)" }, { status: 500 });
    }

    const body = await req.json();
    const { full_name, age, goal, days_per_week, injuries, equipment, experience, dietary, medical, tweak, previous, auditContext } = body;

    let userMessage =
      `Generate a Weeks 1 & 2 starter programme (lengthWeeks: 2) for this client.\n\n` +
      `Name: ${full_name || "Client"}\n` +
      `Age: ${age || "unknown"}\n` +
      `Main goal: ${goal || "general strength and recomposition"}\n` +
      `Training days per week: ${days_per_week || 3}\n` +
      `Injuries / history: ${injuries || "none stated"}\n` +
      `Equipment available: ${equipment || "full gym"}\n` +
      `Training experience: ${experience || "returning after time off"}\n` +
      `Dietary notes / preferences: ${dietary || "none stated"}\n` +
      `Medical flags: ${medical || "none"}\n`;

    if (auditContext && typeof auditContext === "object") {
      userMessage +=
        `\nThis client completed a full Strong90 audit. Use it to make the programme genuinely personal — ` +
        `pay attention to sleep, energy, stress, alcohol, recovery and what they said about the next decade. ` +
        `Full audit answers (JSON):\n${JSON.stringify(auditContext)}\n`;
    }

    userMessage += `\nReturn the JSON now.`;

    if (tweak && previous) {
      userMessage =
        `Here is an existing programme JSON:\n${JSON.stringify(previous)}\n\n` +
        `Apply this change and return the FULL updated JSON (same schema, all keys intact): "${tweak}"\n\n` +
        `Return the JSON now.`;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: `${METHOD}\n\nThe JSON schema you must return:\n${SCHEMA}`,
      messages: [{ role: "user", content: userMessage }],
    });

    let raw = response.content[0]?.type === "text" ? response.content[0].text : "";
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    let parsed: { programme?: unknown; sessions?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[generate-programme] invalid JSON:", raw.slice(0, 500));
      return NextResponse.json({ error: "Generation came back malformed. Hit Generate again." }, { status: 422 });
    }

    if (!parsed.programme || !parsed.sessions) {
      return NextResponse.json({ error: "Generation missing programme or sessions. Try again." }, { status: 422 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[generate-programme] error:", err);
    return NextResponse.json({ error: "Internal error generating programme" }, { status: 500 });
  }
}
