// ── Early-warning signals ────────────────────────────────────────────────
//
// The existing "quiet" flag is reactive: it fires once a client has already
// stopped showing up for 3+ days. By then the conversation is a recovery
// conversation.
//
// These signals are predictive — they look at the *shape* of someone's
// activity rather than just the last timestamp, so a client who is drifting
// surfaces while they're still engaged. That's what makes 20 clients feel
// individually noticed instead of individually chased.

export interface ActivityStamps {
  userId: string;
  name: string;
  /** ISO timestamps of any logged activity — check-ins, training, meals. */
  stamps: string[];
  /** Chronological weight readings, oldest first. */
  weights?: { date: string; kg: number }[];
}

export type WarningKind = "streak-break" | "cadence-drift" | "weight-stall" | "fading";

export interface EarlyWarning {
  userId: string;
  name: string;
  kind: WarningKind;
  /** Plain-English, coach-facing. Written to be read aloud or skimmed. */
  message: string;
  /** 1 = watch, 2 = worth a nudge, 3 = act today. */
  severity: 1 | 2 | 3;
}

const DAY = 86400000;

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
}

/** Count distinct active days within a [from, to) window measured in days ago. */
function activeDaysBetween(stamps: string[], fromDaysAgo: number, toDaysAgo: number): number {
  const days = new Set<string>();
  for (const s of stamps) {
    const d = daysAgo(s);
    if (d >= toDaysAgo && d < fromDaysAgo) days.add(new Date(s).toISOString().slice(0, 10));
  }
  return days.size;
}

/**
 * Detects a client losing momentum *before* they go fully quiet.
 * Returns at most one warning per client — the most severe — so the briefing
 * stays short and never nags twice about the same person.
 */
export function detectEarlyWarnings(clients: ActivityStamps[]): EarlyWarning[] {
  const out: EarlyWarning[] = [];

  for (const c of clients) {
    if (c.stamps.length === 0) continue; // brand new / never active — handled by the existing pending & quiet logic

    const mostRecent = Math.min(...c.stamps.map(daysAgo));

    // Already fully quiet (3+ days) — the existing reactive flag owns this
    // case, so don't duplicate it in the early-warning list.
    if (mostRecent >= 3) continue;

    const thisWeek = activeDaysBetween(c.stamps, 7, 0);
    const lastWeek = activeDaysBetween(c.stamps, 14, 7);
    const last3 = activeDaysBetween(c.stamps, 3, 0);

    const candidates: EarlyWarning[] = [];

    // 1. Streak break — was consistent, has just started missing days.
    if (lastWeek >= 5 && last3 <= 1) {
      candidates.push({
        userId: c.userId,
        name: c.name,
        kind: "streak-break",
        severity: 3,
        message: `${c.name} was logging almost daily last week but has only been active ${last3} of the last 3 days — the streak is breaking now, not later.`,
      });
    }

    // 2. Cadence drift — meaningfully less active than their own baseline.
    if (lastWeek >= 4 && thisWeek < lastWeek - 1) {
      candidates.push({
        userId: c.userId,
        name: c.name,
        kind: "cadence-drift",
        severity: 2,
        message: `${c.name} is down to ${thisWeek} active days this week from ${lastWeek} last week — drifting, still reachable.`,
      });
    }

    // 3. Fading — thinning out over a fortnight without a hard stop.
    if (lastWeek >= 3 && thisWeek <= 2 && mostRecent >= 2) {
      candidates.push({
        userId: c.userId,
        name: c.name,
        kind: "fading",
        severity: 2,
        message: `${c.name} is fading — ${thisWeek} active day(s) this week, last seen ${mostRecent} day(s) ago.`,
      });
    }

    // 4. Weight stall — three weeks of readings with no meaningful movement.
    const w = (c.weights ?? []).filter((x) => daysAgo(x.date) <= 21);
    if (w.length >= 3) {
      const first = w[0].kg;
      const last = w[w.length - 1].kg;
      if (Math.abs(last - first) < 0.5) {
        candidates.push({
          userId: c.userId,
          name: c.name,
          kind: "weight-stall",
          severity: 1,
          message: `${c.name}'s weight has sat within half a kilo for three weeks (${first}kg → ${last}kg) — worth reviewing intake or the programme block.`,
        });
      }
    }

    if (candidates.length) {
      candidates.sort((a, b) => b.severity - a.severity);
      out.push(candidates[0]);
    }
  }

  return out.sort((a, b) => b.severity - a.severity);
}
