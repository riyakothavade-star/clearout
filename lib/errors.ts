// Stable error codes the API returns, and the plain message the user sees for each.
// Technical details (provider messages, stack traces) only ever go to the server log.

export const ERROR_MESSAGES = {
  NO_PHOTOS: "Add 1–5 photos of the pile.",
  TOO_MANY_PHOTOS: "Up to 5 photos, please.",
  INVALID_IMAGE: "One of the photos couldn't be read. Please re-select it as a JPEG or PNG.",
  PAYLOAD_TOO_LARGE: "The photos are too large to send. Try fewer or smaller photos.",
  INVALID_REQUEST: "Something was wrong with that request. Please reload the page and try again.",
  RATE_LIMITED: "Too many requests in a short time. Please wait a minute and try again.",
  NOT_CONFIGURED: "Photo analysis isn't set up on this site yet. You can still view the sample clear-out.",
  PROVIDER_AUTH: "Photo analysis isn't available right now (the AI service rejected our credentials).",
  PROVIDER_QUOTA: "The AI service's usage limit is used up for now. Please try again later.",
  PROVIDER_BUSY: "The AI service is busy right now. Please try again in a moment.",
  PROVIDER_TIMEOUT: "The analysis took too long. Please try again, ideally with fewer photos.",
  INVALID_AI_RESPONSE: "We couldn't read the analysis result. Please try again.",
  QUOTE_FAILED: "We couldn't calculate your estimate.",
  DEMO_DISABLED: "The sample clear-out isn't enabled on this site.",
  INTERNAL: "Something went wrong on our side. Please try again.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

const STATUS: Record<ErrorCode, number> = {
  NO_PHOTOS: 400,
  TOO_MANY_PHOTOS: 400,
  INVALID_IMAGE: 400,
  PAYLOAD_TOO_LARGE: 413,
  INVALID_REQUEST: 400,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
  PROVIDER_AUTH: 503,
  PROVIDER_QUOTA: 503,
  PROVIDER_BUSY: 503,
  PROVIDER_TIMEOUT: 504,
  INVALID_AI_RESPONSE: 502,
  QUOTE_FAILED: 502,
  DEMO_DISABLED: 404,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    // Safe-to-log detail for the server log only. Never sent to the browser.
    public readonly detail?: string,
  ) {
    super(code);
    this.name = "AppError";
  }
}

export function errorResponse(code: ErrorCode, extra?: Record<string, string>): Response {
  return Response.json({ error: { code, message: ERROR_MESSAGES[code], ...extra } }, { status: STATUS[code] });
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERROR_MESSAGES;
}
