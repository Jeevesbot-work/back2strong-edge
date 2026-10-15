import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireActiveClient } from "@/lib/ai/access";
import { enforceDailyCap } from "@/lib/ai/quota";

// "Tell Edge what you ate" — spoken or typed food logging.
//
// POST { mode: "parse", text, answer? }
//   → { question }             when a portion is too vague to estimate (asked once)
//   → { items: [...] }          one entry per food, ready for the client to confirm
// POST { mode: "save", items }
//   → { logs: [...] }           rows inserted into nutrition_logs

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Item {
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  edge_comment?: string;
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  return JSON.parse(raw.slice(start, end + 1));
}

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);

export async function POST(req: NextRequest) {
  try {
    const access = await requireActiveClient();
    if (!access.ok) return access.response;
    const { supabase, userId, isAdmin } = access;

    const body = await req.json();

    if (body.mode === "save") {
      const items: Item[] = Array.isArray(body.items) ? body.items.slice(0, 15) : [];
      if (!items.length) return NextResponse.json({ error: "Nothing to log" }, { status: 400 });
      const rows = items.map((i) => ({
        user_id: userId,
        meal_name: String(i.meal_name ?? "Food").slice(0, 120),
        calories: Math.max(0, Math.round(num(i.calories))),
        protein_g: Math.max(0, Math.round(num(i.protein_g) * 10) / 10),
        carbs_g: Math.max(0, Math.round(num(i.carbs_g) * 10) / 10),
        fat_g: Math.max(0, Math.round(num(i.fat_g) * 10) / 10),
        edge_comment: String(i.edge_comment ?? "").slice(0, 400),
      }));
      const { data, error } = await supabase.from("nutrition_logs").insert(rows).select();
      if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
      return NextResponse.json({ logs: data });
    }

    // parse
    const text = String(body.text ?? "").trim().slice(0, 1000);
    const answer = String(body.answer ?? "").trim().slice(0, 300);
    if (!text) return NextResponse.json({ error: "Say or type what you ate" }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    if (!isAdmin) {
      const limited = await enforceDailyCap(supabase, userId, "food");
      if (limited) return limited;
    }

    const prompt = `You are the food logger in a men's fitness coaching app (UK). A member has told you, in their own words (often dictated by voice, so expect missing punctuation and speech-to-text slips), what they ate.

What they said: "${text}"
${answer ? `\nYou asked a follow-up about portions and they replied: "${answer}"\nDo NOT ask another question now — use this and sensible UK portion sizes for anything still unclear.\n` : ""}
Split it into separate food items (e.g. "two bacon rolls and a coffee with milk" = 2 items: "Bacon rolls (2)" and "Coffee with milk"). Combine things that are clearly one dish ("chicken, rice and salad" as one bowl is one item).

${answer ? "" : `If — and only if — the size of a main calorie source is genuinely unclear AND could swing the day's total by more than about 250 kcal (e.g. "some pasta", "chicken and rice" with no amount, "a takeaway"), ask ONE short, friendly question instead, in plain British English, offering easy options (e.g. "Roughly how much rice — one fist or two?"). Never ask about small things like sauces, drinks or a piece of fruit; estimate those.\n`}
Respond ONLY with JSON, no other text. Either:
{"question": "..."}
or:
{"items": [{"meal_name": "short name with quantity", "calories": integer, "protein_g": number, "carbs_g": number, "fat_g": number}], "edge_comment": "1–2 sentences as Edge — direct, warm British male coach, no emojis, no hype. Honest about the choices and tie it to protein-first eating."}

Use realistic UK portion sizes. Macros must roughly add up to the calories (protein 4, carbs 4, fat 9 per gram).`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.content[0]?.type === "text" ? response.content[0].text : "";

    let parsed: { question?: string; items?: Item[]; edge_comment?: string };
    try {
      parsed = extractJson(raw) as typeof parsed;
    } catch {
      return NextResponse.json({ error: "Couldn't make sense of that. Try saying it again a bit more simply." }, { status: 422 });
    }

    if (parsed.question && !answer) return NextResponse.json({ question: String(parsed.question).slice(0, 200) });

    const items = (parsed.items ?? []).filter((i) => i && i.meal_name).map((i) => ({
      meal_name: String(i.meal_name),
      calories: Math.round(num(i.calories)),
      protein_g: Math.round(num(i.protein_g)),
      carbs_g: Math.round(num(i.carbs_g)),
      fat_g: Math.round(num(i.fat_g)),
      edge_comment: parsed.edge_comment ?? "",
    }));
    if (!items.length) return NextResponse.json({ error: "Couldn't pick out any food there. Try again?" }, { status: 422 });
    return NextResponse.json({ items, edge_comment: parsed.edge_comment ?? "" });
  } catch (err) {
    console.error("[nutrition/describe]", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
