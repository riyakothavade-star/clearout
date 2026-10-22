import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ListingSchema, type Listing } from "@/lib/schema";
import { LISTING_PROMPT } from "@/lib/prompt";

// Sends the photos to Claude and returns the item list. Throws if anything goes wrong.
export async function readPhotosWithClaude(photos: string[], apiKey: string): Promise<Listing> {
  const content: Anthropic.ContentBlockParam[] = [];
  photos.forEach((data, i) => {
    content.push({ type: "text", text: `Photo ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
  });
  content.push({ type: "text", text: LISTING_PROMPT });

  try {
    const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
    const response = await client.messages.parse({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(ListingSchema) },
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error(`Claude returned no listing (stop_reason: ${response.stop_reason})`);
    }
    return response.parsed_output;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Claude rejected the API key:", error.message);
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Claude API error ${error.status}:`, error.message);
    }
    throw error;
  }
}
