import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const COACH_EMAILS = ["n.adams3@icloud.com", "nicosmada3@googlemail.com", "nick@back2strong.online"];

// Builds a compact snapshot of the business right now — same underlying
// signals as the Command Centre's "Needs Attention" panel and Daily
// Briefing, condensed into plain text so Claude can answer questions about
// it directly instead of Nick reading tables himself.
async function buildBriefContext() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();

  const [
    { data: profiles },
    { data: tasks },
    { data: lastCheckIns },
    { data: lastTraining },
    { data: lastMeals },
  ] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, approved, created_at").order("created_at", { ascending: false }),
    admin.from("admin_tasks").select("*").eq("done", false).order("position", { ascending: true }),
    admin.from("check_ins").select("user_id, date").order("date", { ascending: false }).limit(200),
    admin.from("training_sessions").select("user_id, completed_at, created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("nutrition_logs").select("user_id, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  const lastSeenMap: Record<string, string> = {};
  const feed = (rows: { user_id: string; date?: string; completed_at?: string; created_at?: string }[] | null) => {
    for (const r of rows ?? []) {
      const stamp = r.date ?? r.completed_at ?? r.created_at;
      if (stamp && (!lastSeenMap[r.user_id] || new Date(stamp) > new Date(lastSeenMap[r.user_id]))) {
        lastSeenMap[r.user_id] = stamp;
      }
    }
  };
  feed(lastCheckIns);
  feed(lastTraining);
  feed(lastMeals);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clients = (profiles ?? []).filter((p: any) => p.approved && !COACH_EMAILS.includes(p.email));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending = (profiles ?? []).filter((p: any) => !p.approved);

  const clientLines = clients.map((p) => {
    const seen = lastSeenMap[p.id];
    const days = seen ? Math.floor((Date.now() - new Date(seen).getTime()) / 86400000) : null;
    const status = days === null ? "no activity logged yet" : days === 0 ? "active today" : `quiet ${days} day(s)`;
    return `- ${p.full_name ?? p.email}: ${status}`;
  });

  const taskLines = (tasks ?? []).map((t) => `- [${t.priority ?? "MED"}] ${t.text}`);
  const pendingLines = pending.map((p) => `- ${p.full_name ?? p.email} (sign-up awaiting approval)`);

  return [
    `CLIENTS (${clients.length} active):`,
    clientLines.length ? clientLines.join("\n") : "- none",
    "",
    `PENDING SIGN-UPS (${pending.length}):`,
    pendingLines.length ? pendingLines.join("\n") : "- none",
    "",
    `OPEN TASKS (${(tasks ?? []).length}):`,
    taskLines.length ? taskLines.join("\n") : "- none",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured (ANTHROPIC_API_KEY missing)" }, { status: 500 });
    }

    const { question } = await req.json();
    if (!question?.trim()) return NextResponse.json({ error: "No question" }, { status: 400 });

    const context = await buildBriefContext();

    const systemPrompt = `You are Jarvis — the voice-driven operations assistant inside Nick Adams's Back2Strong coach Command Centre. You are speaking OUT LOUD to Nick via text-to-speech, so: no markdown, no bullet symbols, no headers — just plain spoken sentences. Keep answers short (2-4 sentences unless he asks for a full list). Plain English, direct, British, warm but efficient — a trusted right hand, not a hype machine. If asked who needs attention, lead with the most urgent person by name. If the data doesn't answer the question, say so plainly rather than guessing.

Here is the current snapshot of the business:

${context}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    });

    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ answer });
  } catch (err) {
    console.error("[admin/jarvis] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
