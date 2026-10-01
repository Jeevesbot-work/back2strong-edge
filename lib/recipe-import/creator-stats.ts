import { weightForHandle, type CreatorLists } from "./creators";

export interface CreatorRate {
  handle: string;
  platform: string;
  weight: number;
  posts: number;
  fullCaptions: number;
  passes: number;
}

export function creatorRates(
  posts: Array<{ platform: "instagram" | "youtube" | "b2s"; handle: string; fullCaption: boolean; passed: boolean }>,
  lists?: CreatorLists,
): CreatorRate[] {
  const grouped = new Map<string, CreatorRate>();
  for (const item of posts) {
    if (item.platform === "b2s") continue;
    const handle = item.handle || "unknown";
    const key = `${item.platform}:${handle.toLowerCase()}`;
    const current = grouped.get(key) ?? {
      handle,
      platform: item.platform,
      weight: weightForHandle(handle, item.platform, lists),
      posts: 0,
      fullCaptions: 0,
      passes: 0,
    };
    current.posts += 1;
    if (item.fullCaption) current.fullCaptions += 1;
    if (item.passed) current.passes += 1;
    grouped.set(key, current);
  }
  return Array.from(grouped.values()).sort((a, b) => b.weight - a.weight || b.posts - a.posts || a.handle.localeCompare(b.handle));
}

export function formatCreatorRates(rates: CreatorRate[]): string[] {
  if (!rates.length) return [];
  const lines = ["Creator rates (full caption = ingredients, quantities, and macros in the caption):"];
  for (const rate of rates) {
    const full = rate.posts ? Math.round((100 * rate.fullCaptions) / rate.posts) : 0;
    const pass = rate.posts ? Math.round((100 * rate.passes) / rate.posts) : 0;
    const name = rate.platform === "instagram" ? `@${rate.handle}` : rate.handle;
    lines.push(
      `- ${name} (${rate.platform}, weight ${rate.weight}): ${rate.fullCaptions}/${rate.posts} full captions (${full}%), ${rate.passes}/${rate.posts} clean passes (${pass}%)`,
    );
  }
  return lines;
}
