import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ANSWER_LATEST_INSTRUCTION,
  FUEL_NOTICE_PREFIX,
  UNANSWERED_AFTER_MS,
  draftsTableMissing,
  messagesForModel,
  openClientMessages,
  overdueClientMessages,
  reviewDraft,
  reviewStoreFromSupabase,
  type CoachDraft,
  type DraftReviewStore,
  type ThreadMessage,
} from "./replies";

const ED = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DRAFT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const KNEE_AT = "2026-10-12T18:13:50.592Z";
const HOUR = 60 * 60 * 1000;

function msg(partial: Partial<ThreadMessage> & Pick<ThreadMessage, "id" | "role" | "content" | "createdAt">): ThreadMessage {
  return { userId: ED, ...partial };
}

function memoryReview(initial: CoachDraft | null) {
  const messages: Array<{ id: string; user_id: string; role: "assistant"; content: string }> = [];
  let draft = initial;
  let seq = 0;
  const store: DraftReviewStore = {
    async getDraft(id) {
      if (!draft || draft.id !== id) return null;
      return { ...draft };
    },
    async settle(id, patch) {
      if (!draft || draft.id !== id || draft.status !== "pending") return false;
      draft = { ...draft, status: patch.status, content: patch.content };
      return true;
    },
    async insertCoachMessage(userId, content) {
      seq += 1;
      const row = { id: `sent-${seq}`, user_id: userId, role: "assistant" as const, content };
      messages.push(row);
      return { id: row.id };
    },
    async deleteCoachMessage(id) {
      const index = messages.findIndex((row) => row.id === id);
      if (index >= 0) messages.splice(index, 1);
    },
  };
  return { messages, store, current: () => draft };
}

