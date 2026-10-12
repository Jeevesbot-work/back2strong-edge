import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// "Clear your head" — a member talks through what's on their mind for tomorrow
// (usually dictated by voice before bed). Edge turns it into a short to-do list.
//
// POST { text } → { tasks: string[], edge_comment }
// Saving and ticking off happen client-side straight into day_tasks (RLS own rows).

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const body = await req.json();
    const text = String(body.text ?? "").trim().slice(0, 3000);
    if (!text) return NextResponse.json({ error: "Say or type what's on your mind" }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    const prompt = `You are Edge, the coach inside a men's health app for busy men over 40 (UK). Before bed, a member has emptied his head about tomorrow, in his own words — often dictated by voice, so expect rambling, missing punctuation and speech-to-text slips.

What he said: "${text}"

Turn it into a clean to-do list for tomorrow:
- One short action per line, starting with a verb ("Call the garage about the MOT", "Book Ed's dentist appointment").
- Keep his specifics (names, times, places). Put anything with a time first, in time order.
- Merge duplicates. Drop worries that aren't actions — but if a worry implies an action, write the action.
- Maximum 10 tasks. Each under 70 characters.

Respond ONLY with JSON, no other text:
{"tasks": ["..."], "edge_comment": "One short sentence as Edge — direct, warm British male coach, no emojis, no hype. Tell him it's out of his head now and to switch off."}`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.content[0]?.type === "text" ? response.content[0].text : "";

    let parsed: { tasks?: unknown[]; edge_comment?: string };
    try {
      parsed = extractJson(raw) as typeof parsed;
    } catch {
      return NextResponse.json({ error: "Couldn't make sense of that. Try again?" }, { status: 422 });
    }

    const tasks = (parsed.tasks ?? [])
      .map((t) => String(t ?? "").trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 10);
    if (!tasks.length) return NextResponse.json({ error: "Couldn't pick out any tasks there. Try again?" }, { status: 422 });
    return NextResponse.json({ tasks, edge_comment: String(parsed.edge_comment ?? "").slice(0, 300) });
  } catch (err) {
    console.error("[tasks/parse]", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
