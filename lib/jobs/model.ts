import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { PRICES } from "@/lib/prices";
import { computeQuote } from "@/lib/quote";
import { ItemSchema, MAX_ITEMS, QuoteSchema, type Item } from "@/lib/schema";

// A clear-out "job": one company's request, from estimate to closure. Every change goes through the
// functions in this file, which enforce the order of the service steps on the server:
//
//   requested → scheduled → inspected → wiped → paid → closed      (cancelled is possible before paid)
//
// The customer sees the job through a private link (ref + token). The ClearOut team changes it in /ops.

import { STATUSES, type JobStatus } from "./status";
export { STATUSES, STATUS_LABELS, type JobStatus } from "./status";

export const MAX_DATA_DEVICES = 300;

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// ---- What the customer submits ------------------------------------------------------------

export const CustomerSchema = z.object({
  company: trimmed(2, 120),
  contactName: trimmed(2, 80),
  email: z.string().trim().max(120).email(),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^$|^\+?[0-9 ()-]{7,20}$/, "Use digits, spaces, + or -")
    .optional()
    .default(""),
  address: trimmed(5, 300),
  preferredDate: isoDate,
  notes: z.string().trim().max(500).optional().default(""),
});

export const VisitRequestSchema = z.object({
  customer: CustomerSchema,
  consent: z.literal(true),
  source: z.enum(["ai", "sample"]),
  items: z.array(ItemSchema).min(1).max(MAX_ITEMS),
});

export type Customer = z.infer<typeof CustomerSchema>;
export type VisitRequest = z.infer<typeof VisitRequestSchema>;

// ---- The stored job -----------------------------------------------------------------------

export const DeviceSchema = z.object({
  id: z.string(),
  itemIndex: z.number().int().min(0),
  label: z.string(),
  serial: z.string(),
  outcome: z.enum(["wiped", "destroyed", "no-storage"]).nullable(),
  method: z.string(),
  evidence: z.string(),
  technician: z.string(),
  recordedAt: z.string().nullable(),
});

const EventSchema = z.object({ at: z.string(), status: z.enum(STATUSES), note: z.string() });

export const JobSchema = z.object({
  ref: z.string(),
  token: z.string(),
  revision: z.number().int().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(STATUSES),
  demo: z.boolean(),
  customer: CustomerSchema,
  estimate: z.object({ source: z.enum(["ai", "sample"]), items: z.array(ItemSchema), quote: QuoteSchema }),
  visit: z.object({ date: isoDate, slot: z.enum(["morning", "afternoon"]), technician: z.string() }).nullable(),
  inspection: z.object({ items: z.array(ItemSchema), quote: QuoteSchema, notes: z.string(), at: z.string() }).nullable(),
  devices: z.array(DeviceSchema),
  payout: z
    .object({
      amount: z.number().int().min(0),
      method: z.enum(["bank-transfer", "upi", "cheque"]),
      reference: z.string(),
      simulated: z.literal(true),
      at: z.string(),
    })
    .nullable(),
  closure: z.object({ at: z.string(), summary: z.string() }).nullable(),
  events: z.array(EventSchema),
});

export type Job = z.infer<typeof JobSchema>;
export type Device = z.infer<typeof DeviceSchema>;

// What the customer's tracking page receives: everything except the access token.
export type PublicJob = Omit<Job, "token">;
export function toPublicJob(job: Job): PublicJob {
  const publicJob: Partial<Job> = { ...job };
  delete publicJob.token;
  return publicJob as PublicJob;
}

// ---- Identifiers --------------------------------------------------------------------------

const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L
export const REF_PATTERN = /^CO-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export function newRef(): string {
  let id = "";
  for (let i = 0; i < 6; i++) id += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `CO-${id}`;
}

export const newToken = () => randomBytes(16).toString("hex");

// ---- Steps -------------------------------------------------------------------------------

const now = () => new Date().toISOString();

function requireStatus(job: Job, allowed: JobStatus[], step: string) {
  if (!allowed.includes(job.status)) throw new AppError("INVALID_STEP", `${step} not allowed in status ${job.status}`);
}

function withEvent(job: Job, status: JobStatus, note: string): Job {
  const at = now();
  return { ...job, status, updatedAt: at, events: [...job.events, { at, status, note }] };
}

