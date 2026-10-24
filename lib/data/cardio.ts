// Train used to read programme.cardio.inclineWalk and programme.cardio.assaultBike
// directly. A programme that omits one of those keys (The Plan dry-run writes
// inclineWalk only) threw `Cannot read properties of undefined (reading 'label')`
// and the /train route returned 500. Resolve whatever is actually stored.

export type CardioKind = "walk" | "bike" | "other";

export interface ResolvedCardioWeek {
  week: number;
  duration?: string;
  format?: string;
}

export interface ResolvedCardioBlock {
  key: string;
  kind: CardioKind;
  label: string;
  days: string;
  setup?: string;
  rule?: string;
  timingTip?: string;
  byWeek: ResolvedCardioWeek[];
}

const PREFERRED_KEYS = ["inclineWalk", "assaultBike"];

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function humanize(key: string): string {
  if (/^cardio-\d+$/.test(key)) return "Cardio";
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return "Cardio";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function cardioKind(key: string): CardioKind {
  const normalized = key.toLowerCase();
  if (normalized === "inclinewalk" || normalized.includes("walk") || normalized.includes("treadmill")) return "walk";
  if (normalized === "assaultbike" || normalized.includes("bike")) return "bike";
  return "other";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function weeksFrom(value: unknown): ResolvedCardioWeek[] {
  if (!Array.isArray(value)) return [];
  const weeks: ResolvedCardioWeek[] = [];
  for (const row of value) {
    if (!isRecord(row)) continue;
    const week = typeof row.week === "number" ? row.week : Number(row.week);
    if (!Number.isFinite(week)) continue;
    weeks.push({ week, duration: text(row.duration), format: text(row.format) });
  }
  return weeks;
}

function blockFrom(key: string, value: unknown): ResolvedCardioBlock | null {
  if (!isRecord(value)) return null;
  const byWeek = weeksFrom(value.byWeek);
  const setup = text(value.setup);
  const rule = text(value.rule);
  const timingTip = text(value.timingTip);
  const days = text(value.days) ?? "";
  const hasBody = Boolean(setup || rule || timingTip || days || byWeek.length);
  const label = text(value.label) ?? (hasBody ? humanize(key) : "");
  if (!label) return null;
  return { key, kind: cardioKind(key), label, days, setup, rule, timingTip, byWeek };
}

function entriesFrom(cardio: unknown): [string, unknown][] {
  if (Array.isArray(cardio)) {
    return cardio.map((item, index) => {
      const key = isRecord(item) ? text(item.key) ?? text(item.type) ?? text(item.id) : undefined;
      return [key ?? `cardio-${index + 1}`, item];
    });
  }
  if (!isRecord(cardio)) return [];
  const keys = Object.keys(cardio);
  const preferred = PREFERRED_KEYS.filter((key) => keys.includes(key));
  const rest = keys.filter((key) => !preferred.includes(key));
  return [...preferred, ...rest].map((key) => [key, cardio[key]]);
}

/** Safe cardio blocks for Train. Never throws. Skips nulls, strings, and empty objects. */
export function resolveCardioBlocks(cardio: unknown): ResolvedCardioBlock[] {
  const blocks: ResolvedCardioBlock[] = [];
  for (const [key, value] of entriesFrom(cardio)) {
    const block = blockFrom(key, value);
    if (block) blocks.push(block);
  }
  return blocks;
}
