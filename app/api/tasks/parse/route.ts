import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { reportTargetDate } from "@/lib/day-dates";

// "Close the day" — before bed a member talks through anything: jobs for
// tomorrow, how today went, what's on his mind. Edge turns it into a morning
// report (to-do list, first move, worries with a fix, a look back at the day)
// and saves it for the morning. Talking again the same night adds to it.
//
// POST { text } → { report, tasks, for_date }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type MorningReport = {
  headline: string;
  first_move: string;
  on_your_mind: { worry: string; suggestion: string }[];
  wins: string[];
  day_summary: string;
  edge_note: string;
  support?: boolean;
};

function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  return JSON.parse(raw.slice(start, end + 1));
}
const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const body = await req.json();
    const said = str(body.text, 4000);
    if (!said) return NextResponse.json({ error: "Say or type what's on your mind" }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    const forDate = reportTargetDate();
    const { data: existing } = await supabase
      .from("day_reports").select("transcript").eq("user_id", user.id).eq("for_date", forDate).maybeSingle();
    const transcript = existing?.transcript ? `${existing.transcript}\n\n[Later]\n${said}` : said;

    const prompt = `You are Edge, the coach inside Back2Strong, a health app for busy men over 40 (UK). It's the end of the day. A member has talked it all out before bed so he can switch off — jobs for tomorrow, how today went, what's worrying him. It was probably dictated by voice: expect rambling, missing punctuation and speech-to-text slips.

What he said:
"""
${transcript}
"""

Build the report he'll wake up to tomorrow morning. Respond ONLY with JSON, no other text:
{
  "headline": "One line that sets up his day, under 70 characters. Plain, warm, no hype.",
  "tasks": ["Short actions for tomorrow, each starting with a verb, under 70 chars. Keep his specifics (names, times, places). Timed things first, in time order. Merge duplicates. Max 10. If a worry implies an action, include the action."],
  "first_move": "The single task to do first and why, in one short sentence.",
  "on_your_mind": [{"worry": "What's bothering him, in a few plain words", "suggestion": "One practical, doable step to deal with it or park it — specific to what he said, 1–2 sentences."}],
  "wins": ["Things that went well today, short. Include small wins. Empty list if none mentioned."],
  "day_summary": "1–2 sentences looking back at today, honest and fair.",
  "edge_note": "One or two sentences as Edge — direct, warm British male coach in his corner. No emojis, no hype, no therapy-speak."
}

Rules: max 3 items in on_your_mind; only include real concerns he raised. Don't invent things he didn't say. Never give medical diagnoses — for health worries, suggest booking the GP or raising it with his coach Nick. If he says anything suggesting he's in crisis or thinking about harming himself, add "support": true, keep the tone calm and caring, and make the edge_note gently encourage him to talk to someone today, mentioning Samaritans on 116 123 (free, 24/7).`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.content[0]?.type === "text" ? response.content[0].text : "";

    let p: Record<string, unknown>;
    try { p = extractJson(raw) as Record<string, unknown>; }
    catch { return NextResponse.json({ error: "Couldn't make sense of that. Try again?" }, { status: 422 }); }

    const tasks = (Array.isArray(p.tasks) ? p.tasks : []).map((t) => str(t, 120)).filter(Boolean).slice(0, 10);
    const report: MorningReport = {
      headline: str(p.headline, 120),
      first_move: str(p.first_move, 200),
      on_your_mind: (Array.isArray(p.on_your_mind) ? p.on_your_mind : [])
        .map((m) => ({ worry: str((m as Record<string, unknown>)?.worry, 120), suggestion: str((m as Record<string, unknown>)?.suggestion, 300) }))
        .filter((m) => m.worry && m.suggestion).slice(0, 3),
      wins: (Array.isArray(p.wins) ? p.wins : []).map((w) => str(w, 120)).filter(Boolean).slice(0, 4),
      day_summary: str(p.day_summary, 300),
      edge_note: str(p.edge_note, 400),
      ...(p.support ? { support: true } : {}),
    };
    if (!tasks.length && !report.on_your_mind.length && !report.day_summary) {
      return NextResponse.json({ error: "Couldn't pick much out of that. Try again?" }, { status: 422 });
    }

    const { error: repErr } = await supabase.from("day_reports").upsert(
      { user_id: user.id, for_date: forDate, transcript, report, updated_at: new Date().toISOString() },
      { onConflict: "user_id,for_date" },
    );
    if (repErr) return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });

    // Tomorrow's list is rebuilt from the whole night's transcript.
    await supabase.from("day_tasks").delete().eq("user_id", user.id).eq("for_date", forDate);
    const { data: saved } = tasks.length
      ? await supabase.from("day_tasks")
          .insert(tasks.map((t, i) => ({ user_id: user.id, for_date: forDate, text: t, position: i })))
          .select("id, text, done, position")
      : { data: [] };

    return NextResponse.json({ report, tasks: saved ?? [], for_date: forDate });
  } catch (err) {
    console.error("[tasks/parse]", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
