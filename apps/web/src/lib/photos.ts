import "server-only";
import sharp from "sharp";

/** Biggest upload accepted, before resizing. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Longest side once resized: plenty for a full-width banner. */
const MAX_SIDE = 2000;

/**
 * Make an uploaded photo safe and light to serve: turned the right way up,
 * resized, re-encoded as WebP and stripped of hidden details such as where
 * it was taken. Returns null for anything that isn't a photo.
 */
export async function preparePhoto(
  input: Buffer,
): Promise<{ data: Buffer; width: number; height: number; contentType: string } | null> {
  try {
    const meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
    if (!meta.format || !["jpeg", "png", "webp", "heif", "avif"].includes(meta.format)) return null;
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, contentType: "image/webp" };
  } catch {
    return null;
  }
}

/** Response headers for serving a photo. */
export function photoHeaders(contentType: string, cache: "public" | "private"): HeadersInit {
  return {
    "Content-Type": contentType,
    "Cache-Control":
      cache === "public"
        ? "public, max-age=86400, stale-while-revalidate=604800"
        : "private, no-store",
    "Content-Security-Policy": "default-src 'none'",
    "X-Content-Type-Options": "nosniff",
  };
}
