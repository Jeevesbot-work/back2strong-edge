import { hasRecipeBody } from "./classify";
import {
  getCreators,
  INSTAGRAM_RESULTS_LIMIT,
  instagramProfileUrl,
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
  const product = pickString(item, ["productType", "product_type"]).toLowerCase();
  if (product === "clips") return true;
  const url = pickString(item, ["url", "inputUrl"]);
  return url.includes("/reel/");
}

export function needsReelTranscript(post: SourcePost): boolean {
  return post.platform === "instagram" && !!post.isReel && !hasRecipeBody(post.caption || "");
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
    return transcript ? { ...post, transcript } : post;
  });
}

async function runActor(actor: string, input: unknown): Promise<Array<Record<string, unknown>>> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const startRes = await fetch(`${API}/acts/${actor}/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!startRes.ok) {
    const detail = (await startRes.text()).slice(0, 280);
    throw new Error(`Apify ${actor} did not start (${startRes.status}): ${detail}`);
  }
  const started = asRecord(await startRes.json());
  const run = asRecord(started?.data);
  const runId = typeof run?.id === "string" ? run.id : "";
  const datasetId = typeof run?.defaultDatasetId === "string" ? run.defaultDatasetId : "";
  if (!runId || !datasetId) throw new Error(`Apify ${actor} returned no run id`);

  let status = typeof run?.status === "string" ? run.status : "READY";
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    if (Date.now() > deadline) throw new Error(`Apify ${actor} timed out after 8 minutes`);
    await sleep(5000);
    const pollRes = await fetch(`${API}/actor-runs/${runId}`, { headers });
    const poll = asRecord(await pollRes.json());
    const data = asRecord(poll?.data);
    status = typeof data?.status === "string" ? data.status : "FAILED";
  }
  if (status !== "SUCCEEDED") throw new Error(`Apify ${actor} ended with ${status}`);

  const itemsRes = await fetch(`${API}/datasets/${datasetId}/items?clean=true&limit=500`, { headers });
  if (!itemsRes.ok) throw new Error(`Apify ${actor} dataset could not be read (${itemsRes.status})`);
  const items = await itemsRes.json();
  if (!Array.isArray(items)) return [];
  return items.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => !!item);
}

export async function scrapeCreators(): Promise<{ posts: SourcePost[]; errors: string[] }> {
  const creators = getCreators();
  const errors: string[] = [];
  let posts: SourcePost[] = [];

  try {
    const items = await runActor("apify~instagram-scraper", {
      directUrls: creators.instagram.map(instagramProfileUrl),
      resultsType: "posts",
      resultsLimit: INSTAGRAM_RESULTS_LIMIT,
      onlyPostsNewerThan: SCRAPE_WINDOW,
      skipPinnedPosts: true,
    });
    posts = instagramItemsToPosts(items);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Instagram scrape failed");
  }

  const reelUrls = posts.filter(needsReelTranscript).map((post) => post.url);
  if (reelUrls.length > 0) {
    try {
      const reels = await runActor("apify~instagram-reel-scraper", {
        username: reelUrls,
        resultsLimit: reelUrls.length,
        includeTranscript: true,
        includeDownloadedVideo: false,
        skipPinnedPosts: true,
      });
      posts = mergeReelTranscripts(posts, reels);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Instagram reel transcript scrape failed");
    }
  }

  try {
    const items = await runActor("streamers~youtube-scraper", {
      startUrls: creators.youtube.map((handle) => ({ url: youtubeChannelUrl(handle) })),
      maxResults: YOUTUBE_MAX_RESULTS,
      maxResultsShorts: YOUTUBE_MAX_SHORTS,
      maxResultStreams: 0,
      oldestPostDate: SCRAPE_WINDOW,
      transcriptionAndSubtitle: "ALWAYS_SUBTITLES",
      subtitlesLanguage: "en",
      subtitlesFormat: "plaintext",
    });
    posts = posts.concat(youtubeItemsToPosts(items));
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "YouTube scrape failed");
  }

  return { posts, errors };
}
