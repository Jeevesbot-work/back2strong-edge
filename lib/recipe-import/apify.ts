import { addApifyUsd } from "./cost";
import { captionHasDishName, captionHasMacros, captionHasMethod, classifyPost, hasRecipeBody } from "./classify";
import {
  activeCreators,
  creatorFamily,
  getCreators,
  instagramProfileUrl,
  postsPerCreator,
  SCRAPE_WINDOW,
  YOUTUBE_MAX_RESULTS,
  YOUTUBE_MAX_SHORTS,
  youtubeChannelUrl,
} from "./creators";
import type { SourcePost } from "./types";

const API = "https://api.apify.com/v2";
const RUN_TIMEOUT_MS = 8 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function pickString(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function transcriptOf(item: Record<string, unknown>): string {
  const direct = pickString(item, ["transcript", "videoTranscript", "audioTranscript"]);
  if (direct) return direct;
  return subtitlesToText(item.subtitles ?? item.captions);
}

export function subtitlesToText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return stripCueTiming(value);
  if (Array.isArray(value)) return value.map(subtitlesToText).filter(Boolean).join("\n");
  const record = asRecord(value);
  if (!record) return "";
  const nested = pickString(record, ["plaintext", "text", "srt", "subtitle"]);
  return nested ? stripCueTiming(nested) : "";
}

function stripCueTiming(raw: string): string {
  return raw
    .replace(/^\d+\s*$/gm, "")
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function isReel(item: Record<string, unknown>): boolean {
  const product = pickString(item, ["productType", "product_type", "type"]).toLowerCase();
  if (product === "clips" || product === "reel" || product === "video") return true;
  const url = pickString(item, ["url", "inputUrl"]);
  if (url.includes("/reel/")) return true;
  return typeof item.videoUrl === "string" || typeof item.video_url === "string";
}

/**
 * Paid Instagram transcripts are the last resort. YouTube subtitles are free.
 * About $0.048 per started minute, so a week is hard-capped and spend-capped.
 */
export const MAX_REEL_TRANSCRIPTS = 10;
export const REEL_CHARGE_CAP_USD = 0.4;

/** Skip actor runs when the free-plan balance is about to run out. Per-run caps stay as they are. */
export const APIFY_MIN_REMAINING_USD = 0.3;
export const APIFY_CREDIT_NOTE = "Apify credit exhausted, used B2S originals";

const CREDIT_LIMIT = /402|payment required|monthly usage|usage hard limit|usage limit exceeded|not-enough-usage|not enough usage|exceed your remaining usage|insufficient credit|credit exhausted|platform-feature-disabled|hard limit exceeded|exceeded the usage|quota exceeded|actor run refused/i;
const PER_RUN_CHARGE = /maxTotalChargeUsd|max total charge|total charge/i;

/** True for monthly credit and usage-limit failures. A per-run maxTotalChargeUsd abort is not one of these. */
export function apifyCreditExhausted(message: string): boolean {
  if (PER_RUN_CHARGE.test(message)) return false;
  return CREDIT_LIMIT.test(message);
}

/** Remaining monthly USD from GET /v2/users/me/limits. Null when the body has no usage fields. */
export function remainingFromLimits(body: unknown): number | null {
  const root = asRecord(body);
  const data = asRecord(root?.data) ?? root;
  const limits = asRecord(data?.limits);
  const current = asRecord(data?.current);
  const max = limits?.maxMonthlyUsageUsd;
  const used = current?.monthlyUsageUsd;
  if (typeof max !== "number" || typeof used !== "number" || !Number.isFinite(max) || !Number.isFinite(used)) return null;
  return max - used;
}

export function shouldSkipApify(remaining: number | null): boolean {
  return remaining != null && remaining < APIFY_MIN_REMAINING_USD;
}

/** Read a limits response without calling Apify. A non-credit failure leaves the scrape free to continue. */
export function interpretLimitsResponse(status: number, body: string): { remaining: number | null; creditExhausted: boolean; message: string | null } {
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 180);
  const message = `Apify limits check failed (${status}): ${snippet}`;
  if (status === 402 || (status >= 400 && apifyCreditExhausted(message))) {
    return { remaining: null, creditExhausted: true, message };
  }
  if (status < 200 || status >= 300) {
    return { remaining: null, creditExhausted: false, message: null };
  }
  try {
    const parsed = body.trim() ? JSON.parse(body) : null;
    return { remaining: remainingFromLimits(parsed), creditExhausted: false, message: null };
  } catch {
    return { remaining: null, creditExhausted: false, message: null };
  }
}

