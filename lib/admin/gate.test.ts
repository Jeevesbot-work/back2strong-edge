import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { adminSessionAllowed, decideAdminGate } from "./gate";

const KEY = "prod-admin-key";
const ADMIN = "nick@back2strong.online";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

describe("admin gate", () => {
  it("gives an anonymous caller 404 on /admin and the admin APIs when the key is unset", () => {
    for (const pathname of ["/admin", "/admin/users/abc", "/api/admin/approve", "/api/admin/login-link", "/api/admin/message-client", "/api/admin/add-client"]) {
      const decision = decideAdminGate({
        pathname,
        accessKey: undefined,
        cookie: undefined,
        keyParam: null,
        stay: false,
        email: null,
      });
      assert.equal(decision.kind, "deny", pathname);
      if (decision.kind === "deny") assert.equal(decision.status, 404, pathname);
      assert.equal(adminSessionAllowed({ accessKey: undefined, cookie: undefined, email: null }), false, pathname);
    }
    const home = decideAdminGate({
      pathname: "/",
      accessKey: undefined,
      cookie: undefined,
      keyParam: null,
      stay: false,
      email: null,
    });
    assert.equal(home.kind, "public");
  });

  it("blocks a wrong cookie when the key is set", () => {
    const decision = decideAdminGate({
      pathname: "/admin",
      accessKey: KEY,
      cookie: "not-the-key",
      keyParam: "also-wrong",
      stay: false,
      email: null,
    });
    assert.equal(decision.kind, "deny");
    assert.equal(adminSessionAllowed({ accessKey: KEY, cookie: "not-the-key", email: null }), false);
    assert.equal(adminSessionAllowed({ accessKey: KEY, cookie: undefined, email: null }), false);
  });

  it("allows the right cookie when the key is set", () => {
    const page = decideAdminGate({
      pathname: "/admin",
      accessKey: KEY,
      cookie: KEY,
      keyParam: null,
      stay: false,
      email: null,
    });
    assert.equal(page.kind, "next");
    const api = decideAdminGate({
      pathname: "/api/admin/approve",
      accessKey: KEY,
      cookie: KEY,
      keyParam: null,
      stay: false,
      email: null,
    });
    assert.equal(api.kind, "next");
    assert.equal(adminSessionAllowed({ accessKey: KEY, cookie: KEY, email: null }), true);
  });

  it("still lets a signed-in admin email in when the key is unset, and does not treat an empty key as a match", () => {
    assert.equal(adminSessionAllowed({ accessKey: undefined, cookie: undefined, email: ADMIN }), true);
    assert.equal(adminSessionAllowed({ accessKey: "", cookie: "", email: null }), false);
    const decision = decideAdminGate({
      pathname: "/api/admin/onboard",
      accessKey: undefined,
      cookie: undefined,
      keyParam: null,
      stay: false,
      email: "N.Adams3@iCloud.com",
    });
    assert.equal(decision.kind, "next");
  });

  it("does not fail open in middleware, the admin pages, or the admin API routes", () => {
    const middleware = readFileSync("middleware.ts", "utf8");
    assert.equal(middleware.includes("if (!accessKey) return NextResponse.next()"), false);
    assert.match(middleware, /status: decision\.status/);
    assert.match(middleware, /matcher:\s*\["\/", "\/admin", "\/admin\/:path\*", "\/api\/admin\/:path\*"\]/);

    const auth = readFileSync("lib/admin/auth.ts", "utf8");
    assert.equal(auth.includes("if (!accessKey) return true"), false);

    for (const page of [
      "app/admin/page.tsx",
      "app/admin/users/[id]/page.tsx",
      "app/admin/audits/page.tsx",
      "app/admin/users/[id]/welcome/page.tsx",
      "app/admin/recipes/page.tsx",
    ]) {
      const src = readFileSync(page, "utf8");
      assert.equal(src.includes("REQUIRE_ADMIN_LOGIN"), false, page);
      assert.match(src, /requireAdminPage/, page);
    }

    const routes = walk("app/api/admin").filter((file) => file.endsWith("route.ts"));
    assert.ok(routes.length >= 18);
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      assert.match(src, /isAuthorisedAdmin/, file);
      assert.match(src, /status:\s*401/, file);
    }
  });
});
