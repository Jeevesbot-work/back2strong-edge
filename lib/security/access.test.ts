import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  AI_DAILY_LIMITS,
  coachLimitMessage,
  foodLimitMessage,
  overDailyLimit,
  quotaFunctionMissing,
  secondsUntilUtcMidnight,
  utcDateString,
  utcDayStartIso,
} from "../ai/limits";
import { saveCompletedReply } from "../ai/persist-reply";
import { resolvePreviewTarget } from "../preview-user";

const SELF = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("preview target", () => {
  it("ignores the cookie unless the viewer is an admin with a real user id", () => {
    assert.equal(resolvePreviewTarget(SELF, OTHER, false), SELF);
    assert.equal(resolvePreviewTarget(SELF, OTHER, true), OTHER);
    assert.equal(resolvePreviewTarget(SELF, undefined, true), SELF);
    assert.equal(resolvePreviewTarget(SELF, "not-a-uuid", true), SELF);
    assert.equal(resolvePreviewTarget(SELF, "", true), SELF);
  });
});

describe("daily caps", () => {
  it("keeps the coach and food limits in one place and quotes them", () => {
    assert.equal(AI_DAILY_LIMITS.coachMessages, 15);
    assert.equal(AI_DAILY_LIMITS.foodLogs, 10);
    assert.match(coachLimitMessage(), /15 messages/);
    assert.match(foodLimitMessage(), /10 food logs/);
    assert.equal(overDailyLimit(14, 15), false);
    assert.equal(overDailyLimit(15, 15), true);
    assert.equal(overDailyLimit(9, 10), false);
    assert.equal(overDailyLimit(10, 10), true);
  });

  it("bounds a UTC day and recognises a missing quota function", () => {
    const now = new Date("2026-10-08T23:30:00.000Z");
    assert.equal(utcDayStartIso(now), "2026-10-08T00:00:00.000Z");
    assert.equal(utcDateString(now), "2026-10-08");
    assert.equal(secondsUntilUtcMidnight(now), 30 * 60);
    assert.equal(quotaFunctionMissing({ code: "PGRST202", message: "Could not find the function" }), true);
    assert.equal(quotaFunctionMissing({ message: "consume_daily_ai_use(uuid) does not exist" }), true);
    assert.equal(quotaFunctionMissing({ code: "42501", message: "permission denied" }), false);
    assert.equal(quotaFunctionMissing(null), false);
  });
});

describe("assistant reply save", () => {
  it("writes a finished reply and logs a failed insert without throwing", async () => {
    const saved: string[] = [];
    const errors: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    try {
      assert.equal(await saveCompletedReply("  Weekly review noted.  ", async (text) => {
        saved.push(text);
        return null;
      }), "saved");
      assert.deepEqual(saved, ["Weekly review noted."]);

      assert.equal(await saveCompletedReply("   ", async () => null), "empty");
      assert.equal(await saveCompletedReply("hello", async () => ({ message: "insert failed" })), "failed");
      assert.match(errors.join("\n"), /insert failed/);
      assert.doesNotMatch(errors.join("\n"), /hello/);
    } finally {
      console.error = original;
    }
  });
});

