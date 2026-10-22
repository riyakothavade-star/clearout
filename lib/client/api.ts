import { ERROR_MESSAGES, isErrorCode } from "@/lib/errors";

export type ApiFailure = { ok: false; code: string; message: string; fields: string[] };
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

const NETWORK = "We couldn't reach ClearOut. Check your connection and try again.";

// Calls one of our API routes and turns any failure into a safe, plain message.
export async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<ApiResult<T>> {
  const { json, ...rest } = init;
  try {
    const res = await fetch(url, {
      ...rest,
      headers: json === undefined ? rest.headers : { "Content-Type": "application/json", ...rest.headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
      signal: rest.signal ?? AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as { error?: { code?: unknown; fields?: unknown } } | null;
    if (res.ok && body) return { ok: true, data: body as T };
    const code = isErrorCode(body?.error?.code) ? body.error.code : "INTERNAL";
    const fields = Array.isArray(body?.error?.fields) ? (body.error.fields as string[]) : [];
    return { ok: false, code, message: ERROR_MESSAGES[code], fields };
  } catch {
    return { ok: false, code: "NETWORK", message: NETWORK, fields: [] };
  }
}
