import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import {
  AI_DAILY_LIMITS,
  coachLimitMessage,
  foodLimitMessage,
  overDailyLimit,
  quotaFunctionMissing,
  secondsUntilUtcMidnight,
  utcDateString,
  utcDayStartIso,
} from "@/lib/ai/limits";

export type AiUsageKind = "coach" | "food";

function limitResponse(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(secondsUntilUtcMidnight()) } },
  );
}

async function countExisting(supabase: SupabaseClient, userId: string, kind: AiUsageKind): Promise<number> {
  if (kind === "coach") {
    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", utcDayStartIso());
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  const { count, error } = await supabase
    .from("nutrition_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("date", utcDateString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Reserve one use of today's cap. Returns a response when the caller should
 * stop, or null when the call may proceed.
 *
 * Uses consume_daily_ai_use when the migration is applied (atomic, and it
 * counts food analyses that have not been saved yet). Until then, counts
 * today's coach messages or saved nutrition rows.
 */
export async function enforceDailyCap(
  supabase: SupabaseClient,
  userId: string,
  kind: AiUsageKind,
): Promise<NextResponse | null> {
  const limit = kind === "coach" ? AI_DAILY_LIMITS.coachMessages : AI_DAILY_LIMITS.foodLogs;
  const message = kind === "coach" ? coachLimitMessage() : foodLimitMessage();

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_daily_ai_use", {
    p_user_id: userId,
    p_kind: kind,
    p_limit: limit,
  });

  if (!error) {
    if (data === true) return null;
    return limitResponse(message);
  }

  if (!quotaFunctionMissing(error)) {
    console.error("[ai-cap] quota check failed:", error.message);
    return NextResponse.json(
      { error: "Couldn't check today's limit. Try again in a moment." },
      { status: 503 },
    );
  }

  console.warn("[ai-cap] consume_daily_ai_use is not installed yet; counting existing rows");
  try {
    const used = await countExisting(supabase, userId, kind);
    if (overDailyLimit(used, limit)) return limitResponse(message);
    return null;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[ai-cap] fallback count failed:", detail);
    return NextResponse.json(
      { error: "Couldn't check today's limit. Try again in a moment." },
      { status: 503 },
    );
  }
}
