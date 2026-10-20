import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DUPLICATE_WINDOW_MS, foodIsDuplicate, loggedWithinWindow, sessionIsDuplicate, walkIsDuplicate } from "./duplicate";

const NOW = new Date("2026-10-15T12:00:00.000Z");

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

const chicken = { meal_name: "Chicken and rice", calories: 640, protein_g: 48, carbs_g: 55, fat_g: 18 };

describe("duplicate window", () => {
  it("treats a few seconds as the same tap, and a couple of minutes as a new entry", () => {
    assert.equal(loggedWithinWindow(ago(2_000), NOW), true);
    assert.equal(loggedWithinWindow(ago(DUPLICATE_WINDOW_MS - 1), NOW), true);
    assert.equal(loggedWithinWindow(ago(2 * 60 * 1000), NOW), false);
    assert.equal(loggedWithinWindow(ago(DUPLICATE_WINDOW_MS), NOW), false);
  });

  it("matches an identical meal inside the window only", () => {
    const recent = [{ ...chicken, created_at: ago(2_000) }];
    assert.equal(foodIsDuplicate(recent, chicken, NOW), true);
    assert.equal(foodIsDuplicate([{ ...chicken, created_at: ago(3 * 60 * 1000) }], chicken, NOW), false);
    assert.equal(foodIsDuplicate(recent, { ...chicken, calories: 700 }, NOW), false);
    assert.equal(foodIsDuplicate(recent, { ...chicken, meal_name: "Chicken salad" }, NOW), false);
  });

  it("matches the same walk or workout, not a different one", () => {
    assert.equal(walkIsDuplicate([{ minutes: 30, created_at: ago(2_000) }], 30, NOW), true);
    assert.equal(walkIsDuplicate([{ minutes: 30, created_at: ago(2_000) }], 45, NOW), false);
    assert.equal(walkIsDuplicate([{ minutes: 30, created_at: ago(3 * 60 * 1000) }], 30, NOW), false);
    assert.equal(sessionIsDuplicate([{ session_type: "lower-a", created_at: ago(2_000) }], "lower-a", NOW), true);
    assert.equal(sessionIsDuplicate([{ session_type: "lower-a", created_at: ago(2_000) }], "upper-a", NOW), false);
    assert.equal(sessionIsDuplicate([{ session_type: "lower-a", created_at: ago(3 * 60 * 1000) }], "lower-a", NOW), false);
  });
});

describe("duplicate guard is wired", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("checks food, walks and workouts on the server before inserting", () => {
    assert.match(read("app/api/nutrition/analyze/route.ts"), /foodIsDuplicate\(/);
    assert.match(read("app/api/nutrition/describe/route.ts"), /foodIsDuplicate\(/);
    assert.match(read("app/api/nutrition/log/route.ts"), /foodIsDuplicate\(/);
    assert.match(read("app/api/walk/route.ts"), /walkIsDuplicate\(/);
    assert.match(read("app/api/train/complete/route.ts"), /sessionIsDuplicate\(/);
    // A same-request batch of two identical items still inserts both. The
    // check compares against rows already stored, not the siblings in this payload.
    const describe = read("app/api/nutrition/describe/route.ts");
    assert.match(describe, /rows\.filter\(\(row\) => !foodIsDuplicate\(recent, row, now\)\)/);
  });

  it("locks the log buttons for the whole request, not just after the next paint", () => {
    assert.match(read("components/WalkLogger.tsx"), /busyRef/);
    assert.match(read("components/ManualMealEntry.tsx"), /busyRef/);
    assert.match(read("components/ManualMealEntry.tsx"), /\/api\/nutrition\/log/);
    assert.match(read("components/fuel/TellEdge.tsx"), /busyRef/);
    const fuel = read("app/(app)/nutrition/page.tsx");
    assert.match(fuel, /loggingRef/);
    assert.match(fuel, /analysingRef/);
    assert.match(fuel, /\/api\/nutrition\/log/);
    assert.match(fuel, /disabled=\{loggingScan\}/);
    assert.match(fuel, /disabled=\{logging\}/);
    const train = read("app/(app)/train/[session]/page.tsx");
    assert.match(train, /savingRef/);
    assert.match(train, /\/api\/train\/complete/);
    assert.match(train, /disabled=\{isLast && saving\}/);
  });
});