describe("security wiring", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("does not fall back to another client's programme", () => {
    const train = read("app/(app)/train/page.tsx");
    assert.equal(train.includes("BARRY_PROGRAMME"), false);
    assert.match(train, /AwaitingProgramme/);
    assert.match(read("components/AwaitingProgramme.tsx"), /Your plan is being prepared/);
  });

  it("checks the viewer before using the preview cookie on client pages", () => {
    for (const file of ["app/(app)/home/page.tsx", "app/(app)/train/page.tsx", "app/(app)/progress/page.tsx"]) {
      const src = read(file);
      assert.equal(src.includes("preview_user_id"), false, file);
      assert.match(src, /resolveActingClient/);
    }
    const loader = read("lib/data/programme-loader.ts");
    assert.match(loader, /previewing \? createAdminClient\(\)/);
    assert.doesNotMatch(loader, /ADMIN_EMAILS/);
  });

  it("requires an approved client on the AI routes and caps coach and food calls", () => {
    const guarded = [
      "app/api/edge/route.ts",
      "app/api/checkin/route.ts",
      "app/api/nutrition/analyze/route.ts",
      "app/api/nutrition/describe/route.ts",
      "app/api/nutrition/plan/route.ts",
      "app/api/nutrition/barcode/route.ts",
    ];
    for (const file of guarded) assert.match(read(file), /requireActiveClient/, file);
    assert.match(read("app/api/edge/route.ts"), /enforceDailyCap\([\s\S]*"coach"/);
    assert.match(read("app/api/nutrition/analyze/route.ts"), /enforceDailyCap\([\s\S]*"food"/);
    assert.match(read("app/api/nutrition/describe/route.ts"), /enforceDailyCap\([\s\S]*"food"/);
  });

  it("saves the coach reply before the stream closes, and the weekly review waits for it", () => {
    const edge = read("app/api/edge/route.ts");
    const saveAt = edge.indexOf("saveCompletedReply");
    const closeAt = edge.indexOf("controller.close");
    assert.ok(saveAt > 0 && closeAt > saveAt);
    assert.equal(edge.indexOf("controller.close", closeAt + 1), -1);

    const review = read("app/weekly-review/page.tsx");
    const textAt = review.indexOf("await res.text()");
    const pushAt = review.indexOf("router.push");
    assert.ok(textAt > 0 && pushAt > textAt);
  });

  it("stops anon from calling the exposed security-definer RPCs", () => {
    const sql = read("lib/supabase/migrations/0015_lock_definer_rpcs.sql");
    const live = sql.split("-- Rollback (run only to reverse")[0];
    assert.match(live, /revoke all on function public\.sync_programme_state\(\) from anon/);
    assert.match(live, /revoke all on function public\.sync_programme_state\(\) from authenticated/);
    assert.match(live, /grant execute on function public\.sync_programme_state\(\) to service_role/);
    assert.match(live, /grant execute on function public\.sync_programme_state\(\) to supabase_admin/);
    assert.match(live, /coalesce\(auth\.jwt\(\) ->> 'email', ''\) <> ''/);
    assert.doesNotMatch(live, /u\.role = 'admin'/);
    assert.match(live, /revoke all on function public\.ya_claim_athlete\(uuid\) from anon/);
    assert.match(live, /revoke all on function public\.ya_save_test_battery\(uuid, integer, jsonb\) from anon/);
    assert.match(live, /grant execute on function public\.ya_save_test_battery\(uuid, integer, jsonb\) to authenticated/);
    assert.match(sql, /Rollback/);
  });

  it("locks profile approval in the migration and does not grant it to clients", () => {
    const sql = read("lib/supabase/migrations/0014_lock_profile_and_ai_quota.sql");
    assert.match(sql, /revoke insert, update on table public\.profiles from authenticated/);
    assert.match(sql, /grant update \([\s\S]*full_name[\s\S]*calorie_target[\s\S]*\) on table public\.profiles to authenticated/);
    assert.doesNotMatch(sql, /grant update \([\s\S]*approved[\s\S]*\) on table public\.profiles to authenticated/);
    assert.match(sql, /new\.approved := false/);
    assert.match(sql, /profile column % cannot be changed/);
    assert.match(sql, /consume_daily_ai_use/);
    assert.match(sql, /grant execute on function public\.consume_daily_ai_use\(uuid, text, integer\) to service_role/);
    assert.match(sql, /service role bypasses RLS/);
    const live = sql.split("-- Rollback (run only to reverse")[0];
    assert.match(live, /grant execute on function public\.is_trusted_profile_writer\(\) to authenticated/);
    assert.doesNotMatch(live, /grant execute on function public\.is_trusted_profile_writer\(\) to anon/);
  });
});
