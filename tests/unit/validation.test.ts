import Anthropic from "@anthropic-ai/sdk";
import { ApiError } from "@google/genai";
import { describe, expect, it } from "vitest";
import { finalizeListing, providerConfig } from "@/lib/ai/provider";
import { mapClaudeError } from "@/lib/ai/claude";
import { mapGeminiError } from "@/lib/ai/gemini";
import { SAMPLE_LISTING, demoEnabled } from "@/lib/demo";
import { AppError, ERROR_MESSAGES } from "@/lib/errors";
import { inventorySummary, sortForReview } from "@/lib/inventory";
import { jpegSize, validatePhotos } from "@/lib/photos";
import { CATEGORY_IDS } from "@/lib/prices";
import { ItemSchema, ListingSchema, QuoteRequestSchema } from "@/lib/schema";
import { allowRequest, resetRateLimits } from "@/lib/rateLimit";
import { fakeJpeg } from "../helpers";

const validItem = SAMPLE_LISTING.items[0];

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : "OTHER";
  }
  return "OK";
};

describe("photo validation (server)", () => {
  it("accepts 1–5 real JPEGs", () => {
    expect(validatePhotos([fakeJpeg(1568, 1176)])).toHaveLength(1);
    expect(code(() => validatePhotos(Array(5).fill(fakeJpeg(800, 600))))).toBe("OK");
  });
  it("rejects missing, empty and too many photos", () => {
    expect(code(() => validatePhotos(undefined))).toBe("NO_PHOTOS");
    expect(code(() => validatePhotos([]))).toBe("NO_PHOTOS");
    expect(code(() => validatePhotos(Array(6).fill(fakeJpeg(10, 10))))).toBe("TOO_MANY_PHOTOS");
  });
  it("rejects non-base64, non-JPEG and oversized images", () => {
    expect(code(() => validatePhotos(["not base64!"]))).toBe("INVALID_IMAGE");
    expect(code(() => validatePhotos([42]))).toBe("INVALID_IMAGE");
    expect(code(() => validatePhotos([Buffer.from("\x89PNG\r\n\x1a\n0000000000").toString("base64")]))).toBe("INVALID_IMAGE");
    expect(code(() => validatePhotos([fakeJpeg(4000, 3000)]))).toBe("INVALID_IMAGE");
    expect(code(() => validatePhotos([fakeJpeg(800, 600, 1_600_000)]))).toBe("PAYLOAD_TOO_LARGE");
  });
  it("reads JPEG dimensions", () => {
    expect(jpegSize(Buffer.from(fakeJpeg(1568, 1176), "base64"))).toEqual({ width: 1568, height: 1176 });
    expect(jpegSize(Buffer.from([0xff, 0xd8, 0x00]))).toBeNull();
  });
});

describe("item and listing schemas", () => {
  it("rejects invalid quantities", () => {
    for (const quantity of [0, -1, 1.5, 501, Number.NaN]) expect(ItemSchema.safeParse({ ...validItem, quantity }).success).toBe(false);
    expect(ItemSchema.safeParse({ ...validItem, quantity: 500 }).success).toBe(true);
  });
  it("rejects blank names, bad conditions and out-of-range photo numbers", () => {
    expect(ItemSchema.safeParse({ ...validItem, type: "  " }).success).toBe(false);
    expect(ItemSchema.safeParse({ ...validItem, condition: "excellent" }).success).toBe(false);
    expect(ItemSchema.safeParse({ ...validItem, photos: [6] }).success).toBe(false);
  });
  it("requires at least one item to quote", () => {
    expect(QuoteRequestSchema.safeParse({ items: [] }).success).toBe(false);
    expect(QuoteRequestSchema.safeParse({ items: [validItem] }).success).toBe(true);
  });
});

describe("finalizeListing (AI output check)", () => {
  it("maps unknown categories to 'none'", () => {
    const out = finalizeListing({ items: [{ ...validItem, priceCategoryId: "spaceship" }], noElectronicsReason: "" });
    expect(out.items[0].priceCategoryId).toBe("none");
  });
  it("rejects malformed AI output instead of quoting it", () => {
    expect(code(() => finalizeListing({ items: [{ ...validItem, quantity: -3 }], noElectronicsReason: "" }))).toBe("INVALID_AI_RESPONSE");
    expect(code(() => finalizeListing({ foo: 1 }))).toBe("INVALID_AI_RESPONSE");
    expect(code(() => finalizeListing(null))).toBe("INVALID_AI_RESPONSE");
  });
  it("accepts an empty 'no electronics' answer", () => {
    expect(finalizeListing({ items: [], noElectronicsReason: "A drawing of a tree." }).items).toEqual([]);
  });
});

