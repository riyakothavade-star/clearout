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
  INVALID_DETAILS: "Some details are missing or invalid. Please check the highlighted fields.",
  STORAGE_NOT_CONFIGURED: "Requests can't be saved on this site yet (storage isn't set up).",
  JOB_NOT_FOUND: "We couldn't find that clear-out. Check the link and try again.",
  INVALID_STEP: "That step isn't available yet for this clear-out.",
  CONFLICT: "This clear-out was just updated by someone else. Reload to see the latest version.",
  UNAUTHORIZED: "Please sign in to the ClearOut team console.",
  OPS_DISABLED: "The ClearOut team console isn't set up on this site (no passcode configured).",
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
  INVALID_DETAILS: 400,
  STORAGE_NOT_CONFIGURED: 503,
  JOB_NOT_FOUND: 404,
  INVALID_STEP: 409,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  OPS_DISABLED: 503,
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

export function errorResponse(code: ErrorCode, extra?: { fields?: string[] }): Response {
  return Response.json({ error: { code, message: ERROR_MESSAGES[code], ...extra } }, { status: STATUS[code] });
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERROR_MESSAGES;
}
