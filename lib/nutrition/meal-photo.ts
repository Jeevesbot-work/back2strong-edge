import { BlankPhotoError, frameLooksBlank } from "./photo-frame";

type Drawable = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

const DECODE_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Could not read that image.")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Home-screen Safari suspends the page while the camera is open. Drawing in
 * that moment produces an empty canvas, which JPEG encoding saves as black.
 * Wait until the page is visible again, then one paint, before drawing.
 */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => finish());
    setTimeout(finish, 50);
  });
}

async function waitForVisibleFrame(extraDelayMs: number): Promise<void> {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    await new Promise<void>((resolve) => {
      const finish = () => {
        document.removeEventListener("visibilitychange", onChange);
        clearTimeout(timer);
        resolve();
      };
      const onChange = () => {
        if (document.visibilityState === "visible") finish();
      };
      const timer = setTimeout(finish, 700);
      document.addEventListener("visibilitychange", onChange);
    });
  }
  if (extraDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, extraDelayMs));
  }
  await nextPaint();
}

async function openBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(file);
  }
}

async function decodeWithBitmap(file: File): Promise<Drawable> {
  if (typeof createImageBitmap !== "function") throw new Error("createImageBitmap unavailable");
  const bmp = await withTimeout(openBitmap(file), DECODE_TIMEOUT_MS);
  if (!bmp.width || !bmp.height) {
    bmp.close();
    throw new BlankPhotoError();
  }
  return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
}

async function decodeWithImg(file: File): Promise<Drawable> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await withTimeout(new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read that image."));
      img.src = url;
    }), DECODE_TIMEOUT_MS);
    if (typeof img.decode === "function") await img.decode().catch(() => undefined);
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) {
    URL.revokeObjectURL(url);
    throw new BlankPhotoError();
  }
  return { source: img, width, height, release: () => URL.revokeObjectURL(url) };
}

/**
 * A detached canvas on iOS can allocate no backing store, so drawImage paints
 * nothing. Keep it off-screen, but attached, and never size it with CSS —
 * a CSS width of 0 makes some browsers skip the draw.
 */
function mountCanvas(canvas: HTMLCanvasElement): () => void {
  if (typeof document === "undefined" || !document.body) return () => undefined;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "fixed";
  canvas.style.left = "-10000px";
  canvas.style.top = "0";
  canvas.style.pointerEvents = "none";
  document.body.appendChild(canvas);
  return () => canvas.remove();
}

function canvasIsBlank(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean {
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) return true;
  // Read the canvas that was just drawn. Downscaling via a second drawImage
  // can itself come out blank on iOS and would reject a good photo.
  const cols = 32;
  const rows = 32;
  const pixels = new Uint8ClampedArray(cols * rows * 4);
  for (let y = 0; y < rows; y++) {
    const sy = Math.min(height - 1, Math.floor(((y + 0.5) * height) / rows));
    const row = ctx.getImageData(0, sy, width, 1).data;
    for (let x = 0; x < cols; x++) {
      const sx = Math.min(width - 1, Math.floor(((x + 0.5) * width) / cols));
      const dest = (y * cols + x) * 4;
      const src = sx * 4;
      pixels[dest] = row[src];
      pixels[dest + 1] = row[src + 1];
      pixels[dest + 2] = row[src + 2];
      pixels[dest + 3] = row[src + 3];
    }
  }
  return frameLooksBlank(pixels, 4);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read that image."));
        return;
      }
      const comma = reader.result.indexOf(",");
      resolve(comma >= 0 ? reader.result.slice(comma + 1) : reader.result);
    };
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(blob);
  });
}

async function encodeJpeg(canvas: HTMLCanvasElement): Promise<string> {
  if (typeof canvas.toBlob === "function") {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/jpeg", 0.82);
    });
    if (blob && blob.size >= 32) {
      const base64 = await blobToBase64(blob);
      if (base64.startsWith("/9j/")) return base64;
    }
  }
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const base64 = dataUrl.split(",")[1] ?? "";
  if (!base64.startsWith("/9j/")) throw new BlankPhotoError();
  return base64;
}

async function renderToJpeg(
  file: File,
  maxPx: number,
  decode: (file: File) => Promise<Drawable>,
): Promise<string> {
  const src = await decode(file);
  const canvas = document.createElement("canvas");
  let unmount: () => void = () => {};
  try {
    if (!src.width || !src.height) throw new BlankPhotoError();
    const scale = Math.min(1, maxPx / Math.max(src.width, src.height));
    const width = Math.max(1, Math.round(src.width * scale));
    const height = Math.max(1, Math.round(src.height * scale));
    canvas.width = width;
    canvas.height = height;
    unmount = mountCanvas(canvas);
    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true })
      ?? canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read that image.");
    // White, not transparent. A missed draw then stays white instead of being
    // saved as a black JPEG, and the flat-white check below rejects it.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    try {
      ctx.drawImage(src.source, 0, 0, width, height);
    } catch {
      throw new BlankPhotoError();
    }
    // iOS sometimes reports empty pixels if they are read in the same turn as the draw.
    await nextPaint();
    if (canvasIsBlank(canvas, ctx)) throw new BlankPhotoError();
    return await encodeJpeg(canvas);
  } finally {
    unmount();
    src.release();
  }
}

/**
 * Resize and JPEG-encode a meal photo. Tries createImageBitmap first, then
 * retries once with an <img> decode after the page has had a chance to paint.
 * Throws BlankPhotoError instead of returning a black frame.
 */
export async function prepareMealPhoto(file: File, maxPx: number): Promise<string> {
  if (!(file instanceof Blob) || file.size <= 0) throw new Error("Could not read that image.");
  const decoders = [decodeWithBitmap, decodeWithImg];
  let sawBlank = false;
  let lastError: unknown;
  for (let attempt = 0; attempt < decoders.length; attempt++) {
    await waitForVisibleFrame(attempt === 0 ? 0 : 200);
    try {
      return await renderToJpeg(file, maxPx, decoders[attempt]);
    } catch (err) {
      lastError = err;
      if (err instanceof BlankPhotoError) sawBlank = true;
    }
  }
  if (sawBlank) throw new BlankPhotoError();
  throw lastError instanceof Error ? lastError : new Error("Could not read that image.");
}
