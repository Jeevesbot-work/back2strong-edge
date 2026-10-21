/**
 * Coach-reply drafts and the "left unanswered" flag.
 *
 * A client message is written first. The model reply is stored in
 * coach_reply_drafts (service role) and only becomes a messages row when
 * Nick approves it. Fuel-tab notices are assistant rows too, but they are
 * not a reply to what the client just asked.
 */

export const UNANSWERED_AFTER_MS = 24 * 60 * 60 * 1000;

/** Written by /api/admin/fuel-report. Not a reply to the client's chat. */
export const FUEL_NOTICE_PREFIX = "Nick's reviewed your food";

/** Appended to the Edge system prompt so a backlog is not answered instead. */
export const ANSWER_LATEST_INSTRUCTION =
  "Answer the client's latest message. Earlier messages are context only — do not answer an older message instead of the latest one.";

export const DRAFT_CONTENT_MAX = 4000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ModelTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ThreadMessage {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface OpenClientMessage {
  messageId: string;
  userId: string;
  content: string;
  createdAt: string;
  ageMs: number;
  overdue: boolean;
}

export function isFuelNotice(content: string): boolean {
  return content.trimStart().startsWith(FUEL_NOTICE_PREFIX);
}

export function replyAgeLabel(ageMs: number): string {
  const minutes = Math.max(0, Math.floor(ageMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Anthropic requires user/assistant turns to alternate, starting and ending
 * with user. Consecutive client messages (a reply was never stored) are
 * joined into one user turn so the latest text is still what gets answered.
 */
export function messagesForModel(history: ModelTurn[], latest: string): ModelTurn[] {
  const rows: ModelTurn[] = [];
  const incoming: ModelTurn[] = [...history, { role: "user", content: latest }];
  for (const turn of incoming) {
    if (turn.role !== "user" && turn.role !== "assistant") continue;
    const content = turn.content.trim();
    if (!content) continue;
    const prev = rows[rows.length - 1];
    if (prev && prev.role === turn.role) {
      prev.content = `${prev.content}\n\n${content}`;
    } else {
      rows.push({ role: turn.role, content });
    }
  }
  while (rows[0]?.role === "assistant") rows.shift();
  if (rows.length === 0 || rows[rows.length - 1].role !== "user") {
    const fallback = latest.trim() || "Hello";
    rows.push({ role: "user", content: fallback });
  }
  return rows;
}

/**
 * Client messages with no real coach reply before the next client message.
 * A fuel-tab notice does not count. A later reply to a newer question does
 * not close an earlier one — Ed's 12 Oct knee message stayed open after the
 * 13 Oct carb answer.
 */
export function openClientMessages(
  messages: ThreadMessage[],
  now: number,
  thresholdMs = UNANSWERED_AFTER_MS,
): OpenClientMessage[] {
  const byUser = new Map<string, ThreadMessage[]>();
  for (const message of messages) {
    const list = byUser.get(message.userId) ?? [];
    list.push(message);
    byUser.set(message.userId, list);
  }

  const open: OpenClientMessage[] = [];
  for (const rows of Array.from(byUser.values())) {
    const sorted = [...rows].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    for (let i = 0; i < sorted.length; i += 1) {
      const row = sorted[i];
      if (row.role !== "user") continue;
      const at = Date.parse(row.createdAt);
      if (!Number.isFinite(at)) continue;
      let answered = false;
      for (let j = i + 1; j < sorted.length; j += 1) {
        const next = sorted[j];
        if (next.role === "user") break;
        if (next.role === "assistant" && !isFuelNotice(next.content)) {
          answered = true;
          break;
        }
      }
      if (answered) continue;
      const ageMs = Math.max(0, now - at);
      open.push({
        messageId: row.id,
        userId: row.userId,
        content: row.content,
        createdAt: row.createdAt,
        ageMs,
        overdue: ageMs >= thresholdMs,
      });
    }
  }

  return open.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function overdueClientMessages(
  messages: ThreadMessage[],
  now: number,
  thresholdMs = UNANSWERED_AFTER_MS,
): OpenClientMessage[] {
  return openClientMessages(messages, now, thresholdMs).filter((row) => row.overdue);
}

export function draftsTableMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "PGRST204") return true;
  return /coach_reply_drafts/i.test(error.message ?? "");
}

export interface CoachDraft {
  id: string;
  userId: string;
  content: string;
  status: "pending" | "approved" | "discarded";
}

export interface DraftReviewStore {
  getDraft(id: string): Promise<CoachDraft | null>;
  /** Updates a row that is still pending. False when another review won. */
  settle(
    id: string,
    patch: { status: "approved" | "discarded"; content: string; sentMessageId: string | null },
  ): Promise<boolean>;
  insertCoachMessage(userId: string, content: string): Promise<{ id: string }>;
  deleteCoachMessage(id: string): Promise<void>;
}

export type ReviewResult =
  | { ok: true; status: "approved"; messageId: string; userId: string; content: string }
  | { ok: true; status: "discarded" }
  | { ok: false; error: string; http: 400 | 404 | 409 };

export interface ReviewInput {
  id?: unknown;
  action?: unknown;
  content?: unknown;
}

export async function reviewDraft(store: DraftReviewStore, input: ReviewInput): Promise<ReviewResult> {
  if (typeof input.id !== "string" || !UUID.test(input.id)) {
    return { ok: false, error: "Draft id is required", http: 400 };
  }
  if (input.action !== "approve" && input.action !== "discard") {
    return { ok: false, error: "action must be approve or discard", http: 400 };
  }

  const draft = await store.getDraft(input.id);
  if (!draft) return { ok: false, error: "Draft not found", http: 404 };
  if (draft.status !== "pending") return { ok: false, error: "Draft already reviewed", http: 409 };

  if (input.action === "discard") {
    const won = await store.settle(input.id, {
      status: "discarded",
      content: draft.content,
      sentMessageId: null,
    });
    if (!won) return { ok: false, error: "Draft already reviewed", http: 409 };
    return { ok: true, status: "discarded" };
  }

  const content = (typeof input.content === "string" ? input.content : draft.content).trim();
  if (!content || content.length > DRAFT_CONTENT_MAX) {
    return { ok: false, error: `Reply must be between 1 and ${DRAFT_CONTENT_MAX} characters`, http: 400 };
  }

  const message = await store.insertCoachMessage(draft.userId, content);
  const won = await store.settle(input.id, {
    status: "approved",
    content,
    sentMessageId: message.id,
  });
  if (!won) {
    await store.deleteCoachMessage(message.id);
    return { ok: false, error: "Draft already reviewed", http: 409 };
  }
  return { ok: true, status: "approved", messageId: message.id, userId: draft.userId, content };
}

interface DraftDbRow {
  id?: unknown;
  user_id?: unknown;
  content?: unknown;
  status?: unknown;
}

function asDraft(row: DraftDbRow | null | undefined): CoachDraft | null {
  if (!row || typeof row.id !== "string" || typeof row.user_id !== "string" || typeof row.content !== "string") {
    return null;
  }
  if (row.status !== "pending" && row.status !== "approved" && row.status !== "discarded") return null;
  return { id: row.id, userId: row.user_id, content: row.content, status: row.status };
}

type QueryError = { message: string } | null;

interface DraftQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      limit: (count: number) => PromiseLike<{ data: DraftDbRow[] | null; error: QueryError }>;
    };
  };
  update: (patch: { status: string; content: string; sent_message_id: string | null; reviewed_at: string }) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        select: (columns: string) => PromiseLike<{ data: Array<{ id: string }> | null; error: QueryError }>;
      };
    };
  };
  insert: (row: { user_id: string; role: "assistant"; content: string }) => {
    select: (columns: string) => {
      single: () => Promise<{ data: { id: string } | null; error: QueryError }>;
    };
  };
  delete: () => {
    eq: (column: string, value: string) => Promise<{ error: QueryError }>;
  };
}

/** Service-role adapter. Approved drafts are inserted like /api/admin/message-client. */
export function reviewStoreFromSupabase(client: { from: (table: string) => DraftQuery }): DraftReviewStore {
  return {
    async getDraft(id) {
      const { data, error } = await client
        .from("coach_reply_drafts")
        .select("id, user_id, content, status")
        .eq("id", id)
        .limit(1);
      if (error) throw new Error(error.message);
      return asDraft(Array.isArray(data) ? data[0] : null);
    },
    async settle(id, patch) {
      const { data, error } = await client
        .from("coach_reply_drafts")
        .update({
          status: patch.status,
          content: patch.content,
          sent_message_id: patch.sentMessageId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (error) throw new Error(error.message);
      return Array.isArray(data) && data.length > 0;
    },
    async insertCoachMessage(userId, content) {
      const { data, error } = await client
        .from("messages")
        .insert({ user_id: userId, role: "assistant", content })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "coach message was not saved");
      return { id: data.id };
    },
    async deleteCoachMessage(id) {
      const { error } = await client.from("messages").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
