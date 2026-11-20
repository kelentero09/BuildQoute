/**
 * Browser-side image validation for logo and signature uploads.
 * The file is checked by type, size and magic bytes, then decoded and re-drawn to a
 * canvas. Re-encoding strips metadata and anything that is not real pixel data.
 */

import { ACCEPTED_TYPES, sniffImageType } from "../../shared/imageType";

export { ACCEPTED_TYPES, sniffImageType };
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

/** Longest side in pixels; smaller sizes are tried until the result fits MAX_STORED_BYTES. */
const DIMENSION_STEPS = [600, 450, 320, 240, 160];
/** Keeps images small enough for browser storage and for the account image limit. */
export const MAX_STORED_BYTES = 450 * 1024;

export class ImageError extends Error {}

/** Synchronous checks that need no decoding. Throws ImageError with a user-facing message. */
export function checkImageFile(file: { type: string; size: number }, head: Uint8Array): void {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    throw new ImageError("Please choose a PNG, JPG or WebP image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageError("That image is larger than 5 MB. Please choose a smaller file.");
  }
  if (file.size === 0 || sniffImageType(head) === null) {
    throw new ImageError("That file does not look like a valid PNG, JPG or WebP image.");
  }
}

/** Scale (w, h) down so the longest side is at most `max`, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Validate, downscale and re-encode an uploaded image.
 * Returns a PNG data URL (PNG keeps transparency, which signatures and logos need,
 * and is the format the PDF renderer handles most reliably).
 */
export async function processImage(file: File): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  checkImageFile(file, head);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError("That image could not be read. It may be damaged.");
  }
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new ImageError("Your browser could not process the image.");
    for (const max of DIMENSION_STEPS) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/png");
      // Base64 is 4 characters per 3 bytes.
      if ((dataUrl.length * 3) / 4 <= MAX_STORED_BYTES) return dataUrl;
    }
    throw new ImageError("That image is too detailed to store. Please try a simpler or smaller image.");
  } finally {
    bitmap.close();
  }
}