describe("coach reply drafts", () => {
  it("joins consecutive client messages so the model still sees the latest one", () => {
    const turns = messagesForModel(
      [
        { role: "user", content: "What's a gillotine press" },
        { role: "user", content: "What good days can I have to get calories up" },
        { role: "assistant", content: "The guillotine press is a neck press." },
        { role: "user", content: "What good fats" },
      ],
      "Not been doing the cardio block as knee, just light bike",
    );
    assert.deepEqual(turns.map((turn) => turn.role), ["user", "assistant", "user"]);
    assert.match(turns[0].content, /gillotine press/);
    assert.match(turns[0].content, /calories up/);
    assert.match(turns[2].content, /good fats/);
    assert.match(turns[2].content, /light bike/);
    assert.equal(turns[turns.length - 1].role, "user");
  });

  it("drops a leading coach message and ignores blank turns", () => {
    const turns = messagesForModel(
      [
        { role: "assistant", content: "Earlier note" },
        { role: "user", content: "   " },
      ],
      "  What's high carb low fat food  ",
    );
    assert.deepEqual(turns, [{ role: "user", content: "What's high carb low fat food" }]);
  });

  it("flags a client message that has had no real reply for 24 hours", () => {
    const fuel = `${FUEL_NOTICE_PREFIX} for Monday. Your full macro breakdown is on the Fuel tab.`;
    const rows = [
      msg({ id: "knee", role: "user", content: "Not been doing the cardio block as knee, just light bike", createdAt: KNEE_AT }),
      msg({ id: "fuel", role: "assistant", content: fuel, createdAt: "2026-10-12T19:29:50.751Z" }),
    ];
    const justBefore = Date.parse(KNEE_AT) + UNANSWERED_AFTER_MS - 1000;
    assert.equal(overdueClientMessages(rows, justBefore).length, 0);

    const overdue = overdueClientMessages(rows, Date.parse(KNEE_AT) + 25 * HOUR);
    assert.equal(overdue.length, 1);
    assert.equal(overdue[0]?.messageId, "knee");
    assert.equal(overdue[0]?.overdue, true);
  });

  it("does not treat a later answer, or a fuel notice, as a reply to an earlier message", () => {
    const rows = [
      msg({ id: "knee", role: "user", content: "Knee is sore", createdAt: KNEE_AT }),
      msg({ id: "fuel", role: "assistant", content: `${FUEL_NOTICE_PREFIX} for Monday.`, createdAt: "2026-10-12T19:29:50.751Z" }),
      msg({ id: "carb", role: "user", content: "What's high carb low fat food", createdAt: "2026-10-13T19:26:05.659Z" }),
      msg({ id: "reply", role: "assistant", content: "Rice, oats, potato, fruit.", createdAt: "2026-10-13T19:26:19.550Z" }),
    ];
    const now = Date.parse("2026-10-21T12:00:00.000Z");
    const open = openClientMessages(rows, now);
    assert.deepEqual(open.map((row) => row.messageId), ["knee"]);
    assert.equal(open[0]?.overdue, true);

    const answered = openClientMessages([
      msg({ id: "knee", role: "user", content: "Knee is sore", createdAt: KNEE_AT }),
      msg({ id: "coach", role: "assistant", content: "Leave legs today.", createdAt: "2026-10-12T19:00:00.000Z" }),
    ], now);
    assert.deepEqual(answered, []);
  });

  it("keeps every trailing client message open until something answers the thread", () => {
    const rows = [
      msg({ id: "a", role: "user", content: "First", createdAt: "2026-10-01T00:00:00.000Z" }),
      msg({ id: "b", role: "assistant", content: "Reply to first", createdAt: "2026-10-01T00:01:00.000Z" }),
      msg({ id: "c", role: "user", content: "Second", createdAt: "2026-10-02T00:00:00.000Z" }),
      msg({ id: "d", role: "user", content: "Third", createdAt: "2026-10-03T00:00:00.000Z" }),
    ];
    const open = openClientMessages(rows, Date.parse("2026-10-03T12:00:00.000Z"));
    assert.deepEqual(open.map((row) => row.messageId), ["c", "d"]);
    assert.equal(open[0]?.overdue, true);
    assert.equal(open[1]?.overdue, false);
  });

  it("recognises a missing drafts table", () => {
    assert.equal(draftsTableMissing(null), false);
    assert.equal(draftsTableMissing({ code: "42501", message: "permission denied" }), false);
    assert.equal(draftsTableMissing({ code: "PGRST205", message: "Could not find the table" }), true);
    assert.equal(draftsTableMissing({ message: "relation coach_reply_drafts does not exist" }), true);
  });

  it("approves a draft into one coach message and uses Nick's edit", async () => {
    const { messages, store, current } = memoryReview({
      id: DRAFT,
      userId: ED,
      content: "Rest the knee today.",
      status: "pending",
    });
    const result = await reviewDraft(store, {
      id: DRAFT,
      action: "approve",
      content: "  Leave legs today. Upper body, then ice the knee.  ",
    });
    assert.deepEqual(result, {
      ok: true,
      status: "approved",
      messageId: "sent-1",
      userId: ED,
      content: "Leave legs today. Upper body, then ice the knee.",
    });
    assert.deepEqual(messages, [{
      id: "sent-1",
      user_id: ED,
      role: "assistant",
      content: "Leave legs today. Upper body, then ice the knee.",
    }]);
    assert.equal(current()?.status, "approved");
  });

  it("discards without writing a coach message", async () => {
    const { messages, store, current } = memoryReview({
      id: DRAFT,
      userId: ED,
      content: "Rest the knee today.",
      status: "pending",
    });
    const result = await reviewDraft(store, { id: DRAFT, action: "discard" });
    assert.deepEqual(result, { ok: true, status: "discarded" });
    assert.equal(messages.length, 0);
    assert.equal(current()?.status, "discarded");
  });

  it("does not send a second coach message when the draft was already reviewed", async () => {
    const { messages, store } = memoryReview({
      id: DRAFT,
      userId: ED,
      content: "Rest the knee today.",
      status: "approved",
    });
    const result = await reviewDraft(store, { id: DRAFT, action: "approve" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.http, 409);
    assert.equal(messages.length, 0);
  });

  it("removes the coach message if the draft was claimed first", async () => {
    const pending: CoachDraft = { id: DRAFT, userId: ED, content: "Rest the knee.", status: "pending" };
    let claimed = false;
    const messages: string[] = [];
    const store: DraftReviewStore = {
      async getDraft() {
        return { ...pending };
      },
      async settle() {
        if (claimed) return false;
        claimed = true;
        return false;
      },
      async insertCoachMessage(_userId, content) {
        messages.push(content);
        return { id: "orphan" };
      },
      async deleteCoachMessage() {
        messages.splice(0, messages.length);
      },
    };
    const result = await reviewDraft(store, { id: DRAFT, action: "approve" });
    assert.equal(result.ok, false);
    assert.deepEqual(messages, []);
  });

  it("writes an assistant message with the service-role shape used by message-client", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const updates: Array<Record<string, unknown>> = [];
    const client = {
      from(table: string) {
        return {
          select() {
            return {
              eq() {
                return {
                  limit: async () => ({
                    data: table === "coach_reply_drafts"
                      ? [{ id: DRAFT, user_id: ED, content: "Draft text", status: "pending" }]
                      : [],
                    error: null,
                  }),
                };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            updates.push(patch);
            return {
              eq() {
                return {
                  eq() {
                    return {
                      select: async () => ({ data: [{ id: DRAFT }], error: null }),
                    };
                  },
                };
              },
            };
          },
          insert(row: Record<string, unknown>) {
            inserted.push(row);
            return {
              select() {
                return { single: async () => ({ data: { id: "msg-1" }, error: null }) };
              },
            };
          },
          delete() {
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    };

    const result = await reviewDraft(reviewStoreFromSupabase(client), { id: DRAFT, action: "approve" });
    assert.equal(result.ok, true);
    assert.deepEqual(inserted, [{ user_id: ED, role: "assistant", content: "Draft text" }]);
    assert.equal(updates[0]?.status, "approved");
    assert.equal(updates[0]?.sent_message_id, "msg-1");
    assert.equal(typeof updates[0]?.reviewed_at, "string");
  });

  it("keeps the live coach-message route, and the Edge route saves a draft before it responds", () => {
    const edge = readFileSync(new URL("../../app/api/edge/route.ts", import.meta.url), "utf8");
    const coach = readFileSync(new URL("../../app/api/coach/message/route.ts", import.meta.url), "utf8");
    assert.match(edge, /messagesForModel/);
    assert.match(edge, /ANSWER_LATEST_INSTRUCTION/);
    assert.match(edge, /createServiceClient/);
    assert.match(edge, /coach_reply_drafts/);
    assert.equal(edge.includes("ReadableStream"), false);
    assert.equal(edge.includes("controller.close"), false);
    assert.equal(edge.includes(ANSWER_LATEST_INSTRUCTION), false);
    const draftAt = edge.indexOf('from("coach_reply_drafts")');
    const okAt = edge.indexOf("drafted: true");
    assert.ok(draftAt > 0 && okAt > draftAt);

    assert.match(coach, /handleCoachMessage/);
    assert.match(coach, /insertMessage/);
    assert.equal(coach.includes("coach_reply_drafts"), false);
  });
});
