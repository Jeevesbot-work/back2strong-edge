import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  COACH_MESSAGE_HOURLY_LIMIT,
  COACH_MESSAGE_KEY_SHA256,
  coachStore,
  createRateLimit,
  handleCoachMessage,
  type CoachMessageStore,
} from "./message";

const USER = "11111111-1111-4111-8111-111111111111";
const COACH_KEY = "test-coach-key";
const CONTENT = "Nick says: rest day tomorrow. SECRET_PHRASE_NOT_IN_LOG";

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function approval() {
  return {
    approvedBy: "Nick",
    source: "Nick in TRA Tech chat",
    approvedAt: "2026-10-07T10:00:00.000Z",
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER,
    content: CONTENT,
    idempotencyKey: "idem-1",
    approval: approval(),
    ...overrides,
  };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/coach/message", {
    method: "POST",
    headers: {
      authorization: `Bearer ${COACH_KEY}`,
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function memoryStore() {
  const profiles = new Set<string>([USER]);
  const messages: Array<{ id: string; user_id: string; role: "assistant"; content: string; created_at: string }> = [];
  const sinceSeen: string[] = [];
  let seq = 0;
  const store: CoachMessageStore = {
    async profileExists(userId) {
      return profiles.has(userId);
    },
    async findRecentDuplicate(userId, content, sinceIso) {
      sinceSeen.push(sinceIso);
      const since = Date.parse(sinceIso);
      const hit = messages.find(
        (row) => row.user_id === userId && row.role === "assistant" && row.content === content && Date.parse(row.created_at) >= since,
      );
      return hit ? { id: hit.id, created_at: hit.created_at } : null;
    },
    async insertMessage(userId, content) {
      seq += 1;
      const row = {
        id: `msg-${seq}`,
        user_id: userId,
        role: "assistant" as const,
        content,
        created_at: "2026-10-07T10:05:00.000Z",
      };
      messages.push(row);
      return { id: row.id, created_at: row.created_at };
    },
  };
  return { profiles, messages, sinceSeen, store };
}

function logsOf(run: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (line?: unknown) => {
    lines.push(String(line));
  };
  return run().finally(() => {
    console.log = original;
  }).then(() => lines);
}

describe("coach message", { concurrency: false }, () => {
  it("rejects a missing or wrong key with a bare 404 and ignores the admin cookie", async () => {
    process.env.COACH_MESSAGE_KEY_SHA256 = hash(COACH_KEY);
    process.env.ADMIN_ACCESS_KEY = "admin-key-should-not-work";
    const { messages, store } = memoryStore();
    const lines = await logsOf(async () => {
      const missing = await handleCoachMessage(request(payload(), { authorization: "" }), store, { rateLimit: createRateLimit() });
      assert.equal(missing.status, 404);
      assert.equal(await missing.text(), "Not found");

      const wrong = await handleCoachMessage(
        request(payload(), {
          authorization: "Bearer nope",
          cookie: "b2s_admin_session=admin-key-should-not-work",
        }),
        store,
        { rateLimit: createRateLimit() },
      );
      assert.equal(wrong.status, 404);
      assert.equal(await wrong.text(), "Not found");
    });
    assert.equal(messages.length, 0);
    assert.equal(lines.length, 2);
    for (const line of lines) {
      const entry = JSON.parse(line);
      assert.equal(entry.event, "coach_message");
      assert.equal(entry.result, "unauthorised");
      assert.equal(line.includes("nope"), false);
      assert.equal(line.includes("admin-key-should-not-work"), false);
      assert.equal(line.includes(CONTENT), false);
    }
  });

  it("does not accept the admin key or the admin cookie as authorisation", async () => {
    process.env.COACH_MESSAGE_KEY_SHA256 = hash(COACH_KEY);
    process.env.ADMIN_ACCESS_KEY = "admin-key-should-not-work";
    const { messages, store } = memoryStore();
    const res = await handleCoachMessage(
      request(payload(), {
        authorization: "Bearer admin-key-should-not-work",
        cookie: "b2s_admin_session=admin-key-should-not-work",
      }),
      store,
      { rateLimit: createRateLimit() },
    );
    assert.equal(res.status, 404);
    assert.equal(await res.text(), "Not found");
    assert.equal(messages.length, 0);
    delete process.env.COACH_MESSAGE_KEY_SHA256;
    const fallback = await handleCoachMessage(
      request(payload(), { authorization: "Bearer admin-key-should-not-work" }),
      store,
      { rateLimit: createRateLimit() },
    );
    assert.equal(fallback.status, 404);
    process.env.COACH_MESSAGE_KEY_SHA256 = hash(COACH_KEY);
  });

  it("returns 400 when the body is incomplete, and keeps the content otherwise unchanged", async () => {
    process.env.COACH_MESSAGE_KEY_SHA256 = hash(COACH_KEY);
    const { messages, store } = memoryStore();
    const cases = [
      {},
      payload({ userId: "not-a-uuid" }),
      payload({ content: "   " }),
      payload({ content: "x".repeat(4001) }),
      payload({ idempotencyKey: "" }),
      payload({ approval: { approvedBy: "Nick", source: "Nick via Grok Bot relay" } }),
      payload({ approval: { ...approval(), approvedAt: "yesterday" } }),
    ];
    for (const body of cases) {
      const res = await handleCoachMessage(request(body), store, { rateLimit: createRateLimit() });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /required/);
    }
    assert.equal(messages.length, 0);

    const spaced = "  Line one.\n\n  Still  two spaces.  ";
    const res = await handleCoachMessage(request(payload({ content: spaced })), store, { rateLimit: createRateLimit() });
    assert.equal(res.status, 200);
    assert.equal(messages[0]?.content, "Line one.\n\n  Still  two spaces.");
  });

  it("returns the existing assistant message when the same content was sent in the last 24h", async () => {
    process.env.COACH_MESSAGE_KEY_SHA256 = hash(COACH_KEY);
    const { messages, sinceSeen, store } = memoryStore();
    messages.push({
      id: "already",
      user_id: USER,
      role: "assistant",
      content: CONTENT,
      created_at: new Date().toISOString(),
    });
    const res = await handleCoachMessage(request(payload()), store, { rateLimit: createRateLimit(), now: Date.now() });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.deepEqual(json, { ok: true, duplicate: true, id: "already", created_at: messages[0].created_at });
    assert.equal(messages.length, 1);
    assert.ok(Math.abs(Date.parse(sinceSeen[0]) - (Date.now() - 24 * 60 * 60 * 1000)) < 2000);
  });

  it("inserts an assistant message for a real client and audits a hash, not the text", async () => {
    process.env.COACH_MESSAGE_KEY_SHA256 = hash(COACH_KEY);
    const inserted: Array<Record<string, unknown>> = [];
    const client = {
      from(table: string) {
        const state: { table: string; filters: Array<[string, string]>; insert?: Record<string, unknown> } = {
          table,
          filters: [],
        };
        const chain = {
          select() {
            return chain;
          },
          eq(column: string, value: string) {
            state.filters.push([column, value]);
            return chain;
          },
          gte() {
            return chain;
          },
          order() {
            return chain;
          },
          limit() {
            if (table === "profiles") return Promise.resolve({ data: [{ id: USER }], error: null });
            return Promise.resolve({ data: [], error: null });
          },
          insert(row: Record<string, unknown>) {
            state.insert = row;
            inserted.push(row);
            return {
              select() {
                return {
                  single: async () => ({ data: { id: "new-id", created_at: "2026-10-07T10:05:00.000Z" }, error: null }),
                };
              },
            };
          },
        };
        return chain;
      },
    };
    const lines = await logsOf(async () => {
      const res = await handleCoachMessage(
        request(payload({ content: `  ${CONTENT}  `, idempotencyKey: "idem-success" })),
        coachStore(client as never),
        { rateLimit: createRateLimit() },
      );
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true, id: "new-id", created_at: "2026-10-07T10:05:00.000Z" });
    });
    assert.deepEqual(inserted, [{ user_id: USER, role: "assistant", content: CONTENT }]);
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.event, "coach_message");
    assert.equal(entry.userId, USER);
    assert.equal(entry.id, "new-id");
    assert.equal(entry.contentSha256, hash(CONTENT));
    assert.equal(entry.contentLength, CONTENT.length);
    assert.equal(entry.idempotencyKey, "idem-success");
    assert.equal(entry.approval.source, "Nick in TRA Tech chat");
    assert.equal(entry.result, "inserted");
    assert.equal(lines[0].includes(CONTENT), false);
    assert.equal(lines[0].includes(COACH_KEY), false);
  });

  it("returns 404 when the client is not in profiles, and 429 after 20 sends", async () => {
    process.env.COACH_MESSAGE_KEY_SHA256 = hash(COACH_KEY);
    const missing = memoryStore();
    missing.profiles.delete(USER);
    const gone = await handleCoachMessage(request(payload()), missing.store, { rateLimit: createRateLimit() });
    assert.equal(gone.status, 404);
    assert.deepEqual(await gone.json(), { error: "client not found" });

    const { messages, store } = memoryStore();
    const limit = createRateLimit(COACH_MESSAGE_HOURLY_LIMIT);
    for (let i = 0; i < COACH_MESSAGE_HOURLY_LIMIT; i += 1) {
      const res = await handleCoachMessage(request(payload({ content: `Message ${i}`, idempotencyKey: `k-${i}` })), store, {
        rateLimit: limit,
      });
      assert.equal(res.status, 200);
    }
    const blocked = await handleCoachMessage(request(payload({ content: "one more", idempotencyKey: "k-extra" })), store, {
      rateLimit: limit,
    });
    assert.equal(blocked.status, 429);
    assert.equal(messages.length, COACH_MESSAGE_HOURLY_LIMIT);
  });

  it("keeps the route off the admin middleware and commits only the key hash", () => {
    const middleware = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8");
    const route = readFileSync(new URL("../../app/api/coach/message/route.ts", import.meta.url), "utf8");
    const lib = readFileSync(new URL("./message.ts", import.meta.url), "utf8");
    assert.match(middleware, /matcher:\s*\["\/", "\/admin", "\/admin\/:path\*", "\/api\/admin\/:path\*"\]/);
    assert.equal(middleware.includes("/api/coach"), false);
    assert.equal(route.includes("ADMIN_ACCESS_KEY"), false);
    assert.equal(route.includes("b2s_admin_session"), false);
    assert.equal(route.includes("cookies("), false);
    assert.equal(lib.includes(COACH_MESSAGE_KEY_SHA256), true);
    assert.equal(COACH_MESSAGE_KEY_SHA256, "d053bfed99ba7d4acf87bfd2c9bb5c5a821b8c18d168b897a0a5992183c447bb");
    assert.equal(lib.includes("ADMIN_ACCESS_KEY"), false);
  });
});
