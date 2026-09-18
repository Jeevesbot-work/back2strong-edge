import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/claude/prompts";
import { weekStartOf, DAY_LABELS_LONG } from "@/lib/meal-plan";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

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
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("programme_state").select("*").eq("user_id", user.id).single(),
      supabase.from("check_ins").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(7),
      supabase.from("training_sessions").select("*").eq("user_id", user.id).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(5),
      supabase.from("lesson_completions").select("*").eq("user_id", user.id),
      supabase.from("admin_notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("nutrition_logs").select("date, protein_g, calories, meal_name").eq("user_id", user.id).gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).order("date", { ascending: true }),
      supabase.from("walk_logs").select("minutes").eq("user_id", user.id).gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
      supabase.from("meal_plans").select("day, slot, recipes(title)").eq("user_id", user.id).eq("week_start", weekStartOf()).not("recipe_id", "is", null),
    ]);

    const systemPrompt = buildSystemPrompt({
      profile: profile ?? { id: user.id, email: user.email ?? "", full_name: null, age: null, goal: null, injuries: null, training_state: null, days_per_week: 3, commitment_answer: null, approved: true, created_at: "", updated_at: "" },
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

    const history = (messageHistory ?? [])
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    await supabase.from("messages").insert({ user_id: user.id, role: "user", content: message });

    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: systemPrompt,
      messages: [...history, { role: "user", content: message }],
    });

    let full = "";
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              full += chunk.delta.text;
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
          controller.close();
          await supabase.from("messages").insert({ user_id: user.id, role: "assistant", content: full });
        } catch (streamErr) {
          console.error("[edge] Stream error:", streamErr);
          controller.close();
        }
      },
    });

    return new NextResponse(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
    });
  } catch (err) {
    console.error("[edge] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
