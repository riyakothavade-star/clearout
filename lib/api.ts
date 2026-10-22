import { ZodError } from "zod";
import { AppError, errorResponse } from "./errors";
import { logEvent } from "./log";

// Wraps a route handler so every failure becomes a stable error code with a plain message.
// Invalid form input returns INVALID_DETAILS with the names of the fields that need fixing.
export async function handle(event: string, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ZodError) {
      const fields = [...new Set(error.issues.map((i) => i.path.join(".")).filter(Boolean))];
      logEvent("warn", `${event}.invalid`, { fields: fields.join(",") });
      return errorResponse("INVALID_DETAILS", { fields });
    }
    const appError = error instanceof AppError ? error : new AppError("INTERNAL", error instanceof Error ? error.name : "unknown");
    logEvent(appError.code === "INTERNAL" ? "error" : "warn", `${event}.failed`, { code: appError.code, detail: appError.detail });
    return errorResponse(appError.code);
  }
}

export async function readJson(request: Request, maxBytes = 200_000): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE", `body ${text.length}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("INVALID_REQUEST", "body is not JSON");
  }
}
