import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";
import { detectEarlyWarnings, type ActivityStamps } from "@/lib/coach/signals";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const COACH_EMAILS = ["n.adams3@icloud.com", "nicosmada3@googlemail.com", "nick@back2strong.online"];

interface ClientRef {
  id: string;
  name: string;
}

// Builds a compact snapshot of the business right now — the same signals the
// Command Centre shows (last-seen status, early warnings, pending sign-ups,
// open tasks), condensed to plain text so Claude can answer directly.
async function buildBriefContext(): Promise<{ context: string; clients: ClientRef[] }> {
  const admin = createAdminClient();

  const [
    { data: profiles },
    { data: tasks },
    { data: checkIns },
    { data: training },
    { data: meals },
  ] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, approved, created_at").order("created_at", { ascending: false }),
    admin.from("admin_tasks").select("*").eq("done", false).order("position", { ascending: true }),
    admin.from("check_ins").select("user_id, date, weight_kg").order("date", { ascending: false }).limit(400),
    admin.from("training_sessions").select("user_id, completed_at, created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("nutrition_logs").select("user_id, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  const stampsByUser: Record<string, string[]> = {};
  const push = (userId: string, stamp?: string | null) => {
    if (stamp) (stampsByUser[userId] ??= []).push(stamp);
  };
  for (const c of checkIns ?? []) push(c.user_id, c.date);
  for (const s of training ?? []) push(s.user_id, s.completed_at ?? s.created_at);
  for (const m of meals ?? []) push(m.user_id, m.created_at);

  const weightsByUser: Record<string, { date: string; kg: number }[]> = {};
  for (const c of [...(checkIns ?? [])].reverse()) {
    if (typeof c.weight_kg === "number" && c.date) (weightsByUser[c.user_id] ??= []).push({ date: c.date, kg: c.weight_kg });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRows = (profiles ?? []).filter((p: any) => p.approved && !COACH_EMAILS.includes(p.email));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingRows = (profiles ?? []).filter((p: any) => !p.approved);

  const clients: ClientRef[] = clientRows.map((p) => ({ id: p.id, name: p.full_name ?? p.email }));

  const signalInput: ActivityStamps[] = clientRows.map((p) => ({
    userId: p.id,
    name: p.full_name ?? p.email,
    stamps: stampsByUser[p.id] ?? [],
    weights: weightsByUser[p.id] ?? [],
  }));
  const warnings = detectEarlyWarnings(signalInput);

  const clientLines = clientRows.map((p) => {
    const stamps = stampsByUser[p.id] ?? [];
    const days = stamps.length ? Math.min(...stamps.map((s) => Math.floor((Date.now() - new Date(s).getTime()) / 86400000))) : null;
    const status = days === null ? "no activity logged yet" : days === 0 ? "active today" : `last active ${days} day(s) ago`;
    return `- ${p.full_name ?? p.email} (id: ${p.id}): ${status}`;
  });

  const context = [
    `CLIENTS (${clientRows.length} active):`,
    clientLines.length ? clientLines.join("\n") : "- none",
    "",
    `EARLY WARNINGS (clients drifting but not yet gone quiet):`,
    warnings.length ? warnings.map((w) => `- ${w.message}`).join("\n") : "- none",
    "",
    `PENDING SIGN-UPS (${pendingRows.length}):`,
    pendingRows.length ? pendingRows.map((p) => `- ${p.full_name ?? p.email} (id: ${p.id})`).join("\n") : "- none",
    "",
    `OPEN TASKS (${(tasks ?? []).length}):`,
    (tasks ?? []).length ? (tasks ?? []).map((t) => `- [${t.priority ?? "MED"}] ${t.text}`).join("\n") : "- none",
  ].join("\n");

  return { context, clients };
}

// Actions Jarvis may PROPOSE. Nothing here executes server-side from this
// route — the proposal is returned to the browser, shown to Nick as a draft,
// and only fires against the real endpoint after he taps confirm. Anything
// that reaches a client must be seen before it's sent.
const tools: Anthropic.Tool[] = [
  {
    name: "draft_client_message",
    description:
      "Draft a message to send to a client in their Edge chat. Use when Nick asks to message, nudge, check in on, or reach out to someone. This only DRAFTS — Nick reviews and confirms before it sends.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "The client's id, exactly as given in the snapshot." },
        client_name: { type: "string", description: "The client's display name." },
        message: {
          type: "string",
          description:
            "The message body, written in Nick's voice: plain English, direct, British, warm, no hype, no emojis. Short — 1-3 sentences. Reference the specific reason for reaching out.",
        },
      },
      required: ["client_id", "client_name", "message"],
    },
  },
  {
    name: "draft_task",
    description: "Add an item to Nick's own action list. Use when he asks to remind himself, note something down, or add a to-do.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The task, phrased as an action." },
        priority: { type: "string", enum: ["HIGH", "MED", "LOW"] },
      },
      required: ["text"],
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthorisedAdmin())) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured (ANTHROPIC_API_KEY missing)" }, { status: 500 });
    }

    const { question } = await req.json();
    if (!question?.trim()) return NextResponse.json({ error: "No question" }, { status: 400 });

    const { context } = await buildBriefContext();

    const systemPrompt = `You are Jarvis — the voice-driven operations assistant inside Nick Adams's Back2Strong coach Command Centre. You are speaking OUT LOUD to Nick via text-to-speech, so: no markdown, no bullet symbols, no headers, no numbered lists — just plain spoken sentences. Keep it short: 2-4 sentences unless he explicitly asks for a full run-through. Plain English, direct, British, warm but efficient — a trusted right hand, not a hype machine. No emojis.

Nick coaches men aged 40-55. His priority is that each client feels individually noticed even as the roster grows, and that he starts each day knowing what actually needs him.

When he asks a question, answer it from the snapshot below. Lead with the name that matters most. If the snapshot doesn't answer it, say so plainly rather than guessing.

When he asks you to DO something — message a client, nudge someone, remind him of something — call the matching tool to draft it. Say out loud that you've drafted it and briefly what it says. Never claim something has been sent: Nick reviews and confirms every message before it reaches a client.

Here is the current snapshot of the business:

${context}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system: systemPrompt,
      tools,
      messages: [{ role: "user", content: question }],
    });

    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    let proposal: Record<string, unknown> | null = null;
    if (toolUse) {
      const input = toolUse.input as Record<string, unknown>;
      if (toolUse.name === "draft_client_message") {
        proposal = {
          type: "client_message",
          clientId: input.client_id,
          clientName: input.client_name,
          message: input.message,
          // Human-readable summary of exactly what confirming will do.
          summary: `Send this message to ${input.client_name} in their Edge chat.`,
        };
      } else if (toolUse.name === "draft_task") {
        proposal = {
          type: "task",
          text: input.text,
          priority: (input.priority as string) ?? "MED",
          summary: `Add "${input.text}" to your action list.`,
        };
      }
    }

    return NextResponse.json({
      answer: answer || (proposal ? "I've drafted that for you — have a look before it goes." : "I didn't catch that."),
      proposal,
    });
  } catch (err) {
    console.error("[admin/jarvis] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