// Today's date in India (the service area), as YYYY-MM-DD.
export function todayInIndia(date = new Date()): string {
  return new Date(date.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function createJob(request: VisitRequest): Job {
  if (request.customer.preferredDate < todayInIndia()) {
    throw new AppError("INVALID_DETAILS", "preferredDate in the past");
  }
  const at = now();
  // The quote is always recalculated on the server; a quote sent by the browser is never trusted.
  const quote = computeQuote(request.items, PRICES);
  return {
    ref: newRef(),
    token: newToken(),
    revision: 1,
    createdAt: at,
    updatedAt: at,
    status: "requested",
    demo: request.source === "sample",
    customer: request.customer,
    estimate: { source: request.source, items: request.items, quote },
    visit: null,
    inspection: null,
    devices: [],
    payout: null,
    closure: null,
    events: [{ at, status: "requested", note: "Visit requested from the online estimate." }],
  };
}

// Inputs for each team action.
export const ScheduleSchema = z.object({ date: isoDate, slot: z.enum(["morning", "afternoon"]), technician: trimmed(2, 80) });
export const InspectSchema = z.object({ items: z.array(ItemSchema).min(1).max(MAX_ITEMS), notes: z.string().trim().max(1000).default("") });
export const DeviceRecordSchema = z.object({
  deviceId: z.string().min(1).max(20),
  serial: trimmed(1, 60),
  outcome: z.enum(["wiped", "destroyed", "no-storage"]),
  method: trimmed(2, 120),
  evidence: trimmed(2, 300),
  technician: trimmed(2, 80),
});
export const PayoutSchema = z.object({
  amount: z.number().int().min(0).max(10_000_000),
  method: z.enum(["bank-transfer", "upi", "cheque"]),
  reference: trimmed(2, 80),
});
export const CancelSchema = z.object({ reason: trimmed(2, 300) });

export function scheduleVisit(job: Job, input: z.infer<typeof ScheduleSchema>): Job {
  requireStatus(job, ["requested", "scheduled"], "schedule");
  const rescheduled = job.status === "scheduled";
  const slot = input.slot === "morning" ? "morning (9am–1pm)" : "afternoon (2pm–6pm)";
  return withEvent(
    { ...job, visit: input },
    "scheduled",
    `${rescheduled ? "Visit rescheduled" : "Visit scheduled"} for ${input.date}, ${slot}, with ${input.technician}.`,
  );
}

// One wipe record per data-bearing unit ("yes" or "maybe" storage), from the confirmed items.
export function devicesFor(items: Item[]): Device[] {
  const devices: Device[] = [];
  items.forEach((item, itemIndex) => {
    if (item.storesData === "no") return;
    for (let unit = 1; unit <= item.quantity; unit++) {
      devices.push({
        id: `${itemIndex}-${unit}`,
        itemIndex,
        label: `${item.type} · unit ${unit} of ${item.quantity}`,
        serial: "",
        outcome: null,
        method: "",
        evidence: "",
        technician: "",
        recordedAt: null,
      });
    }
  });
  if (devices.length > MAX_DATA_DEVICES) throw new AppError("INVALID_DETAILS", `too many data devices: ${devices.length}`);
  return devices;
}

export function recordInspection(job: Job, input: z.infer<typeof InspectSchema>): Job {
  requireStatus(job, ["scheduled", "inspected"], "inspect");
  const quote = computeQuote(input.items, PRICES);
  const devices = devicesFor(input.items);
  return withEvent(
    { ...job, inspection: { items: input.items, quote, notes: input.notes, at: now() }, devices },
    "inspected",
    `Items confirmed on site: ${input.items.length} item groups, ${devices.length} data-bearing unit${devices.length === 1 ? "" : "s"} to wipe or destroy.`,
  );
}

export function recordDevice(job: Job, input: z.infer<typeof DeviceRecordSchema>): Job {
  requireStatus(job, ["inspected"], "record device");
  const index = job.devices.findIndex((d) => d.id === input.deviceId);
  if (index < 0) throw new AppError("INVALID_DETAILS", `unknown device ${input.deviceId}`);
  const devices = [...job.devices];
  devices[index] = { ...devices[index], ...input, id: devices[index].id, recordedAt: now() };
  return { ...job, devices, updatedAt: now() };
}

export const pendingDevices = (job: Job) => job.devices.filter((d) => d.outcome === null);

export function completeWipe(job: Job): Job {
  requireStatus(job, ["inspected"], "complete wipe");
  const pending = pendingDevices(job).length;
  // The gate: nothing moves on to payment while any data-bearing unit lacks evidence.
  if (pending > 0) throw new AppError("INVALID_STEP", `${pending} devices without evidence`);
  const note = job.devices.length
    ? `All ${job.devices.length} data-bearing units have wipe or destruction evidence recorded.`
    : "No data-bearing units were found on site.";
  return withEvent(job, "wiped", note);
}

export function recordPayout(job: Job, input: z.infer<typeof PayoutSchema>): Job {
  requireStatus(job, ["wiped"], "record payout");
  const method = { "bank-transfer": "bank transfer", upi: "UPI", cheque: "cheque" }[input.method];
  return withEvent(
    { ...job, payout: { ...input, simulated: true, at: now() } },
    "paid",
    `Payment of ₹${input.amount.toLocaleString("en-IN")} recorded by ${method}, reference ${input.reference} (simulated in this prototype: no money moved).`,
  );
}

export function closeJob(job: Job): Job {
  requireStatus(job, ["paid"], "close");
  const wiped = job.devices.filter((d) => d.outcome === "wiped").length;
  const destroyed = job.devices.filter((d) => d.outcome === "destroyed").length;
  const summary = `${job.inspection?.items.length ?? 0} item groups collected; ${wiped} units wiped, ${destroyed} destroyed; payment ₹${(job.payout?.amount ?? 0).toLocaleString("en-IN")}.`;
  return withEvent({ ...job, closure: { at: now(), summary } }, "closed", `Clear-out closed. ${summary}`);
}

export function cancelJob(job: Job, input: z.infer<typeof CancelSchema>): Job {
  requireStatus(job, ["requested", "scheduled", "inspected", "wiped"], "cancel");
  return withEvent(job, "cancelled", `Cancelled: ${input.reason}`);
}
