// Adaptive Fuel — decides whether a client's calorie target should nudge up,
// down, or hold, based on their actual weight trend and how well they've been
// logging. This is coaching logic, not a medical calculation: small, explained
// nudges rather than big swings, and it stays silent when the data doesn't
// support a confident call. See Back2Strong project brief, FUEL SYSTEM section.

export interface WeightPoint {
  date: string; // YYYY-MM-DD
  kg: number;
}

export interface WeekProteinDay {
  date: string;
  protein: number;
}

export type FuelGoal = "fat" | "stronger" | "back" | "energy" | "identity" | "all" | string | null;

export interface FuelAdjustment {
  direction: "increase" | "decrease";
  amountKcal: number;
  reason: string;
}

const MIN_SPAN_DAYS = 10; // need at least ~10 days of weigh-ins to trust a trend
const MIN_LOGGED_DAYS = 4; // out of the last 7, before we'll act on adherence
const STABLE_KG_PER_WEEK = 0.15; // noise floor — day-to-day water weight lives here
const FAST_KG_PER_WEEK = 1.0; // faster than this and loss/gain itself becomes the concern

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

function average(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

/**
 * weightPoints: chronological (oldest first), one entry per date the client
 * weighed in, covering roughly the last 28 days.
 * weekProteinDays: the last 7 calendar days' logged protein totals (0 = no log that day).
 */
export function computeFuelAdjustment(opts: {
  weightPoints: WeightPoint[];
  weekProteinDays: WeekProteinDay[];
  proteinTarget: number;
  goal: FuelGoal;
}): FuelAdjustment | null {
  const { weightPoints, weekProteinDays, proteinTarget, goal } = opts;

  // Don't act on a week we barely have data for — logging consistency comes
  // before adjusting numbers.
  const daysLogged = weekProteinDays.filter((d) => d.protein > 0).length;
  if (daysLogged < MIN_LOGGED_DAYS) return null;
  const daysHitProtein = weekProteinDays.filter((d) => d.protein >= proteinTarget).length;
  if (daysHitProtein < Math.ceil(MIN_LOGGED_DAYS * 0.5)) return null; // adherence itself is the issue, not the target

  if (weightPoints.length < 2) return null;
  const span = daysBetween(weightPoints[0].date, weightPoints[weightPoints.length - 1].date);
  if (span < MIN_SPAN_DAYS) return null;

  const mid = weightPoints.length / 2;
  const firstHalf = weightPoints.slice(0, Math.floor(mid));
  const secondHalf = weightPoints.slice(Math.ceil(mid));
  if (firstHalf.length === 0 || secondHalf.length === 0) return null;

  const avgFirst = average(firstHalf.map((p) => p.kg));
  const avgSecond = average(secondHalf.map((p) => p.kg));
  const midFirst = firstHalf[Math.floor(firstHalf.length / 2)].date;
  const midSecond = secondHalf[Math.floor(secondHalf.length / 2)].date;
  const weeksBetween = Math.max(daysBetween(midFirst, midSecond) / 7, 1);
  const weeklyRateKg = (avgSecond - avgFirst) / weeksBetween;

  const isFatLoss = goal === "fat";
  const isMuscleGain = goal === "stronger";

  // Fat-loss goal: want a gentle decline. Flat/rising -> tighten. Crashing -> ease off.
  if (isFatLoss) {
    if (weeklyRateKg > -STABLE_KG_PER_WEEK) {
      return {
        direction: "decrease",
        amountKcal: 150,
        reason: "Your average weight has held steady over the last couple of weeks despite good protein adherence, so we're making a small adjustment rather than a large change.",
      };
    }
    if (weeklyRateKg < -FAST_KG_PER_WEEK) {
      return {
        direction: "increase",
        amountKcal: 150,
        reason: "Weight's dropping faster than we want — that usually costs muscle and energy along with fat. Nudging calories up slightly to slow the rate down.",
      };
    }
    return null;
  }

  // Muscle-gain goal: want a gentle rise. Flat/dropping -> add fuel. Piling on -> trim.
  if (isMuscleGain) {
    if (weeklyRateKg < STABLE_KG_PER_WEEK) {
      return {
        direction: "increase",
        amountKcal: 150,
        reason: "Weight's been flat despite good protein adherence, so we're adding a small amount of food rather than a big jump.",
      };
    }
    if (weeklyRateKg > FAST_KG_PER_WEEK) {
      return {
        direction: "decrease",
        amountKcal: 150,
        reason: "You're gaining faster than target — some of that will be fat rather than muscle. Trimming calories slightly to keep the gain lean.",
      };
    }
    return null;
  }

  // Any other goal (general recomposition / maintenance): only flag a clear drift.
  if (Math.abs(weeklyRateKg) > FAST_KG_PER_WEEK) {
    return weeklyRateKg > 0
      ? { direction: "decrease", amountKcal: 150, reason: "Weight's been drifting up faster than expected the last couple of weeks, so we're trimming calories slightly." }
      : { direction: "increase", amountKcal: 150, reason: "Weight's been drifting down faster than expected the last couple of weeks, so we're adding calories slightly." };
  }
  return null;
}
