import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { logEvent } from "@/lib/log";
import { requireOps } from "@/lib/jobs/auth";
import {
  CancelSchema,
  DeviceRecordSchema,
  InspectSchema,
  PayoutSchema,
  ScheduleSchema,
  cancelJob,
  closeJob,
  completeWipe,
  recordDevice,
  recordInspection,
  recordPayout,
  scheduleVisit,
  type Job,
} from "@/lib/jobs/model";
import { jobStore } from "@/lib/jobs/store";

async function load(ref: string): Promise<Job> {
  const job = await jobStore().get(ref);
  if (!job) throw new AppError("JOB_NOT_FOUND", ref);
  return job;
}

// GET -> the full job for the team (includes the customer's private link).
export async function GET(request: Request, { params }: { params: Promise<{ ref: string }> }) {
  return handle("ops.read", async () => {
    requireOps(request);
    const { ref } = await params;
    return Response.json({ job: await load(ref) }, { headers: { "Cache-Control": "no-store" } });
  });
}

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("schedule"), revision: z.number().int(), input: ScheduleSchema }),
  z.object({ action: z.literal("inspect"), revision: z.number().int(), input: InspectSchema }),
  z.object({ action: z.literal("device"), revision: z.number().int(), input: DeviceRecordSchema }),
  z.object({ action: z.literal("completeWipe"), revision: z.number().int() }),
  z.object({ action: z.literal("payout"), revision: z.number().int(), input: PayoutSchema }),
  z.object({ action: z.literal("close"), revision: z.number().int() }),
  z.object({ action: z.literal("cancel"), revision: z.number().int(), input: CancelSchema }),
]);

// POST { action, revision, input } -> the updated job. `revision` must be the one the team member saw,
// so two people working on the same job can't silently overwrite each other.
export async function POST(request: Request, { params }: { params: Promise<{ ref: string }> }) {
  return handle("ops.action", async () => {
    requireOps(request);
    const { ref } = await params;
    const body = ActionSchema.parse(await readJson(request));
    const job = await load(ref);
    if (job.revision !== body.revision) throw new AppError("CONFLICT", `saw ${body.revision}, now ${job.revision}`);

    const next =
      body.action === "schedule" ? scheduleVisit(job, body.input)
      : body.action === "inspect" ? recordInspection(job, body.input)
      : body.action === "device" ? recordDevice(job, body.input)
      : body.action === "completeWipe" ? completeWipe(job)
      : body.action === "payout" ? recordPayout(job, body.input)
      : body.action === "close" ? closeJob(job)
      : cancelJob(job, body.input);

    const saved = await jobStore().update(next);
    logEvent("info", "ops.action", { ref, action: body.action, status: saved.status });
    return Response.json({ job: saved });
  });
}
