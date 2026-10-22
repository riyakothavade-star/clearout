import { ApiError, GoogleGenAI, ThinkingLevel, createPartFromBase64, type Part } from "@google/genai";
import { z } from "zod";
import { AiListingSchema } from "@/lib/schema";
import { LISTING_PROMPT } from "@/lib/prompt";
import { AppError } from "@/lib/errors";

export const GEMINI_DEFAULT_MODEL = "gemini-flash-latest";

// The same JSON shape Claude uses, as a plain JSON schema for Gemini.
const listingJsonSchema = z.toJSONSchema(AiListingSchema);
delete listingJsonSchema.$schema;

// Turns any Gemini failure into one of the app's error codes.
export function mapGeminiError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ApiError) {
    const detail = `gemini status ${error.status}`;
    if (error.status === 429) return new AppError("PROVIDER_QUOTA", detail);
    if (error.status === 401 || error.status === 403) return new AppError("PROVIDER_AUTH", detail);
    if (error.status === 400 && /api key/i.test(error.message)) return new AppError("PROVIDER_AUTH", detail);
    if (error.status === 408 || error.status === 504) return new AppError("PROVIDER_TIMEOUT", detail);
    if (error.status >= 500) return new AppError("PROVIDER_BUSY", detail);
    // Any other 4xx means our request was wrong (for example an unsupported setting): our bug, not the user's.
    return new AppError("INTERNAL", detail);
  }
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return new AppError("PROVIDER_TIMEOUT", "gemini aborted");
  }
  if (error instanceof SyntaxError) return new AppError("INVALID_AI_RESPONSE", "gemini returned invalid JSON");
  return new AppError("INTERNAL", error instanceof Error ? `gemini ${error.name}` : "gemini unknown error");
}

// Sends the photos to Gemini and returns its raw answer (checked against the AI schema only).
export async function readPhotosWithGemini(photos: string[], apiKey: string): Promise<unknown> {
  const parts: Part[] = [];
  photos.forEach((data, i) => {
    parts.push({ text: `Photo ${i + 1}:` });
    parts.push(createPartFromBase64(data, "image/jpeg"));
  });
  parts.push({ text: LISTING_PROMPT });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: listingJsonSchema,
        // Listing items needs little reasoning; default thinking made each call take 30+ s.
        // MINIMAL is rejected by the current Flash model (HTTP 400), so LOW is the lowest that works.
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        httpOptions: {
          // Each attempt gets 30 s (healthy answers take about 6–21 s); busy or failing servers (5xx) get up
          // to 3 attempts with backoff and jitter. Quota (429), auth and bad-request errors are never retried.
          timeout: 30_000,
          retryOptions: { attempts: 3, initialDelay: 1, maxDelay: 4, jitter: 1, httpStatusCodes: [500, 502, 503, 504] },
        },
        // All attempts together must finish within 50 s (the route is allowed 60 s).
        abortSignal: AbortSignal.timeout(50_000),
      },
    });
    const text = response.text;
    if (!text) throw new AppError("INVALID_AI_RESPONSE", "gemini returned an empty response");
    return JSON.parse(text);
  } catch (error) {
    throw mapGeminiError(error);
  }
}
