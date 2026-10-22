// Body weight is the morning weigh-in on a daily check-in (check_ins.weight_kg).
// One row per client per date. There is no separate weights table.
//
// Dates are calendar days (YYYY-MM-DD), compared and shifted in UTC so a
// weigh-in never slides to the day before or after because of a timezone.

export type WeighIn = { date: string; kg: number };

export type RawWeighIn = {
  date?: string | null;
  kg?: number | string | null;
  weight_kg?: number | string | null;
};

export type WeightRange = "4w" | "3m" | "all";

export type WeighInRow = {
  date: string;
  kg: number;
  /** Change from the weigh-in immediately before this one. Null on the first. */
  sincePreviousKg: number | null;
  /** Change from the earliest weigh-in. Zero on the first. */
  sinceFirstKg: number;
};

export type WeightSummary = {
  startKg: number;
  currentKg: number;
  totalChangeKg: number;
  /** (last − first) per week inside the trailing 4 weeks. Null when it can't be read. */
  weeklyChangeKg: number | null;
};

export const WEIGHT_RANGES: { id: WeightRange; label: string }[] = [
  { id: "4w", label: "4 weeks" },
  { id: "3m", label: "3 months" },
  { id: "all", label: "All time" },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

export function addMonths(iso: string, months: number): string {
  const date = parseISODate(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return formatISODate(date);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);
}

export function round1(n: number): number {
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(n) * 10)) / 10;
}

export function formatKg(n: number): string {
  return round1(n).toFixed(1);
}

export function formatChange(n: number): string {
  const v = round1(n);
  if (v === 0) return "0.0";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

export function formatDisplayDate(iso: string, withYear = false): string {
  return parseISODate(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

function asKg(row: RawWeighIn): number {
  const raw = row.kg ?? row.weight_kg;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.trim() !== "") return Number(raw);
  return NaN;
}

/** Drop blanks and keep one weight per day (the later row wins). Oldest first. */
export function normaliseWeighIns(rows: RawWeighIn[] | null | undefined): WeighIn[] {
  const byDate = new Map<string, number>();
  for (const row of rows ?? []) {
    const date = typeof row.date === "string" ? row.date.slice(0, 10) : "";
    if (!DATE.test(date)) continue;
    const kg = asKg(row);
    if (!Number.isFinite(kg) || kg <= 0 || kg >= 500) continue;
    byDate.set(date, kg);
  }
  return Array.from(byDate.entries())
    .map(([date, kg]) => ({ date, kg }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function rangeStart(today: string, range: WeightRange): string | null {
  if (range === "all") return null;
  if (range === "4w") return addDays(today, -28);
  return addMonths(today, -3);
}

/** Entries inside the range, inclusive, and never after `today`. Oldest first. */
export function filterByRange(entries: WeighIn[], range: WeightRange, today: string): WeighIn[] {
  const start = rangeStart(today, range);
  return entries.filter((entry) => entry.date <= today && (start == null || entry.date >= start));
}

/**
 * Change per week over the trailing 4 weeks: the first and last weigh-in in
 * that window, spread across the days between them. Needs two different days.
 */
export function weeklyChangeKg(entries: WeighIn[], today: string): number | null {
  const start = addDays(today, -28);
  const window = entries.filter((entry) => entry.date >= start && entry.date <= today);
  if (window.length < 2) return null;
  const first = window[0];
  const last = window[window.length - 1];
  const days = daysBetween(first.date, last.date);
  if (days <= 0) return null;
  return (last.kg - first.kg) / (days / 7);
}

export function summarise(entries: WeighIn[], today: string): WeightSummary | null {
  if (entries.length === 0) return null;
  const startKg = entries[0].kg;
  const currentKg = entries[entries.length - 1].kg;
  return {
    startKg,
    currentKg,
    totalChangeKg: currentKg - startKg,
    weeklyChangeKg: weeklyChangeKg(entries, today),
  };
}

/** Newest first. Deltas are against chronological order, not display order. */
export function weighInRows(entries: WeighIn[]): WeighInRow[] {
  if (entries.length === 0) return [];
  const first = entries[0].kg;
  const rows: WeighInRow[] = entries.map((entry, index) => ({
    date: entry.date,
    kg: entry.kg,
    sincePreviousKg: index === 0 ? null : entry.kg - entries[index - 1].kg,
    sinceFirstKg: entry.kg - first,
  }));
  rows.reverse();
  return rows;
}

export function prepareWeightHistory(raw: RawWeighIn[] | null | undefined, today: string): {
  entries: WeighIn[];
  summary: WeightSummary | null;
  rows: WeighInRow[];
} {
  const entries = normaliseWeighIns(raw).filter((entry) => entry.date <= today);
  return { entries, summary: summarise(entries, today), rows: weighInRows(entries) };
}
