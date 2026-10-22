import { handle } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { tokenMatches } from "@/lib/jobs/auth";
import { toPublicJob } from "@/lib/jobs/model";
import { jobStore } from "@/lib/jobs/store";

// GET /api/jobs/CO-XXXXXX?t=<token> -> the customer's view of their clear-out.
// A wrong or missing token gets the same "not found" answer as a missing job, so refs can't be probed.
export async function GET(request: Request, { params }: { params: Promise<{ ref: string }> }) {
  return handle("jobs.read", async () => {
    const { ref } = await params;
    const token = new URL(request.url).searchParams.get("t");
    const job = await jobStore().get(ref);
    if (!job || !tokenMatches(job.token, token)) throw new AppError("JOB_NOT_FOUND", ref);
    return Response.json({ job: toPublicJob(job) }, { headers: { "Cache-Control": "no-store" } });
  });
}
