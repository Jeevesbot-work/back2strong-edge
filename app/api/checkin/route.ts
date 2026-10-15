import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/claude/prompts";
import { requireActiveClient } from "@/lib/ai/access";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const access = await requireActiveClient();
  if (!access.ok) return access.response;
  const { supabase, userId } = access;

  const body = await req.json();
  const { sleep_quality, morning_energy, stress_level, soreness, motivation, notes, weight_kg } = body;
  const today = new Date().toISOString().split("T")[0];

  const avg = (sleep_quality + morning_energy + (6 - stress_level) + (6 - soreness) + motivation) / 5;
  const prompt = `Generate a 1-2 sentence response to this man's morning check-in in Edge's voice. Direct, warm, no corporate language.

Scores: Sleep ${sleep_quality}/5, Energy ${morning_energy}/5, Stress ${stress_level}/5 (5=low), Soreness ${soreness}/5, Motivation ${motivation}/5. Average wellness: ${avg.toFixed(1)}/5.
${notes ? `Notes from him: "${notes}"` : ""}

${avg < 2.5 ? "Scores are low. Modify today's session if needed. Be direct about what you see." : avg > 4 ? "Strong scores. Push the intensity today. Acknowledge it." : "Solid. Keep it moving."}

Maximum 2 sentences. Reference his specific scores or notes if relevant.`;

  const [{ data: profile }, { data: programme }, { data: recentCheckIns }, { data: recentSessions }, { count: messageCount }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("programme_state").select("*").eq("user_id", userId).single(),
      supabase.from("check_ins").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(7),
      supabase.from("training_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);

  const systemPrompt = buildSystemPrompt({
    profile: profile!,
    programme: programme ?? null,
    recentCheckIns: recentCheckIns ?? [],
    recentSessions: recentSessions ?? [],
    lessonProgress: [],
    adminNotes: [],
    messageCount: messageCount ?? 0,
  });

  const aiResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 150,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const edgeResponse = aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";

  const { error } = await supabase.from("check_ins").upsert({
    user_id: userId,
    date: today,
    sleep_quality,
    morning_energy,
    stress_level,
    soreness,
    motivation,
    notes: notes || null,
    edge_response: edgeResponse,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Weight is saved separately and defensively: if the weight_kg column doesn't
  // exist yet, this fails silently rather than breaking the whole check-in.
  if (weight_kg != null) {
    const { error: wErr } = await supabase
      .from("check_ins")
      .update({ weight_kg })
      .eq("user_id", userId)
      .eq("date", today);
    if (wErr) console.warn("[checkin] weight_kg not saved (column missing?):", wErr.message);
  }

  return NextResponse.json({ response: edgeResponse });
}
