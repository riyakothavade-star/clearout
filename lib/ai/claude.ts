import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AiListingSchema } from "@/lib/schema";
import { LISTING_PROMPT } from "@/lib/prompt";
import { AppError } from "@/lib/errors";

export const CLAUDE_MODEL = "claude-sonnet-5-5";

// Turns any Claude failure into one of the app's error codes.
export function mapClaudeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new AppError("PROVIDER_TIMEOUT", "claude timeout");
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AppError("PROVIDER_AUTH", `claude status ${error.status}`);
  }
  if (error instanceof Anthropic.RateLimitError) return new AppError("PROVIDER_QUOTA", "claude status 429");
  if (error instanceof Anthropic.InternalServerError) return new AppError("PROVIDER_BUSY", `claude status ${error.status}`);
  if (error instanceof Anthropic.APIConnectionError) return new AppError("PROVIDER_BUSY", "claude connection error");
  if (error instanceof Anthropic.APIError) return new AppError("INTERNAL", `claude status ${error.status}`);
  return new AppError("INTERNAL", error instanceof Error ? `claude ${error.name}` : "claude unknown error");
}

// Sends the photos to Claude and returns its parsed answer (checked against the AI schema).
export async function readPhotosWithClaude(photos: string[], apiKey: string): Promise<unknown> {
  const content: Anthropic.ContentBlockParam[] = [];
  photos.forEach((data, i) => {
    content.push({ type: "text", text: `Photo ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
  });
  content.push({ type: "text", text: LISTING_PROMPT });

  try {
    // 25 s per attempt, one retry on transient errors (the SDK retries 408/409/429/5xx with backoff).
    const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 });
    const response = await client.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(AiListingSchema) },
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new AppError("INVALID_AI_RESPONSE", `claude stop_reason ${response.stop_reason}`);
    }
    return response.parsed_output;
  } catch (error) {
    throw mapClaudeError(error);
  }
}
