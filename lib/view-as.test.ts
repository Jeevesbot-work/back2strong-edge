import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ADMIN_EMAILS } from "./admin/gate";
import { resolvePreviewTarget } from "./preview-user";
import {
  VIEW_READONLY_ERROR,
  clientMutationDecision,
  clientWriteDecision,
  isPreviewableClient,
  previewStartDecision,
} from "./view-as";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLIENT_PROFILE = {
  id: CLIENT,
  email: "alex.example@example.com",
  full_name: "Alex Example",
  is_test: false,
  approved: true,
};

const WRITE_ROUTES = [
  "app/api/checkin/route.ts",
  "app/api/edge/route.ts",
  "app/api/nutrition/analyze/route.ts",
  "app/api/nutrition/describe/route.ts",
  "app/api/nutrition/log/route.ts",
  "app/api/nutrition/plan/route.ts",
  "app/api/nutrition/plan-cells/route.ts",
  "app/api/nutrition/barcode/route.ts",
  "app/api/nutrition/hero/route.ts",
  "app/api/train/complete/route.ts",
  "app/api/walk/route.ts",
  "app/api/tasks/parse/route.ts",
  "app/api/tasks/toggle/route.ts",
  "app/api/push/subscribe/route.ts",
  "app/api/profile/targets/route.ts",
  "app/api/lessons/complete/route.ts",
  "app/api/sleep/route.ts",
];

describe("who can open view-as-client", () => {
  it("refuses a non-admin, a bad id, a missing profile, a test account, and a coach login", () => {
    const anonymous = previewStartDecision({ isAdmin: false, userId: CLIENT, profile: CLIENT_PROFILE });
    assert.equal(anonymous.ok, false);
    if (!anonymous.ok) assert.equal(anonymous.status, 401);

    const badId = previewStartDecision({ isAdmin: true, userId: "not-a-uuid", profile: null });
    assert.equal(badId.ok, false);
    if (!badId.ok) assert.equal(badId.status, 400);
    const missing = previewStartDecision({ isAdmin: true, userId: CLIENT, profile: null });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.status, 404);
    const testAccount = previewStartDecision({
      isAdmin: true,
      userId: CLIENT,
      profile: { ...CLIENT_PROFILE, is_test: true },
    });
    assert.equal(testAccount.ok, false);
    if (!testAccount.ok) assert.equal(testAccount.status, 404);
    const coach = previewStartDecision({
      isAdmin: true,
      userId: CLIENT,
      profile: { ...CLIENT_PROFILE, email: ADMIN_EMAILS[0] },
    });
    assert.equal(coach.ok, false);
    if (!coach.ok) assert.equal(coach.status, 404);
    assert.equal(isPreviewableClient({ id: CLIENT, email: "nick@back2strong.online", is_test: false }), false);
    assert.equal(isPreviewableClient(null), false);

    const allowed = previewStartDecision({ isAdmin: true, userId: CLIENT, profile: CLIENT_PROFILE });
    assert.equal(allowed.ok, true);
    if (allowed.ok) {
      assert.equal(allowed.clientId, CLIENT);
      assert.equal(allowed.name, "Alex Example");
    }

    assert.equal(resolvePreviewTarget(ADMIN, CLIENT, false), ADMIN);
    assert.equal(resolvePreviewTarget(ADMIN, CLIENT, true), CLIENT);
  });
});

