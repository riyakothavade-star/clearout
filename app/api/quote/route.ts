import { isDeepStrictEqual } from "node:util";
import { AppError, errorResponse } from "@/lib/errors";
import { logEvent } from "@/lib/log";
import { PRICES } from "@/lib/prices";
import { computeQuote } from "@/lib/quote";
import { allowRequest, clientIp } from "@/lib/rateLimit";
import { QuoteRequestSchema, QuoteSchema, type Quote } from "@/lib/schema";

const QUOTE_REQUESTS_PER_MINUTE = 60;

// Asks the optional n8n workflow for the quote. Its answer is only used if it has the right shape AND
// matches the canonical calculation exactly; otherwise the canonical result is used and the mismatch logged.
async function quoteFromN8n(url: string, items: unknown, canonical: Quote): Promise<{ quote: Quote; source: "n8n" | "local" }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-clearout-secret": process.env.N8N_SECRET ?? "" },
      body: JSON.stringify({ items, prices: PRICES }),
      signal: AbortSignal.timeout(8_000),
    });
    const parsed = QuoteSchema.safeParse(await res.json());
    if (res.ok && parsed.success && isDeepStrictEqual(parsed.data, canonical)) return { quote: parsed.data, source: "n8n" };
    logEvent("warn", "quote.n8n_rejected", { status: res.status, validShape: parsed.success });
  } catch (error) {
    logEvent("warn", "quote.n8n_unreachable", { error: error instanceof Error ? error.name : "unknown" });
  }
  return { quote: canonical, source: "local" };
}

// POST { items } -> { quote, source }. Malformed items are rejected, never quoted.
export async function POST(request: Request) {
  try {
    if (!allowRequest(`quote:${clientIp(request)}`, QUOTE_REQUESTS_PER_MINUTE)) throw new AppError("RATE_LIMITED");
    const body = await request.json().catch(() => {
      throw new AppError("INVALID_REQUEST", "body is not JSON");
    });
    const parsed = QuoteRequestSchema.safeParse(body);
    if (!parsed.success) throw new AppError("INVALID_REQUEST", `quote items: ${parsed.error.issues[0]?.path.join(".")}`);

    const canonical = computeQuote(parsed.data.items, PRICES);
    const n8nUrl = process.env.N8N_QUOTE_URL?.trim();
    const result = n8nUrl ? await quoteFromN8n(n8nUrl, parsed.data.items, canonical) : { quote: canonical, source: "local" as const };
    return Response.json(result);
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError("QUOTE_FAILED", error instanceof Error ? error.name : "unknown");
    logEvent("warn", "quote.failed", { code: appError.code, detail: appError.detail });
    return errorResponse(appError.code);
  }
}
