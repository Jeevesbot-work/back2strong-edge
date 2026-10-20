import type { SupabaseClient } from "@supabase/supabase-js";

// Long enough to catch a double tap that still falls in the same clock minute
// (the food duplicate) and two walks a couple of seconds apart. A second
// identical entry a couple of minutes later is a real extra portion or walk.
export const DUPLICATE_WINDOW_MS = 45_000;

export const ALREADY_LOGGED = "That's already logged.";

export function loggedWithinWindow(createdAt: string, now: Date, windowMs = DUPLICATE_WINDOW_MS): boolean {
  const then = new Date(createdAt).getTime();
  if (!Number.isFinite(then)) return false;
  const age = now.getTime() - then;
  return age >= 0 && age < windowMs;
}

export interface FoodIdentity {
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

function close(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) < 0.05;
}

export function sameFood(a: FoodIdentity, b: FoodIdentity): boolean {
  return a.meal_name.trim().toLowerCase() === b.meal_name.trim().toLowerCase()
    && Math.round(Number(a.calories)) === Math.round(Number(b.calories))
    && close(a.protein_g, b.protein_g)
    && close(a.carbs_g, b.carbs_g)
    && close(a.fat_g, b.fat_g);
}

export function foodIsDuplicate(
  recent: Array<FoodIdentity & { created_at: string }>,
  incoming: FoodIdentity,
  now: Date,
): boolean {
  return recent.some((row) => sameFood(row, incoming) && loggedWithinWindow(row.created_at, now));
}

export function walkIsDuplicate(
  recent: Array<{ minutes: number; created_at: string }>,
  minutes: number,
  now: Date,
): boolean {
  return recent.some((row) => Number(row.minutes) === minutes && loggedWithinWindow(row.created_at, now));
}

export function sessionIsDuplicate(
  recent: Array<{ session_type: string; created_at: string }>,
  sessionType: string,
  now: Date,
): boolean {
  const wanted = sessionType.trim().toLowerCase();
  return recent.some((row) => row.session_type.trim().toLowerCase() === wanted && loggedWithinWindow(row.created_at, now));
}

function since(now: Date): string {
  return new Date(now.getTime() - DUPLICATE_WINDOW_MS).toISOString();
}

export async function recentFoodLogs(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<Array<FoodIdentity & { created_at: string }>> {
  const { data, error } = await supabase
    .from("nutrition_logs")
    .select("created_at, meal_name, calories, protein_g, carbs_g, fat_g")
    .eq("user_id", userId)
    .gte("created_at", since(now));
  if (error) {
    console.error("[logs] duplicate lookup failed:", error.message);
    return [];
  }
  return (data ?? []) as Array<FoodIdentity & { created_at: string }>;
}

export async function recentWalks(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<Array<{ minutes: number; created_at: string }>> {
  const { data, error } = await supabase
    .from("walk_logs")
    .select("created_at, minutes")
    .eq("user_id", userId)
    .gte("created_at", since(now));
  if (error) {
    console.error("[logs] duplicate walk lookup failed:", error.message);
    return [];
  }
  return (data ?? []) as Array<{ minutes: number; created_at: string }>;
}

export async function recentSessions(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<Array<{ session_type: string; created_at: string }>> {
  const { data, error } = await supabase
    .from("training_sessions")
    .select("created_at, session_type")
    .eq("user_id", userId)
    .gte("created_at", since(now));
  if (error) {
    console.error("[logs] duplicate session lookup failed:", error.message);
    return [];
  }
  return (data ?? []) as Array<{ session_type: string; created_at: string }>;
}
