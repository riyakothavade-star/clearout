import { analysePhotos } from "@/lib/ai/provider";
import { AppError, errorResponse } from "@/lib/errors";
import { logEvent } from "@/lib/log";
import { MAX_BODY_BYTES, validatePhotos } from "@/lib/photos";
import { allowRequest, clientIp } from "@/lib/rateLimit";

export const maxDuration = 60;

const LISTING_REQUESTS_PER_MINUTE = 6;

// POST { photos: string[] } (base64 JPEGs) -> { source: "ai", items, noElectronicsReason }
// Errors -> { error: { code, message } } with a plain message; details go to the server log only.
export async function POST(request: Request) {
  const started = Date.now();
  try {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_BODY_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", `content-length ${length}`);

    if (!allowRequest(`listing:${clientIp(request)}`, LISTING_REQUESTS_PER_MINUTE)) throw new AppError("RATE_LIMITED");

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", `body ${text.length}`);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("INVALID_REQUEST", "body is not JSON");
    }
    const photos = validatePhotos((body as { photos?: unknown } | null)?.photos);

    const { listing, provider } = await analysePhotos(photos);
    logEvent("info", "listing.ok", { provider, photos: photos.length, items: listing.items.length, ms: Date.now() - started });
    return Response.json({ source: "ai", ...listing });
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError("INTERNAL", error instanceof Error ? error.name : "unknown");
    logEvent(appError.code === "INTERNAL" ? "error" : "warn", "listing.failed", {
      code: appError.code,
      detail: appError.detail,
      ms: Date.now() - started,
    });
    return errorResponse(appError.code);
  }
}
