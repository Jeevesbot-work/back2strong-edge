import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/claude/prompts";
import { weekStartOf, DAY_LABELS_LONG } from "@/lib/meal-plan";
import { requireActiveClient } from "@/lib/ai/access";
import { enforceDailyCap } from "@/lib/ai/quota";
import { ANSWER_LATEST_INSTRUCTION, messagesForModel, type ModelTurn } from "@/lib/coach/replies";
import { createServiceClient } from "@/lib/supabase/service";
import { rejectIfViewing } from "@/lib/view-as-server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function modelHistory(rows: Array<{ role?: string; content?: string }> | null): ModelTurn[] {
  const history: ModelTurn[] = [];
  for (const row of rows ?? []) {
    if ((row.role === "user" || row.role === "assistant") && typeof row.content === "string") {
      history.push({ role: row.role, content: row.content });
    }
  }
  return history;
}

export async function POST(req: NextRequest) {
  try {
    const blocked = await rejectIfViewing();
    if (blocked) return blocked;

    const access = await requireActiveClient();
    if (!access.ok) return access.response;
    const { supabase, userId, email, isAdmin } = access;

    const { message } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: "No message" }, { status: 400 });

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[edge] ANTHROPIC_API_KEY is not set");
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const [
      { data: profile },
      { data: programme },
      { data: recentCheckIns },
      { data: recentSessions },
      { data: lessonProgress },
      { data: adminNotes },
      { data: messageHistory },
      { count: messageCount },
      { data: recentFuel },
      { data: recentWalks },
      { data: plannedRows },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("programme_state").select("*").eq("user_id", userId).single(),
      supabase.from("check_ins").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(7),
      supabase.from("training_sessions").select("*").eq("user_id", userId).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(20),
      supabase.from("lesson_completions").select("*").eq("user_id", userId),
      supabase.from("admin_notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("messages").select("role, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("nutrition_logs").select("date, protein_g, calories, meal_name").eq("user_id", userId).gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).order("date", { ascending: true }),
      supabase.from("walk_logs").select("minutes").eq("user_id", userId).gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
      supabase.from("meal_plans").select("day, slot, recipes(title)").eq("user_id", userId).eq("week_start", weekStartOf()).not("recipe_id", "is", null),
    ]);

    const systemPrompt = buildSystemPrompt({
      profile: profile ?? { id: userId, email, full_name: null, age: null, goal: null, injuries: null, training_state: null, days_per_week: 3, commitment_answer: null, approved: true, created_at: "", updated_at: "" },
      programme: programme ?? null,
      recentCheckIns: recentCheckIns ?? [],
      recentSessions: recentSessions ?? [],
      lessonProgress: lessonProgress ?? [],
      adminNotes: adminNotes ?? [],
      messageCount: messageCount ?? 0,
      recentFuel: recentFuel ?? [],
      proteinTarget: profile?.protein_target ?? null,
      calorieTarget: profile?.calorie_target ?? null,
      walkMinutesWeek: (recentWalks ?? []).reduce((s: number, w: { minutes: number | null }) => s + (w.minutes ?? 0), 0),
      plannedMeals: ((plannedRows ?? []) as Array<{ day: number; slot: string; recipes: { title: string } | { title: string }[] | null }>)
        .map((r) => { const rec = Array.isArray(r.recipes) ? r.recipes[0] : r.recipes; return rec ? `${DAY_LABELS_LONG[r.day]} ${r.slot}: ${rec.title}` : null; })
        .filter((x): x is string => !!x),
    });

    if (!isAdmin) {
      const limited = await enforceDailyCap(supabase, userId, "coach");
      if (limited) return limited;
    }

    const trimmed = message.trim();
    const { data: savedUser, error: userError } = await supabase
      .from("messages")
      .insert({ user_id: userId, role: "user", content: trimmed })
      .select("id")
      .single();
    if (userError || !savedUser) {
      console.error("[edge] client message was not saved:", userError?.message ?? "no row");
      return NextResponse.json({ error: "Couldn't save your message. Try again." }, { status: 500 });
    }

    // The reply is generated and stored before this function returns. The
    // previous handler finished the HTTP response and only then tried to
    // insert the assistant row, which let the serverless runtime freeze
    // first. Insert errors were only logged. The draft is written with the
    // service role, and the text is not sent back to the client.
    const modelMessages = messagesForModel(modelHistory(messageHistory).reverse(), trimmed);
    let replyText = "";
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: `${systemPrompt}\n\n${ANSWER_LATEST_INSTRUCTION}`,
        messages: modelMessages,
      });
      replyText = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
    } catch (err) {
      console.error("[edge] coach reply was not generated:", err instanceof Error ? err.message : err);
      return NextResponse.json({ ok: true, id: savedUser.id, drafted: false });
    }

    const text = replyText.trim();
    if (!text) {
      console.error("[edge] assistant reply was empty; nothing saved");
      return NextResponse.json({ ok: true, id: savedUser.id, drafted: false });
    }

    const admin = createServiceClient();
    const { data: draft, error: draftError } = await admin
      .from("coach_reply_drafts")
      .insert({
        user_id: userId,
        client_message_id: savedUser.id,
        content: text,
        status: "pending",
      })
      .select("id")
      .single();

    if (draftError || !draft) {
      console.error("[edge] failed to save coach reply draft:", draftError?.message ?? "no row");
      return NextResponse.json({ ok: true, id: savedUser.id, drafted: false });
    }

    return NextResponse.json({ ok: true, id: savedUser.id, drafted: true });
  } catch (err) {
    console.error("[edge] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
