/**
 * Daily AI caps. Change these two numbers to retune cost.
 * The day resets at 00:00 UTC, the same boundary food logs already use.
 * Admins are not capped. Meal plans and check-ins are approval-gated only.
 */
export const AI_DAILY_LIMITS = {
  coachMessages: 15,
  foodLogs: 10,
} as const;

export const APPROVAL_REQUIRED_MESSAGE = "Your account is waiting for approval.";

export function coachLimitMessage(limit = AI_DAILY_LIMITS.coachMessages): string {
  return `You've reached today's limit of ${limit} messages to your coach. It resets tomorrow.`;
}

export function foodLimitMessage(limit = AI_DAILY_LIMITS.foodLogs): string {
  return `You've reached today's limit of ${limit} food logs. It resets tomorrow.`;
}

export function overDailyLimit(used: number, limit: number): boolean {
  return used >= limit;
}

/** Start of the current UTC day, as an ISO timestamp for created_at filters. */
export function utcDayStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** Current UTC date, YYYY-MM-DD, matching nutrition_logs.date. */
export function utcDateString(now = new Date()): string {
  return utcDayStartIso(now).slice(0, 10);
}

export function secondsUntilUtcMidnight(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/** True when the quota function has not been created yet (migration not applied). */
export function quotaFunctionMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  const message = error.message ?? "";
  return /consume_daily_ai_use|could not find the function|schema cache/i.test(message);
}
