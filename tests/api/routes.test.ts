import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { SAMPLE_LISTING } from "@/lib/demo";
import { resetRateLimits } from "@/lib/rateLimit";
import { fakeJpeg } from "../helpers";

// No test here talks to a real AI provider: the Gemini call is replaced with a controllable fake.
const gemini = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/ai/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/gemini")>()),
  readPhotosWithGemini: gemini.read,
}));
vi.mock("next/server", () => ({ connection: async () => {} }));

const { POST: listing } = await import("@/app/api/listing/route");
const { POST: quote } = await import("@/app/api/quote/route");
const { GET: demo } = await import("@/app/api/demo/route");
const { GET: status } = await import("@/app/api/status/route");

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const errorCode = async (res: Response) => ((await res.json()) as { error: { code: string; message: string } }).error.code;

beforeEach(() => {
  resetRateLimits();
  gemini.read.mockReset();
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("N8N_QUOTE_URL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/listing", () => {
  const photo = fakeJpeg(1200, 900);

  it("returns a checked listing for a valid AI answer", async () => {
    gemini.read.mockResolvedValue({ items: [{ ...SAMPLE_LISTING.items[0], priceCategoryId: "unknown-thing" }], noElectronicsReason: "" });
    const res = await listing(post({ photos: [photo] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("ai");
    expect(body.items[0].priceCategoryId).toBe("none");
    expect(gemini.read).toHaveBeenCalledWith([photo], "test-key");
  });

  it("explains a missing key without calling the AI", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await listing(post({ photos: [photo] }));
    expect(res.status).toBe(503);
    expect(await errorCode(res)).toBe("NOT_CONFIGURED");
    expect(gemini.read).not.toHaveBeenCalled();
  });

  it.each([
    ["PROVIDER_BUSY", 503],
    ["PROVIDER_TIMEOUT", 504],
    ["PROVIDER_QUOTA", 503],
    ["PROVIDER_AUTH", 503],
  ] as const)("maps provider failure %s to a stable error", async (code, httpStatus) => {
    gemini.read.mockRejectedValue(new AppError(code, "secret provider detail"));
    const res = await listing(post({ photos: [photo] }));
    expect(res.status).toBe(httpStatus);
    const text = await res.text();
    expect(text).toContain(code);
    expect(text).not.toContain("secret provider detail");
  });

  it("rejects malformed AI output", async () => {
    gemini.read.mockResolvedValue({ items: [{ type: "laptop", quantity: -5 }] });
    const res = await listing(post({ photos: [photo] }));
    expect(await errorCode(res)).toBe("INVALID_AI_RESPONSE");
  });

  it("turns unexpected exceptions into a generic error with no stack trace", async () => {
    gemini.read.mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'x')"));
    const res = await listing(post({ photos: [photo] }));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/Cannot read|TypeError|at /);
  });

  it.each([
    ["no photos", { photos: [] }, "NO_PHOTOS"],
    ["too many photos", { photos: Array(6).fill(photo) }, "TOO_MANY_PHOTOS"],
    ["a non-image", { photos: [Buffer.from("%PDF-1.4 hello").toString("base64")] }, "INVALID_IMAGE"],
    ["not JSON", "this is not json", "INVALID_REQUEST"],
  ])("rejects %s before calling the AI", async (_label, body, code) => {
    const res = await listing(post(body));
    expect(await errorCode(res)).toBe(code);
    expect(gemini.read).not.toHaveBeenCalled();
  });

  it("rejects oversized payloads", async () => {
    const res = await listing(post({ photos: [photo] }, { "content-length": "9000000" }));
    expect(res.status).toBe(413);
    expect(await errorCode(res)).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rate-limits repeated requests from one visitor", async () => {
    gemini.read.mockResolvedValue({ items: [], noElectronicsReason: "nothing" });
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await listing(post({ photos: [photo] }, { "x-forwarded-for": "1.2.3.4" }))).status);
    expect(codes.slice(0, 6).every((c) => c === 200)).toBe(true);
    expect(codes[7]).toBe(429);
  });
});

describe("POST /api/quote", () => {
  it("quotes valid items with the canonical engine", async () => {
    const res = await quote(post({ items: SAMPLE_LISTING.items }));
    const body = await res.json();
    expect(body.source).toBe("local");
    expect([body.quote.netLow, body.quote.netHigh]).toEqual([18192, 44448]);
  });

  it.each([
    ["empty list", { items: [] }],
    ["negative quantity", { items: [{ ...SAMPLE_LISTING.items[0], quantity: -2 }] }],
    ["fractional quantity", { items: [{ ...SAMPLE_LISTING.items[0], quantity: 1.5 }] }],
    ["bad condition", { items: [{ ...SAMPLE_LISTING.items[0], condition: "mint" }] }],
    ["not JSON", "{oops"],
  ])("rejects a %s instead of quoting it", async (_label, body) => {
    const res = await quote(post(body));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("INVALID_REQUEST");
  });

  it("falls back to the canonical quote when n8n is unreachable", async () => {
    vi.stubEnv("N8N_QUOTE_URL", "http://127.0.0.1:9/unreachable");
    const res = await quote(post({ items: SAMPLE_LISTING.items }));
    const body = await res.json();
    expect(body.source).toBe("local");
    expect(body.quote.netLow).toBe(18192);
  });

  it("ignores an n8n answer that disagrees with the canonical rules", async () => {
    vi.stubEnv("N8N_QUOTE_URL", "http://n8n.test/webhook");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ lines: [], buybackPercent: 99, fee: 0, subtotalLow: 1, subtotalHigh: 1, netLow: 999999, netHigh: 999999, pricedOnSiteCount: 0 }));
    const body = await (await quote(post({ items: SAMPLE_LISTING.items }))).json();
    expect(body.source).toBe("local");
    expect(body.quote.netHigh).toBe(44448);
  });
});

describe("GET /api/demo and /api/status", () => {
  it("serves the labelled sample without any AI call", async () => {
    const body = await (await demo()).json();
    expect(body.source).toBe("sample");
    expect(body.items).toHaveLength(SAMPLE_LISTING.items.length);
    expect(gemini.read).not.toHaveBeenCalled();
  });

  it("refuses the sample when demo mode is off", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const res = await demo();
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("DEMO_DISABLED");
  });

  it("reports only yes/no capability flags, never secrets", async () => {
    const res = await status();
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ analysisConfigured: true, demoEnabled: true });
    expect(text).not.toContain("test-key");
    expect(text).not.toContain("gemini");
  });
});