describe("writes while viewing", () => {
  it("rejects every client mutation for an admin who is viewing, and ignores the cookie otherwise", () => {
    const blocked = clientWriteDecision(true);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.status, 403);
      assert.equal(blocked.error, VIEW_READONLY_ERROR);
    }
    assert.equal(clientWriteDecision(false).ok, true);

    for (const pathname of ["/api/edge", "/api/checkin", "/api/nutrition/log", "/api/nutrition/plan", "/api/train/complete", "/api/walk", "/api/tasks/parse", "/api/push/subscribe"]) {
      const decision = clientMutationDecision({ method: "POST", pathname, previewId: CLIENT, isAdmin: true });
      assert.equal(decision.block, true, pathname);
      if (decision.block) assert.equal(decision.status, 403);
    }

    assert.equal(clientMutationDecision({ method: "GET", pathname: "/api/edge", previewId: CLIENT, isAdmin: true }).block, false);
    assert.equal(clientMutationDecision({ method: "POST", pathname: "/api/edge", previewId: CLIENT, isAdmin: false }).block, false);
    assert.equal(clientMutationDecision({ method: "POST", pathname: "/api/edge", previewId: undefined, isAdmin: true }).block, false);
    assert.equal(clientMutationDecision({ method: "POST", pathname: "/api/edge", previewId: "nope", isAdmin: true }).block, false);
    assert.equal(clientMutationDecision({ method: "POST", pathname: "/api/admin/set-preview", previewId: CLIENT, isAdmin: true }).block, false);
    assert.equal(clientMutationDecision({ method: "DELETE", pathname: "/api/admin/set-preview", previewId: CLIENT, isAdmin: true }).block, false);
    assert.equal(clientMutationDecision({ method: "POST", pathname: "/api/auth/login", previewId: CLIENT, isAdmin: true }).block, false);
  });

  it("stops each write route before a model call or a database write", () => {
    for (const file of WRITE_ROUTES) {
      const src = readFileSync(file, "utf8");
      const guardAt = src.indexOf("rejectIfViewing");
      assert.ok(guardAt > 0, file);
      for (const marker of ["anthropic.messages", ".insert(", ".upsert(", ".update(", ".delete("]) {
        const at = src.indexOf(marker);
        if (at === -1) continue;
        assert.ok(guardAt < at, `${file} ${marker}`);
      }
    }
  });

  it("reads a client's messages and plan without writing, notifying, or marking them seen", () => {
    for (const file of ["app/api/admin/view-as/messages/route.ts", "app/api/admin/view-as/plan/route.ts"]) {
      const src = readFileSync(file, "utf8");
      assert.match(src, /isAuthorisedAdmin/);
      assert.match(src, /resolveActingClient/);
      assert.equal(src.includes(".insert("), false, file);
      assert.equal(src.includes(".update("), false, file);
      assert.equal(src.includes(".upsert("), false, file);
      assert.equal(src.includes("anthropic"), false, file);
      assert.equal(src.includes("sendPush"), false, file);
    }
  });
});

describe("view-as wiring", () => {
  it("uses the shared admin check, validates the client, and logs the view", () => {
    const src = readFileSync("app/api/admin/set-preview/route.ts", "utf8");
    assert.match(src, /isAuthorisedAdmin/);
    assert.match(src, /previewStartDecision/);
    assert.match(src, /recordClientView/);
    assert.equal(src.includes("const ADMIN_EMAILS"), false);
    assert.equal(src.includes("generateLink"), false);
    assert.equal(src.includes("signInWithOtp"), false);
    assert.match(src, /status:\s*401/);

    const audit = readFileSync("lib/supabase/migrations/0019_client_view_audit.sql", "utf8");
    assert.match(audit, /client_view_audit/);
    assert.match(audit, /admin_id/);
    assert.match(audit, /client_id/);
    assert.match(audit, /created_at/);
    assert.match(audit, /NOT applied/);
    assert.match(audit, /revoke all on table public\.client_view_audit from anon, authenticated/);

    const banner = readFileSync("components/ViewAsBannerBar.tsx", "utf8");
    assert.match(banner, /Viewing as \{label\}, read-only/);
    assert.match(readFileSync("app/admin/CommandCentre.tsx", "utf8"), /View as client/);
    assert.match(readFileSync("app/admin/users/[id]/page.tsx", "utf8"), /View as client/);
    assert.match(readFileSync("app/(auth)/login/page.tsx", "utf8"), /emailTypoHint/);
    assert.match(readFileSync("app/(auth)/login/page.tsx", "utf8"), /Did you mean/);
  });
});
