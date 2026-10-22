import { handle, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { logEvent } from "@/lib/log";
import { passcodeMatches, requireOps, sessionCookie, sessionValue } from "@/lib/jobs/auth";
import { allowRequest, clientIp } from "@/lib/rateLimit";

// GET: is this browser signed in?  POST { passcode }: sign in.  DELETE: sign out.
export async function GET(request: Request) {
  return handle("ops.session", async () => {
    requireOps(request);
    return Response.json({ signedIn: true });
  });
}

export async function POST(request: Request) {
  return handle("ops.login", async () => {
    if (!allowRequest(`ops-login:${clientIp(request)}`, 5)) throw new AppError("RATE_LIMITED");
    const body = (await readJson(request, 2_000)) as { passcode?: unknown } | null;
    if (!passcodeMatches(body?.passcode)) {
      logEvent("warn", "ops.login_rejected");
      throw new AppError("UNAUTHORIZED", "wrong passcode");
    }
    return Response.json({ signedIn: true }, { headers: { "Set-Cookie": sessionCookie(sessionValue()) } });
  });
}

export async function DELETE() {
  return Response.json({ signedIn: false }, { headers: { "Set-Cookie": sessionCookie("", 0) } });
}
