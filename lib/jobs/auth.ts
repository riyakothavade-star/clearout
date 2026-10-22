import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";

// Access control.
// - Customers: a job is readable only with its ref AND its random 32-character token (the private link).
// - ClearOut team: /ops needs OPS_PASSCODE. Signing in sets an HTTP-only cookie holding an HMAC of the
//   passcode, so the passcode itself never sits in the browser. Changing OPS_PASSCODE signs everyone out.

export const OPS_COOKIE = "clearout_ops";
export const OPS_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function tokenMatches(expected: string, given: string | null | undefined): boolean {
  return typeof given === "string" && given.length > 0 && safeEqual(expected, given);
}

function passcode(env: Record<string, string | undefined>): string {
  const value = env.OPS_PASSCODE?.trim() ?? "";
  if (value.length < 8) throw new AppError("OPS_DISABLED", "OPS_PASSCODE missing or shorter than 8 characters");
  return value;
}

export function sessionValue(env: Record<string, string | undefined> = process.env): string {
  return createHmac("sha256", passcode(env)).update("clearout-ops-session-v1").digest("hex");
}

export function passcodeMatches(given: unknown, env: Record<string, string | undefined> = process.env): boolean {
  return typeof given === "string" && safeEqual(passcode(env), given.trim());
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

// Throws unless the request carries a valid team session.
export function requireOps(request: Request, env: Record<string, string | undefined> = process.env) {
  const expected = sessionValue(env);
  if (!tokenMatches(expected, readCookie(request, OPS_COOKIE))) throw new AppError("UNAUTHORIZED");
}

export function sessionCookie(value: string, maxAge = OPS_COOKIE_MAX_AGE): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OPS_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
