import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * sha256 of the coach-message bearer key. The raw key is not in the repo.
 * COACH_MESSAGE_KEY_SHA256 overrides this when it is set.
 */
export const COACH_MESSAGE_KEY_SHA256 =
  "d053bfed99ba7d4acf87bfd2c9bb5c5a821b8c18d168b897a0a5992183c447bb";

export const COACH_MESSAGE_HOURLY_LIMIT = 20;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export interface CoachApproval {
  approvedBy: string;
  source: string;
  approvedAt: string;
}

export interface CoachMessageInput {
  userId: string;
  content: string;
  idempotencyKey: string;
  approval: CoachApproval;
}

export interface StoredMessage {
  id: string;
  created_at: string;
}

export interface CoachMessageStore {
  profileExists(userId: string): Promise<boolean>;
  findRecentDuplicate(userId: string, content: string, sinceIso: string): Promise<StoredMessage | null>;
  insertMessage(userId: string, content: string): Promise<StoredMessage>;
}

export function createRateLimit(max = COACH_MESSAGE_HOURLY_LIMIT, windowMs = HOUR_MS) {
  const stamps: number[] = [];
  return {
    allow(now = Date.now()): boolean {
      const cutoff = now - windowMs;
      while (stamps.length > 0 && stamps[0] < cutoff) stamps.shift();
      if (stamps.length >= max) return false;
      stamps.push(now);
      return true;
    },
  };
}

export const coachMessageRateLimit = createRateLimit();

export function expectedKeyHash(): string {
  const fromEnv = process.env.COACH_MESSAGE_KEY_SHA256?.trim().toLowerCase();
  return fromEnv || COACH_MESSAGE_KEY_SHA256;
}

