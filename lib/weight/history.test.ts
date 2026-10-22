import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  addDays,
  addMonths,
  filterByRange,
  formatChange,
  formatDisplayDate,
  formatKg,
  normaliseWeighIns,
  prepareWeightHistory,
  round1,
  weeklyChangeKg,
} from "./history";
import { SAMPLE_TODAY, SAMPLE_WEIGH_INS } from "./sample";

const TODAY = "2026-10-22";

describe("weigh-in dates", () => {
  it("shifts by days and calendar months without slipping the day", () => {
    assert.equal(addDays(TODAY, -28), "2026-09-24");
    assert.equal(addMonths(TODAY, -3), "2026-07-22");
    assert.equal(addMonths("2026-05-31", -3), "2026-02-28");
    assert.equal(addMonths("2024-03-31", -1), "2024-02-29");
  });

  it("formats a calendar date in UTC so it does not become the day before", () => {
    assert.equal(formatDisplayDate("2026-10-21", true), "Wed, 21 Oct 2026");
    assert.equal(formatKg(86.76), "86.8");
    assert.equal(formatChange(-1.14), "-1.1");
    assert.equal(formatChange(0.04), "0.0");
    assert.equal(formatChange(0.4), "+0.4");
    assert.equal(round1(-0.05), -0.1);
  });
});

describe("normalise weigh-ins", () => {
  it("keeps one finite weight per day, last row wins, oldest first", () => {
    const rows = normaliseWeighIns([
      { date: "2026-10-14", weight_kg: "87.10" },
      { date: "2026-10-07T08:00:00Z", kg: 87.5 },
      { date: "2026-10-14", weight_kg: 87.4 },
      { date: "2026-10-01", kg: null },
      { date: "nope", kg: 80 },
      { date: "2026-10-02", kg: 0 },
      { date: "2026-10-03", kg: -4 },
      { date: "2026-10-04", kg: 900 },
    ]);
    assert.deepEqual(rows, [
      { date: "2026-10-07", kg: 87.5 },
      { date: "2026-10-14", kg: 87.4 },
    ]);
  });
});

describe("history", () => {
  const history = prepareWeightHistory(SAMPLE_WEIGH_INS, SAMPLE_TODAY);

  it("summarises start, current, total, and the last 4 weeks", () => {
    assert.equal(history.entries.length, 15);
    assert.equal(history.summary?.startKg, 92.4);
    assert.equal(history.summary?.currentKg, 86.8);
    assert.equal(formatChange(history.summary!.totalChangeKg), "-5.6");
    // 87.9 on 30 Sep → 86.8 on 21 Oct is 21 days, −1.1 kg → −0.366… kg/week.
    assert.equal(formatChange(history.summary!.weeklyChangeKg!), "-0.4");
  });

  it("lists every weigh-in newest first, with both changes", () => {
    assert.equal(history.rows.length, 15);
    assert.equal(history.rows[0].date, "2026-10-21");
    assert.equal(formatChange(history.rows[0].sincePreviousKg!), "-0.3");
    assert.equal(formatChange(history.rows[0].sinceFirstKg), "-5.6");
    const first = history.rows[history.rows.length - 1];
    assert.equal(first.date, "2026-05-20");
    assert.equal(first.sincePreviousKg, null);
    assert.equal(first.sinceFirstKg, 0);
    // 23 Sep bounced up against 16 Sep.
    const bounce = history.rows.find((row) => row.date === "2026-09-23");
    assert.equal(formatChange(bounce!.sincePreviousKg!), "+0.2");
  });

  it("filters 4 weeks, 3 months, and all time, and ignores the future", () => {
    assert.deepEqual(
      filterByRange(history.entries, "4w", SAMPLE_TODAY).map((entry) => entry.date),
      ["2026-09-30", "2026-10-07", "2026-10-14", "2026-10-21"],
    );
    const threeMonths = filterByRange(history.entries, "3m", SAMPLE_TODAY);
    assert.equal(threeMonths[0].date, "2026-07-29");
    assert.equal(threeMonths.at(-1)?.date, "2026-10-21");
    assert.equal(filterByRange(history.entries, "all", SAMPLE_TODAY).length, 15);

    const withFuture = prepareWeightHistory(
      [...SAMPLE_WEIGH_INS, { date: "2026-11-02", kg: 80 }],
      SAMPLE_TODAY,
    );
    assert.equal(withFuture.summary?.currentKg, 86.8);
    assert.equal(withFuture.entries.some((entry) => entry.date === "2026-11-02"), false);
  });

  it("has no weekly rate until two different days fall inside the last 4 weeks", () => {
    assert.equal(weeklyChangeKg([{ date: "2026-10-21", kg: 86.8 }], TODAY), null);
    assert.equal(
      weeklyChangeKg(
        [
          { date: "2026-08-01", kg: 90 },
          { date: "2026-10-21", kg: 86 },
        ],
        TODAY,
      ),
      null,
    );
    assert.equal(prepareWeightHistory([], TODAY).summary, null);
    assert.equal(prepareWeightHistory([{ date: "2026-10-21", kg: 86.8 }], TODAY).rows.length, 1);
  });
});

describe("weight tracker is wired to check-ins", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("loads every check-in weigh-in for the client and the coach", () => {
    const progress = read("app/(app)/progress/page.tsx");
    const coach = read("app/admin/users/[id]/page.tsx");
    for (const source of [progress, coach]) {
      assert.match(source, /prepareWeightHistory/);
      assert.match(source, /WeightTracker/);
      assert.match(source, /\.from\("check_ins"\)\.select\("date, weight_kg"\)/);
      assert.match(source, /\.not\("weight_kg", "is", null\)/);
    }
    // The coach activity feed stays short. The weigh-in query must not.
    const weightQuery = coach.slice(coach.indexOf('select("date, weight_kg")'));
    assert.doesNotMatch(weightQuery.slice(0, 240), /limit\(14\)/);
    const tracker = read("components/weight/WeightTracker.tsx");
    assert.match(tracker, /WEIGHT_RANGES/);
    assert.match(tracker, /Tap a point for the exact weight and date/);
    const history = read("lib/weight/history.ts");
    assert.match(history, /4 weeks/);
    assert.match(history, /3 months/);
    assert.match(history, /All time/);
  });
});
