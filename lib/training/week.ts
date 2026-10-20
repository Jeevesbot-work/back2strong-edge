// "This week" for a UK client is Monday 00:00 to the next Monday 00:00 in
// Europe/London. The check-in used to count a rolling 7×24h instead, so a
// Thursday morning still included the previous Thursday–Sunday.

const LONDON = "Europe/London";

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function londonParts(date: Date): { year: number; month: number; day: number; weekday: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: (map.weekday ?? "").slice(0, 3),
  };
}

/** Minutes to add to UTC to get the Europe/London wall clock at `date`. */
function londonOffsetMinutes(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: LONDON,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) map[part.type] = part.value;
  const hour = Number(map.hour) % 24;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** 00:00 Europe/London on the given calendar date, as a UTC instant. */
function londonMidnight(year: number, month: number, day: number): Date {
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const first = londonOffsetMinutes(utcMidnight);
  const guess = new Date(utcMidnight.getTime() - first * 60000);
  const second = londonOffsetMinutes(guess);
  return new Date(utcMidnight.getTime() - second * 60000);
}

/** Monday 00:00 Europe/London of the week that contains `now`. */
export function londonWeekStart(now: Date): Date {
  const parts = londonParts(now);
  const index = WEEKDAY_INDEX[parts.weekday] ?? 0;
  const monday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  monday.setUTCDate(monday.getUTCDate() - index);
  return londonMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

export interface CompletedSessionRef {
  completed_at?: string | null;
}

/** Completed sessions whose finish time falls in the London calendar week. */
export function countCompletedSessionsThisWeek(sessions: CompletedSessionRef[], now: Date): number {
  const start = londonWeekStart(now).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const session of sessions) {
    if (!session.completed_at) continue;
    const finished = new Date(session.completed_at).getTime();
    if (finished >= start && finished < end) count += 1;
  }
  return count;
}

export function latestCompletedAt(sessions: CompletedSessionRef[]): number | null {
  let best: number | null = null;
  for (const session of sessions) {
    if (!session.completed_at) continue;
    const finished = new Date(session.completed_at).getTime();
    if (!Number.isFinite(finished)) continue;
    if (best === null || finished > best) best = finished;
  }
  return best;
}
