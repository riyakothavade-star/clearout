import { AppError } from "./errors";
import { MAX_PHOTOS } from "./schema";

// Server-side checks on uploaded photos. The browser already shrinks photos to a JPEG of at most
// 1568 px; these checks make sure nothing else reaches the AI provider, whatever the browser sends.

export const MAX_PHOTO_BYTES = 1_500_000; // per photo, after decoding
export const MAX_PHOTO_DIMENSION = 2048; // px, either side
export const MAX_BODY_BYTES = 4_400_000; // Vercel rejects request bodies over 4.5 MB

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// Reads width and height from a JPEG's frame header. Returns null if the bytes aren't a valid JPEG.
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1; // padding byte
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2; // markers without a length
      continue;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) return null;
    // Start-of-frame markers (SOF0–SOF15, except DHT 0xC4, JPG 0xC8 and DAC 0xCC) hold the size.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    i += 2 + length;
  }
  return null;
}

// Returns the photos as base64 strings, or throws an AppError with a code the user can act on.
export function validatePhotos(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new AppError("NO_PHOTOS");
  if (raw.length > MAX_PHOTOS) throw new AppError("TOO_MANY_PHOTOS", `count=${raw.length}`);

  return raw.map((value, i) => {
    if (typeof value !== "string" || value.length === 0 || !BASE64.test(value)) {
      throw new AppError("INVALID_IMAGE", `photo ${i + 1}: not base64`);
    }
    const bytes = Buffer.from(value, "base64");
    if (bytes.length > MAX_PHOTO_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", `photo ${i + 1}: ${bytes.length} bytes`);
    const size = jpegSize(bytes);
    if (!size) throw new AppError("INVALID_IMAGE", `photo ${i + 1}: not a JPEG`);
    if (size.width > MAX_PHOTO_DIMENSION || size.height > MAX_PHOTO_DIMENSION) {
      throw new AppError("INVALID_IMAGE", `photo ${i + 1}: ${size.width}x${size.height}`);
    }
    return value;
  });
}
