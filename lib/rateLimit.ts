// A small in-memory rate limit per visitor IP, to stop one visitor burning through the AI quota.
// Limitation: on Vercel each server instance keeps its own memory, so this is best-effort, not a
// guarantee. A shared store (such as Upstash Redis) would be needed for a strict limit.

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

// Returns true when this request is allowed.
export function allowRequest(key: string, limitPerMinute: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limitPerMinute) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) hits.clear(); // never let the map grow without bound
  return true;
}

export function resetRateLimits() {
  hits.clear();
}
