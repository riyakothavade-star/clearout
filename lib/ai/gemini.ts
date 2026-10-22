import { ApiError, GoogleGenAI, ThinkingLevel, createPartFromBase64, type Part } from "@google/genai";
import { z } from "zod";
import { ListingSchema, type Listing } from "@/lib/schema";
import { LISTING_PROMPT } from "@/lib/prompt";

// The same JSON shape Claude uses, as a plain JSON schema for Gemini.
const listingJsonSchema = z.toJSONSchema(ListingSchema);
delete listingJsonSchema.$schema;

// Sends the photos to Gemini Flash and returns the item list. Throws if anything goes wrong.
export async function readPhotosWithGemini(photos: string[], apiKey: string): Promise<Listing> {
  const parts: Part[] = [];
  photos.forEach((data, i) => {
    parts.push({ text: `Photo ${i + 1}:` });
    parts.push(createPartFromBase64(data, "image/jpeg"));
  });
  parts.push({ text: LISTING_PROMPT });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-flash-latest",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: listingJsonSchema,
        // Listing what's in a photo needs little reasoning; default thinking made each call take 30+ s.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        // When Gemini is busy (503), try up to 3 times, waiting about 1 s then 2 s in between.
        httpOptions: { retryOptions: { attempts: 3, initialDelay: 1, maxDelay: 4, httpStatusCodes: [503] } },
        // All attempts together must finish within 55 s (the route is allowed 60 s).
        abortSignal: AbortSignal.timeout(55_000),
      },
    });
    // Check Gemini's answer against our schema, the same way Claude's is checked.
    const parsed = ListingSchema.safeParse(JSON.parse(response.text ?? ""));
    if (!parsed.success) {
      throw new Error(`Gemini returned JSON in the wrong shape: ${parsed.error.message}`);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`Gemini API error ${error.status}:`, error.message);
    }
    throw error;
  }
}
