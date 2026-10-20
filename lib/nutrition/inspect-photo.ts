import sharp from "sharp";
import { frameLooksBlank } from "./photo-frame";

export type PhotoVerdict = "ok" | "blank" | "unreadable";

const MAX_BASE64_CHARS = 12_000_000;
const MAX_PIXELS = 80_000_000;

/** Pull the raw base64 out of a data URL or a bare payload. */
export function imageBufferFromPayload(image: string): Buffer | null {
  const trimmed = image.trim();
  if (!trimmed || trimmed.length > MAX_BASE64_CHARS) return null;
  const comma = trimmed.startsWith("data:") ? trimmed.indexOf(",") : -1;
  const payload = (comma >= 0 ? trimmed.slice(comma + 1) : trimmed).replace(/\s/g, "");
  if (!payload || payload.length > MAX_BASE64_CHARS) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return null;
  const buffer = Buffer.from(payload, "base64");
  return buffer.length > 0 ? buffer : null;
}

/**
 * Decode a meal photo and decide whether it is a flat black/white frame.
 * Runs before the model so a blank JPEG never becomes a guessed log.
 */
export async function inspectMealPhoto(image: string): Promise<PhotoVerdict> {
  const buffer = imageBufferFromPayload(image);
  if (!buffer) return "unreadable";
  try {
    const { data, info } = await sharp(buffer, { failOn: "none", limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize(32, 32, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    if (!info.width || !info.height) return "blank";
    if (channels !== 1 && channels !== 3 && channels !== 4) return "unreadable";
    return frameLooksBlank(data, channels) ? "blank" : "ok";
  } catch (err) {
    console.error("[nutrition] photo inspect failed:", err instanceof Error ? err.message : err);
    return "unreadable";
  }
}