describe("provider configuration", () => {
  it("picks the provider and key from the server environment", () => {
    expect(providerConfig({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "k" })).toEqual({ name: "gemini", key: "k" });
    expect(providerConfig({ GEMINI_API_KEY: "k" })).toEqual({ name: "gemini", key: "k" });
    expect(providerConfig({ AI_PROVIDER: "Claude", ANTHROPIC_API_KEY: "k" })).toEqual({ name: "claude", key: "k" });
  });
  it("treats missing, placeholder or unknown settings as not configured", () => {
    expect(providerConfig({})).toBeNull();
    expect(providerConfig({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "paste-your-key-here" })).toBeNull();
    expect(providerConfig({ AI_PROVIDER: "claude", GEMINI_API_KEY: "k" })).toBeNull();
    expect(providerConfig({ AI_PROVIDER: "openai", GEMINI_API_KEY: "k" })).toBeNull();
  });
  it("only enables demo mode for DEMO_MODE=true", () => {
    expect(demoEnabled({ DEMO_MODE: "true" })).toBe(true);
    expect(demoEnabled({ DEMO_MODE: "TRUE " })).toBe(true);
    expect(demoEnabled({})).toBe(false);
    expect(demoEnabled({ DEMO_MODE: "1" })).toBe(false);
  });
});

describe("provider error mapping", () => {
  const gem = (status: number, message = "x") => mapGeminiError(new ApiError({ status, message })).code;
  it("maps Gemini errors to stable codes", () => {
    expect(gem(429)).toBe("PROVIDER_QUOTA");
    expect(gem(503)).toBe("PROVIDER_BUSY");
    expect(gem(500)).toBe("PROVIDER_BUSY");
    expect(gem(504)).toBe("PROVIDER_TIMEOUT");
    expect(gem(403)).toBe("PROVIDER_AUTH");
    expect(gem(400, "API key not valid")).toBe("PROVIDER_AUTH");
    expect(gem(400, "Thinking level MINIMAL is not supported")).toBe("INTERNAL");
    expect(mapGeminiError(new DOMException("aborted", "AbortError")).code).toBe("PROVIDER_TIMEOUT");
    expect(mapGeminiError(new SyntaxError("bad json")).code).toBe("INVALID_AI_RESPONSE");
  });
  it("maps Claude errors to stable codes", () => {
    const headers = new Headers();
    expect(mapClaudeError(new Anthropic.RateLimitError(429, undefined, "rate", headers)).code).toBe("PROVIDER_QUOTA");
    expect(mapClaudeError(new Anthropic.AuthenticationError(401, undefined, "auth", headers)).code).toBe("PROVIDER_AUTH");
    expect(mapClaudeError(new Anthropic.InternalServerError(529, undefined, "overloaded", headers)).code).toBe("PROVIDER_BUSY");
    expect(mapClaudeError(new Anthropic.APIConnectionTimeoutError()).code).toBe("PROVIDER_TIMEOUT");
  });
  it("has a user message for every code, with no technical words", () => {
    for (const message of Object.values(ERROR_MESSAGES)) {
      expect(message).not.toMatch(/\.env|stack|undefined|null|status \d/i);
    }
  });
});

describe("inventory helpers", () => {
  it("puts uncertain items first, then data-bearing ones, keeping order otherwise", () => {
    const sorted = sortForReview(SAMPLE_LISTING.items);
    expect(sorted.slice(0, 3).every((i) => i.confidence === "low")).toBe(true);
    expect(sorted.map((i) => i.type)[0]).toBe("HP small-form-factor desktops");
  });
  it("summarises the inventory", () => {
    expect(inventorySummary(SAMPLE_LISTING.items)).toEqual({ groups: 9, totalQuantity: 54, needsCheck: 3, dataBearing: 13, withBattery: 14 });
  });
});

describe("sample clear-out fixture", () => {
  it("matches the live listing schema and uses only real categories", () => {
    expect(ListingSchema.safeParse(SAMPLE_LISTING).success).toBe(true);
    for (const i of SAMPLE_LISTING.items) expect(i.priceCategoryId === "none" || CATEGORY_IDS.has(i.priceCategoryId)).toBe(true);
  });
  it("shows a data flag, a battery flag and an uncertain item", () => {
    expect(SAMPLE_LISTING.items.some((i) => i.storesData === "yes")).toBe(true);
    expect(SAMPLE_LISTING.items.some((i) => i.hasBattery)).toBe(true);
    expect(SAMPLE_LISTING.items.some((i) => i.confidence === "low")).toBe(true);
  });
});

describe("rate limit", () => {
  it("allows up to the limit per minute, then refuses", () => {
    resetRateLimits();
    const t = 1_000_000;
    expect([1, 2, 3].map(() => allowRequest("ip", 3, t))).toEqual([true, true, true]);
    expect(allowRequest("ip", 3, t)).toBe(false);
    expect(allowRequest("ip", 3, t + 61_000)).toBe(true);
  });
});
