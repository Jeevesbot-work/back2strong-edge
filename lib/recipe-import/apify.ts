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
  let spent = usageUsd(run);
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    if (Date.now() > deadline) throw new Error(`Apify ${actor} timed out after 8 minutes`);
    await sleep(5000);
    const pollRes = await fetch(`${API}/actor-runs/${runId}`, { headers });
    const poll = asRecord(await readActorJson(pollRes, actor, "poll"));
    const data = asRecord(poll?.data);
    status = typeof data?.status === "string" ? data.status : "FAILED";
    spent = usageUsd(data) || spent;
  }
  addApifyUsd(spent);
  if (status !== "SUCCEEDED") throw new Error(`Apify ${actor} ended with ${status}`);

  const itemsRes = await fetch(`${API}/datasets/${datasetId}/items?clean=true&format=json&limit=500`, { headers });
  const items = await readActorJson(itemsRes, actor, "items");
  if (!Array.isArray(items)) return [];
  return items.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => !!item);
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

export async function scrapeCreators(): Promise<{ posts: SourcePost[]; errors: string[] }> {
  const creators = activeCreators(getCreators());
  const errors: string[] = [];
  let posts: SourcePost[] = [];

  // Free YouTube subtitles first. Paid Instagram transcripts come last.
  for (const creator of creators.youtube) {
    try {
      const items = await runActor("streamers~youtube-scraper", youtubeInput(creator.handle, "plaintext"), 0.05);
      posts = posts.concat(youtubeItemsToPosts(items));
    } catch (err) {
      const message = err instanceof Error ? err.message : "YouTube scrape failed";
      if (!/start returned non-JSON|start failed|did not start/i.test(message)) {
        errors.push(message);
        continue;
      }
      try {
        const items = await runActor("streamers~youtube-scraper", youtubeInput(creator.handle, "srt"), 0.05);
        posts = posts.concat(youtubeItemsToPosts(items));
      } catch (retryErr) {
        errors.push(retryErr instanceof Error ? retryErr.message : message);
      }
    }
  }

  const groups = new Map<number, string[]>();
  for (const creator of creators.instagram) {
    const limit = postsPerCreator(creator.weight);
    const urls = groups.get(limit) ?? [];
    urls.push(instagramProfileUrl(creator.handle));
    groups.set(limit, urls);
  }
  for (const [limit, urls] of Array.from(groups.entries())) {
    try {
      const items = await runActor(
        "apify~instagram-scraper",
        {
          directUrls: urls,
          resultsType: "posts",
          resultsLimit: limit,
          onlyPostsNewerThan: SCRAPE_WINDOW,
          skipPinnedPosts: true,
        },
        Math.min(0.12, Math.max(0.05, urls.length * limit * 0.004)),
      );
      posts = posts.concat(instagramItemsToPosts(items));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Instagram scrape failed");
    }
  }

  posts = borrowYoutubeTranscripts(posts);
  const reelUrls = selectTranscriptTargets(posts).map((post) => post.url);
  if (reelUrls.length > 0) {
    try {
      const reels = await runActor(
        "apify~instagram-reel-scraper",
        {
          username: reelUrls,
          resultsLimit: reelUrls.length,
          includeTranscript: true,
          includeDownloadedVideo: false,
          skipPinnedPosts: true,
        },
        REEL_CHARGE_CAP_USD,
      );
      posts = mergeReelTranscripts(posts, reels);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Instagram reel transcript scrape failed");
    }
  }

  return { posts, errors };
}