export function needsReelTranscript(post: SourcePost): boolean {
  if (post.transcript?.trim()) return false;
  if (post.platform !== "instagram" || !post.isReel) return false;
  const caption = post.caption || "";
  if (captionHasMethod(caption)) return false;
  const kind = classifyPost(caption);
  if ((kind === "paywall" || kind === "promo") && !hasRecipeBody(caption)) return false;
  return captionHasMacros(caption) || captionHasDishName(caption);
}

export function selectTranscriptTargets(posts: SourcePost[], cap = MAX_REEL_TRANSCRIPTS): SourcePost[] {
  return posts
    .filter(needsReelTranscript)
    .map((post, index) => ({
      post,
      index,
      score: (captionHasMacros(post.caption || "") ? 2 : 0) + (captionHasDishName(post.caption || "") ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, cap)
    .map((item) => item.post);
}

export function instagramItemsToPosts(items: Array<Record<string, unknown>>): SourcePost[] {
  const posts: SourcePost[] = [];
  for (const item of items) {
    if (item.isPinned === true) continue;
    const shortCode = pickString(item, ["shortCode", "shortcode"]);
    if (!shortCode) continue;
    const handle = pickString(item, ["ownerUsername", "owner_username"]) || "unknown";
    posts.push({
      platform: "instagram",
      sourceKey: `ig:${shortCode}`,
      url: pickString(item, ["url"]) || `https://www.instagram.com/p/${shortCode}/`,
      creditHandle: handle,
      caption: pickString(item, ["caption"]),
      isReel: isReel(item),
    });
  }
  return posts;
}

export function youtubeItemsToPosts(items: Array<Record<string, unknown>>): SourcePost[] {
  const posts: SourcePost[] = [];
  for (const item of items) {
    const id = pickString(item, ["id", "videoId", "video_id"]);
    if (!id) continue;
    const channel = pickString(item, ["channelName", "channelUsername", "ownerChannelName"]) || "unknown channel";
    posts.push({
      platform: "youtube",
      sourceKey: `yt:${id}`,
      url: pickString(item, ["url", "videoUrl"]) || `https://www.youtube.com/watch?v=${id}`,
      creditHandle: channel,
      caption: pickString(item, ["text", "description"]),
      transcript: transcriptOf(item) || null,
      titleHint: pickString(item, ["title"]) || null,
    });
  }
  return posts;
}

export function mergeReelTranscripts(posts: SourcePost[], items: Array<Record<string, unknown>>): SourcePost[] {
  const byCode = new Map<string, string>();
  for (const item of items) {
    const code = pickString(item, ["shortCode", "shortcode"]);
    const transcript = transcriptOf(item);
    if (code && transcript) byCode.set(code, transcript);
  }
  return posts.map((post) => {
    if (!needsReelTranscript(post)) return post;
    const code = post.sourceKey.replace(/^ig:/, "");
    const transcript = byCode.get(code);
    return transcript ? { ...post, transcript, transcriptSource: "instagram" as const } : post;
  });
}

const TITLE_STOP = new Set(["with", "and", "the", "for", "from", "that", "this", "your"]);

export function titlesOverlap(caption: string, title: string): boolean {
  const words = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !TITLE_STOP.has(word));
  if (!words.length) return false;
  const hay = caption.toLowerCase();
  const hits = words.filter((word) => hay.includes(word));
  if (hits.some((word) => word.length >= 8)) return true;
  return hits.length >= 2;
}

/** Copy a free YouTube subtitle onto the Instagram reel of the same dish. */
export function borrowYoutubeTranscripts(posts: SourcePost[]): SourcePost[] {
  const videos = posts.filter((post) => post.platform === "youtube" && post.transcript?.trim());
  return posts.map((post) => {
    if (!needsReelTranscript(post)) return post;
    const twin = videos.find((video) => {
      if (creatorFamily(post.creditHandle) !== creatorFamily(video.creditHandle)) return false;
      return titlesOverlap(post.caption || "", video.titleHint || "");
    });
    if (!twin?.transcript) return post;
    return { ...post, transcript: twin.transcript, transcriptSource: "youtube" as const };
  });
}

/** Turn an Apify response into JSON, or name the actor step when the body is HTML. */
export function parseActorBody(body: string, status: number, actor: string, step: string): unknown {
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 180);
  const trimmed = body.trimStart();
  if (trimmed.startsWith("<") || /^<!doctype/i.test(trimmed)) {
    throw new Error(`${actor} ${step} returned non-JSON (${status}): ${snippet}`);
  }
  let parsed: unknown;
  try {
    parsed = body.trim() ? JSON.parse(body) : null;
  } catch {
    throw new Error(`${actor} ${step} returned non-JSON (${status}): ${snippet}`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Apify ${actor} ${step} failed (${status}): ${snippet}`);
  }
  return parsed;
}

async function readActorJson(res: Response, actor: string, step: string): Promise<unknown> {
  return parseActorBody(await res.text(), res.status, actor, step);
}

async function runActor(actor: string, input: unknown, maxTotalChargeUsd: number): Promise<Array<Record<string, unknown>>> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const startRes = await fetch(`${API}/acts/${actor}/runs?maxTotalChargeUsd=${encodeURIComponent(String(maxTotalChargeUsd))}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  const started = asRecord(await readActorJson(startRes, actor, "start"));
  const run = asRecord(started?.data);
  const runId = typeof run?.id === "string" ? run.id : "";
  const datasetId = typeof run?.defaultDatasetId === "string" ? run.defaultDatasetId : "";
  if (!runId || !datasetId) throw new Error(`Apify ${actor} returned no run id`);

  let status = typeof run?.status === "string" ? run.status : "READY";
  let statusMessage = runDetail(run);
  let spent = usageUsd(run);
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    if (Date.now() > deadline) throw new Error(`Apify ${actor} timed out after 8 minutes`);
    await sleep(5000);
    const pollRes = await fetch(`${API}/actor-runs/${runId}`, { headers });
    const poll = asRecord(await readActorJson(pollRes, actor, "poll"));
    const data = asRecord(poll?.data);
    status = typeof data?.status === "string" ? data.status : "FAILED";
    statusMessage = runDetail(data) || statusMessage;
    spent = usageUsd(data) || spent;
  }
  addApifyUsd(spent);
  if (status !== "SUCCEEDED") {
    const detail = statusMessage ? `: ${statusMessage}` : "";
    throw new Error(`Apify ${actor} ended with ${status}${detail}`);
  }

  const itemsRes = await fetch(`${API}/datasets/${datasetId}/items?clean=true&format=json&limit=500`, { headers });
  const items = await readActorJson(itemsRes, actor, "items");
  if (!Array.isArray(items)) return [];
  return items.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => !!item);
}

function runDetail(data: Record<string, unknown> | null): string {
  if (!data) return "";
  const parts = [data.statusMessage, data.errorMessage].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return parts.join(" ");
}

function usageUsd(data: Record<string, unknown> | null): number {
  if (!data) return 0;
  const direct = data.usageTotalUsd;
  if (typeof direct === "number") return direct;
  const usage = asRecord(data.usage);
  const nested = usage?.usageTotalUsd ?? usage?.USD;
  return typeof nested === "number" ? nested : 0;
}

function youtubeInput(handle: string, subtitlesFormat: "plaintext" | "srt") {
  return {
    startUrls: [{ url: youtubeChannelUrl(handle) }],
    maxResults: YOUTUBE_MAX_RESULTS,
    maxResultsShorts: YOUTUBE_MAX_SHORTS,
    maxResultStreams: 0,
    oldestPostDate: SCRAPE_WINDOW,
    transcriptionAndSubtitle: "ALWAYS_SUBTITLES",
    subtitlesLanguage: "en",
    subtitlesFormat,
  };
}

function originalsOnly(errors: string[]): { posts: SourcePost[]; errors: string[]; creditExhausted: true } {
  return { posts: [], errors, creditExhausted: true };
}

async function fetchApifyLimits(): Promise<{ remaining: number | null; creditExhausted: boolean; message: string | null }> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { remaining: null, creditExhausted: false, message: null };
  try {
    const res = await fetch(`${API}/users/me/limits`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    return interpretLimitsResponse(res.status, await res.text());
  } catch {
    return { remaining: null, creditExhausted: false, message: null };
  }
}

async function runOrStop(
  actor: string,
  input: unknown,
  maxTotalChargeUsd: number,
  errors: string[],
): Promise<{ items: Array<Record<string, unknown>> | null; stop: boolean }> {
  try {
    return { items: await runActor(actor, input, maxTotalChargeUsd), stop: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : `${actor} failed`;
    errors.push(message);
    return { items: null, stop: apifyCreditExhausted(message) };
  }
}

export async function scrapeCreators(): Promise<{ posts: SourcePost[]; errors: string[]; creditExhausted: boolean }> {
  const limits = await fetchApifyLimits();
  if (limits.creditExhausted || shouldSkipApify(limits.remaining)) {
    const errors: string[] = [];
    if (limits.message) errors.push(limits.message);
    else if (limits.remaining != null) {
      errors.push(`Apify remaining usage is $${limits.remaining.toFixed(2)}, under $${APIFY_MIN_REMAINING_USD.toFixed(2)}`);
    }
    return originalsOnly(errors);
  }

  const creators = activeCreators(getCreators());
  const errors: string[] = [];
  let posts: SourcePost[] = [];

  // Free YouTube subtitles first. Paid Instagram transcripts come last.
  for (const creator of creators.youtube) {
    const first = await runOrStop("streamers~youtube-scraper", youtubeInput(creator.handle, "plaintext"), 0.05, errors);
    if (first.stop) return originalsOnly(errors);
    if (first.items) {
      posts = posts.concat(youtubeItemsToPosts(first.items));
      continue;
    }
    const message = errors[errors.length - 1] ?? "";
    if (!/start returned non-JSON|start failed|did not start/i.test(message)) continue;
    errors.pop();
    const retry = await runOrStop("streamers~youtube-scraper", youtubeInput(creator.handle, "srt"), 0.05, errors);
    if (retry.stop) return originalsOnly(errors);
    if (retry.items) posts = posts.concat(youtubeItemsToPosts(retry.items));
  }

  const groups = new Map<number, string[]>();
  for (const creator of creators.instagram) {
    const limit = postsPerCreator(creator.weight);
    const urls = groups.get(limit) ?? [];
    urls.push(instagramProfileUrl(creator.handle));
    groups.set(limit, urls);
  }
  for (const [limit, urls] of Array.from(groups.entries())) {
    const result = await runOrStop(
      "apify~instagram-scraper",
      {
        directUrls: urls,
        resultsType: "posts",
        resultsLimit: limit,
        onlyPostsNewerThan: SCRAPE_WINDOW,
        skipPinnedPosts: true,
      },
      Math.min(0.12, Math.max(0.05, urls.length * limit * 0.004)),
      errors,
    );
    if (result.stop) return originalsOnly(errors);
    if (result.items) posts = posts.concat(instagramItemsToPosts(result.items));
  }

  posts = borrowYoutubeTranscripts(posts);
  const reelUrls = selectTranscriptTargets(posts).map((post) => post.url);
  if (reelUrls.length > 0) {
    const reels = await runOrStop(
      "apify~instagram-reel-scraper",
      {
        username: reelUrls,
        resultsLimit: reelUrls.length,
        includeTranscript: true,
        includeDownloadedVideo: false,
        skipPinnedPosts: true,
      },
      REEL_CHARGE_CAP_USD,
      errors,
    );
    if (reels.stop) return originalsOnly(errors);
    if (reels.items) posts = mergeReelTranscripts(posts, reels.items);
  }

  if (posts.length === 0) return originalsOnly(errors);
  return { posts, errors, creditExhausted: false };
}
