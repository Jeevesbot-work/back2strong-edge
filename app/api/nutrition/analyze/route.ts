import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireActiveClient } from "@/lib/ai/access";
import { enforceDailyCap } from "@/lib/ai/quota";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const JSON_SCHEMA = `{
  "meal_name": "short descriptive name",
  "calories": estimated total calories as integer,
  "protein_g": estimated protein in grams as number,
  "carbs_g": estimated carbs in grams as number,
  "fat_g": estimated fat in grams as number,
  "edge_comment": "1-2 sentences in the voice of Edge — direct, warm British male coach. No emojis. No hype. Acknowledge the food choice honestly and connect it to protein-first fuelling."
}`;

export async function POST(req: NextRequest) {
  try {
    const access = await requireActiveClient();
    if (!access.ok) return access.response;
    const { supabase, userId, isAdmin } = access;

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[nutrition] ANTHROPIC_API_KEY not set");
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const { image, mimeType, text } = await req.json();

    if (!image && !text) return NextResponse.json({ error: "No image or description provided" }, { status: 400 });

    if (!isAdmin) {
      const limited = await enforceDailyCap(supabase, userId, "food");
      if (limited) return limited;
    }

    let raw: string;

    if (text) {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `You are a nutrition analyst for a men's fitness coaching app. Analyse this meal description and respond ONLY with a JSON object — no other text, no markdown, no code fences.

Meal: "${text}"

The JSON must have exactly these fields:
${JSON_SCHEMA}

Be realistic with estimates based on typical portion sizes. Always return valid JSON.`,
        }],
      });
      raw = response.content[0].type === "text" ? response.content[0].text : "";
    } else {
      const validType = (mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp")
        ? mimeType as "image/jpeg" | "image/png" | "image/webp"
        : "image/jpeg" as const;

      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: validType, data: image },
            },
            {
              type: "text",
              text: `You are a nutrition analyst for a men's fitness coaching app. Analyse this food photo and respond ONLY with a JSON object — no other text, no markdown, no code fences.

Look carefully before naming anything. Check each item's specific colour, shape, size, skin/peel texture, and any visible cut surface or stem — these are the details that distinguish similar-looking foods (e.g. an apple has a stem indent and waxy skin, a plum is smaller with a smoother rounder shape and a crease line; a nectarine is fuzzless where a peach is fuzzy). If two foods on the plate could be confused, name the one that best matches everything you can see, not just the general shape and colour.

The JSON must have exactly these fields:
${JSON_SCHEMA}

Be realistic with estimates. If you cannot identify food clearly, give your best guess. Always return valid JSON.`,
            },
          ],
        }],
      });
      raw = response.content[0].type === "text" ? response.content[0].text : "";
    }

    let analysis: {
      meal_name: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      edge_comment: string;
    };

    try {
      analysis = JSON.parse(raw);
    } catch {
      console.error("[nutrition] Failed to parse Claude response:", raw);
      return NextResponse.json({ error: "Could not analyse the meal" }, { status: 422 });
    }

    const { data: log, error } = await supabase
      .from("nutrition_logs")
      .insert({
        user_id: userId,
        meal_name: analysis.meal_name,
        calories: Math.round(analysis.calories),
        protein_g: analysis.protein_g,
        carbs_g: analysis.carbs_g,
        fat_g: analysis.fat_g,
        edge_comment: analysis.edge_comment,
      })
      .select()
      .single();

    if (error) {
      console.error("[nutrition] DB insert error:", error);
      return NextResponse.json({ error: "Failed to save log" }, { status: 500 });
    }

    return NextResponse.json(log);
  } catch (err) {
    console.error("[nutrition] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
