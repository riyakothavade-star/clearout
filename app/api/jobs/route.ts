import { handle, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { logEvent } from "@/lib/log";
import { createJob, VisitRequestSchema } from "@/lib/jobs/model";
import { jobStore } from "@/lib/jobs/store";
import { allowRequest, clientIp } from "@/lib/rateLimit";

// POST { customer, consent, source, items } -> { ref, token }
// Creates a clear-out request. The quote is recalculated here; nothing the browser says about money is trusted.
export async function POST(request: Request) {
  return handle("jobs.create", async () => {
    if (!allowRequest(`jobs:${clientIp(request)}`, 5)) throw new AppError("RATE_LIMITED");
    const input = VisitRequestSchema.parse(await readJson(request));
    const job = createJob(input);
    await jobStore().create(job);
    logEvent("info", "jobs.created", { ref: job.ref, demo: job.demo, items: job.estimate.items.length });
    return Response.json({ ref: job.ref, token: job.token }, { status: 201 });
  });
}
