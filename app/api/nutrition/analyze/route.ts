import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireActiveClient } from "@/lib/ai/access";
import { enforceDailyCap } from "@/lib/ai/quota";
import { inspectMealPhoto } from "@/lib/nutrition/inspect-photo";
import {
  BLANK_PHOTO_MESSAGE,
  NO_FOOD_MESSAGE,
  isUnreadablePhoto,
  mealFromAnalysis,
  parseModelJson,
} from "@/lib/nutrition/photo-frame";
import { ALREADY_LOGGED, foodIsDuplicate, recentFoodLogs } from "@/lib/logs/duplicate";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const JSON_SCHEMA = `{
  "meal_name": "short descriptive name",
  "calories": estimated total calories as integer,
  "protein_g": estimated protein in grams as number,
  "carbs_g": estimated carbs in grams as number,
  "fat_g": estimated fat in grams as number,
  "edge_comment": "1-2 sentences in the voice of Edge — direct, warm British male coach. No emojis. No hype. Acknowledge the food choice honestly and connect it to protein-first fuelling."
}`;

const PHOTO_PROMPT = `You are a nutrition analyst for a men's fitness coaching app. Analyse this food photo and respond ONLY with a JSON object — no other text, no markdown, no code fences.

Look carefully before naming anything. Check each item's specific colour, shape, size, skin/peel texture, and any visible cut surface or stem — these are the details that distinguish similar-looking foods (e.g. an apple has a stem indent and waxy skin, a plum is smaller with a smoother rounder shape and a crease line; a nectarine is fuzzless where a peach is fuzzy). If two foods on the plate could be confused, name the one that best matches everything you can see, not just the general shape and colour.

If the image is blank, black, too dark to make anything out, or shows no food, drink, or supplement, do not guess and do not invent calories. Respond with exactly {"no_food": true} and nothing else.

When you can see a food, drink, or supplement — including zero-calorie items such as black coffee, water, creatine, or diet soda — estimate that item. Calories may be 0. Respond with a JSON object that has exactly these fields:
${JSON_SCHEMA}

Be realistic with estimates. Always return valid JSON.`;

export async function POST(req: NextRequest) {
  try {
    const access = await requireActiveClient();
    if (!access.ok) return access.response;
    const { supabase, userId, isAdmin } = access;

    const { image, mimeType, text } = await req.json();

    if (!image && !text) return NextResponse.json({ error: "No image or description provided" }, { status: 400 });

    // A black frame is not an analysis. Reject it before the daily cap and before
    // the model, so nothing is saved and the guess never happens.
    if (!text) {
      if (typeof image !== "string" || !image.trim()) {
        return NextResponse.json({ error: "No image or description provided" }, { status: 400 });
      }
      const verdict = await inspectMealPhoto(image);
      if (verdict === "blank") {
        return NextResponse.json({ error: BLANK_PHOTO_MESSAGE }, { status: 422 });
      }
      if (verdict === "unreadable") {
        return NextResponse.json({ error: "Couldn't read that photo. Try again." }, { status: 422 });
      }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[nutrition] ANTHROPIC_API_KEY not set");
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

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
              text: PHOTO_PROMPT,
            },
          ],
        }],
      });
      raw = response.content[0].type === "text" ? response.content[0].text : "";
    }

    let parsed: unknown;
    try {
      parsed = parseModelJson(raw);
    } catch {
      console.error("[nutrition] Failed to parse Claude response:", raw);
      return NextResponse.json({ error: "Could not analyse the meal" }, { status: 422 });
    }

    if (!text && isUnreadablePhoto(parsed)) {
      return NextResponse.json({ error: NO_FOOD_MESSAGE }, { status: 422 });
    }

    const meal = mealFromAnalysis(parsed);
    if (!meal) {
      return NextResponse.json({ error: "Could not analyse the meal" }, { status: 422 });
    }

    const now = new Date();
    const recent = await recentFoodLogs(supabase, userId, now);
    if (foodIsDuplicate(recent, meal, now)) {
      return NextResponse.json({ error: ALREADY_LOGGED }, { status: 409 });
    }

    const { data: log, error } = await supabase
      .from("nutrition_logs")
      .insert({
        user_id: userId,
        meal_name: meal.meal_name,
        calories: meal.calories,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
        edge_comment: meal.edge_comment,
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
