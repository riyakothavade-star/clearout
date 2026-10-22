import { handle } from "@/lib/api";
import { requireOps } from "@/lib/jobs/auth";
import { jobStore } from "@/lib/jobs/store";

// GET -> all clear-outs, newest first, as short summaries for the team console.
export async function GET(request: Request) {
  return handle("ops.list", async () => {
    requireOps(request);
    const jobs = (await jobStore().list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const summaries = jobs.map((j) => ({
      ref: j.ref,
      status: j.status,
      demo: j.demo,
      company: j.customer.company,
      contactName: j.customer.contactName,
      preferredDate: j.customer.preferredDate,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
      netHigh: (j.inspection?.quote ?? j.estimate.quote).netHigh,
      netLow: (j.inspection?.quote ?? j.estimate.quote).netLow,
    }));
    return Response.json({ jobs: summaries }, { headers: { "Cache-Control": "no-store" } });
  });
}