/** True when sha256(presented) matches the configured hash. Length is checked before timingSafeEqual. */
export function coachKeyMatches(presented: string): boolean {
  const expectedHex = expectedKeyHash();
  if (!/^[0-9a-f]{64}$/.test(expectedHex)) return false;
  const actual = createHash("sha256").update(presented, "utf8").digest();
  const expected = Buffer.from(expectedHex, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function bearerKey(header: string | null): string {
  if (!header) return "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1].trim() ?? "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function requiredText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max) return null;
  return text;
}

export function parseCoachMessage(body: unknown): CoachMessageInput | null {
  const record = asRecord(body);
  if (!record) return null;
  const userId = requiredText(record.userId, 36);
  if (!userId || !UUID.test(userId)) return null;
  if (typeof record.content !== "string") return null;
  const content = record.content.trim();
  if (content.length < 1 || content.length > 4000) return null;
  const idempotencyKey = requiredText(record.idempotencyKey, 200);
  const approval = asRecord(record.approval);
  if (!idempotencyKey || !approval) return null;
  const approvedBy = requiredText(approval.approvedBy, 200);
  const source = requiredText(approval.source, 200);
  const approvedAt = requiredText(approval.approvedAt, 40);
  if (!approvedBy || !source || !approvedAt || !ISO.test(approvedAt) || !Number.isFinite(Date.parse(approvedAt))) {
    return null;
  }
  return { userId, content, idempotencyKey, approval: { approvedBy, source, approvedAt } };
}

function audit(entry: {
  userId: string | null;
  id: string | null;
  content: string | null;
  idempotencyKey: string | null;
  approval: CoachApproval | null;
  result: string;
}): void {
  console.log(
    JSON.stringify({
      event: "coach_message",
      userId: entry.userId,
      id: entry.id,
      contentSha256: entry.content ? createHash("sha256").update(entry.content, "utf8").digest("hex") : null,
      contentLength: entry.content ? entry.content.length : null,
      idempotencyKey: entry.idempotencyKey,
      approval: entry.approval,
      result: entry.result,
    }),
  );
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

export async function handleCoachMessage(
  request: Request,
  store: CoachMessageStore,
  options?: { rateLimit?: { allow(now?: number): boolean }; now?: number },
): Promise<Response> {
  const rateLimit = options?.rateLimit ?? coachMessageRateLimit;
  const now = options?.now ?? Date.now();
  const key = bearerKey(request.headers.get("authorization"));
  if (!key || !coachKeyMatches(key)) {
    audit({ userId: null, id: null, content: null, idempotencyKey: null, approval: null, result: "unauthorised" });
    return notFound();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = parseCoachMessage(body);
  if (!parsed) {
    audit({ userId: null, id: null, content: null, idempotencyKey: null, approval: null, result: "invalid" });
    return json({ error: "userId, content, idempotencyKey, and approval are required" }, 400);
  }

  let exists = false;
  try {
    exists = await store.profileExists(parsed.userId);
  } catch (err) {
    audit({
      userId: parsed.userId,
      id: null,
      content: parsed.content,
      idempotencyKey: parsed.idempotencyKey,
      approval: parsed.approval,
      result: "error",
    });
    return json({ error: err instanceof Error ? err.message : "lookup failed" }, 500);
  }
  if (!exists) {
    audit({
      userId: parsed.userId,
      id: null,
      content: parsed.content,
      idempotencyKey: parsed.idempotencyKey,
      approval: parsed.approval,
      result: "client_not_found",
    });
    return json({ error: "client not found" }, 404);
  }

  if (!rateLimit.allow(now)) {
    audit({
      userId: parsed.userId,
      id: null,
      content: parsed.content,
      idempotencyKey: parsed.idempotencyKey,
      approval: parsed.approval,
      result: "rate_limited",
    });
    return json({ error: "Too many messages this hour" }, 429);
  }

  const sinceIso = new Date(now - DAY_MS).toISOString();
  try {
    const existing = await store.findRecentDuplicate(parsed.userId, parsed.content, sinceIso);
    if (existing) {
      audit({
        userId: parsed.userId,
        id: existing.id,
        content: parsed.content,
        idempotencyKey: parsed.idempotencyKey,
        approval: parsed.approval,
        result: "duplicate",
      });
      return json({ ok: true, duplicate: true, id: existing.id, created_at: existing.created_at }, 200);
    }
    const saved = await store.insertMessage(parsed.userId, parsed.content);
    audit({
      userId: parsed.userId,
      id: saved.id,
      content: parsed.content,
      idempotencyKey: parsed.idempotencyKey,
      approval: parsed.approval,
      result: "inserted",
    });
    return json({ ok: true, id: saved.id, created_at: saved.created_at }, 200);
  } catch (err) {
    audit({
      userId: parsed.userId,
      id: null,
      content: parsed.content,
      idempotencyKey: parsed.idempotencyKey,
      approval: parsed.approval,
      result: "error",
    });
    return json({ error: err instanceof Error ? err.message : "message was not saved" }, 500);
  }
}

type Chain = {
  select: (columns: string) => Chain;
  eq: (column: string, value: string) => Chain;
  gte: (column: string, value: string) => Chain;
  order: (column: string, options: { ascending: boolean }) => Chain;
  limit: (count: number) => PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
  insert: (row: { user_id: string; role: "assistant"; content: string }) => {
    select: (columns: string) => {
      single: () => Promise<{ data: { id: string; created_at: string } | null; error: { message: string } | null }>;
    };
  };
};

/** Service-role queries. The insert columns match /api/admin/message-client. */
export function storeFromSupabase(client: { from: (table: string) => Chain }): CoachMessageStore {
  return {
    async profileExists(userId) {
      const { data, error } = await client.from("profiles").select("id").eq("id", userId).limit(1);
      if (error) throw new Error(error.message);
      return Array.isArray(data) && data.length > 0;
    },
    async findRecentDuplicate(userId, content, sinceIso) {
      const { data, error } = await client
        .from("messages")
        .select("id, created_at")
        .eq("user_id", userId)
        .eq("role", "assistant")
        .eq("content", content)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : null;
      if (!row || typeof row.id !== "string" || typeof row.created_at !== "string") return null;
      return { id: row.id, created_at: row.created_at };
    },
    async insertMessage(userId, content) {
      const { data, error } = await client
        .from("messages")
        .insert({ user_id: userId, role: "assistant", content })
        .select("id, created_at")
        .single();
      if (error || !data) throw new Error(error?.message ?? "message was not saved");
      return { id: data.id, created_at: data.created_at };
    },
  };
}

/** Keeps the SupabaseClient type attached at the route without widening the query helper. */
export function coachStore(client: SupabaseClient): CoachMessageStore {
  return storeFromSupabase(client as unknown as { from: (table: string) => Chain });
}
