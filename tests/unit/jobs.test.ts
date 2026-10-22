import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { SAMPLE_LISTING } from "@/lib/demo";
import { AppError } from "@/lib/errors";
import { passcodeMatches, sessionValue, tokenMatches } from "@/lib/jobs/auth";
import {
  REF_PATTERN,
  cancelJob,
  closeJob,
  completeWipe,
  createJob,
  devicesFor,
  recordDevice,
  recordInspection,
  recordPayout,
  scheduleVisit,
  todayInIndia,
  toPublicJob,
  type Job,
  type VisitRequest,
} from "@/lib/jobs/model";
import { FileJobStore } from "@/lib/jobs/store";

const future = () => {
  const d = new Date(Date.now() + 7 * 86_400_000);
  return d.toISOString().slice(0, 10);
};

export const visitRequest = (over: Partial<VisitRequest> = {}): VisitRequest => ({
  customer: {
    company: "Acme Tech Pvt Ltd",
    contactName: "Asha Rao",
    email: "asha@acme.example",
    phone: "+91 98450 00000",
    address: "4th floor, 12 MG Road, Bengaluru 560001",
    preferredDate: future(),
    notes: "",
  },
  consent: true,
  source: "sample",
  items: SAMPLE_LISTING.items,
  ...over,
});

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : "OTHER";
  }
  return "OK";
};

const device = (id: string) => ({ deviceId: id, serial: `SN-${id}`, outcome: "wiped" as const, method: "NIST 800-88 Purge (software)", evidence: `Report ${id}`, technician: "Ravi" });

function walkToWiped(): Job {
  let job = createJob(visitRequest());
  job = scheduleVisit(job, { date: future(), slot: "morning", technician: "Ravi K" });
  job = recordInspection(job, { items: SAMPLE_LISTING.items, notes: "" });
  for (const d of job.devices) job = recordDevice(job, device(d.id));
  return completeWipe(job);
}

describe("creating a job", () => {
  it("gets a readable ref, a long random token, and a server-calculated quote", () => {
    const job = createJob(visitRequest());
    expect(job.ref).toMatch(REF_PATTERN);
    expect(job.token).toMatch(/^[0-9a-f]{32}$/);
    expect([job.estimate.quote.netLow, job.estimate.quote.netHigh]).toEqual([18192, 44448]);
    expect(job.status).toBe("requested");
    expect(job.demo).toBe(true);
    expect(createJob(visitRequest({ source: "ai" })).demo).toBe(false);
  });
  it("refuses a preferred date in the past", () => {
    const req = visitRequest();
    req.customer.preferredDate = "2020-01-01";
    expect(code(() => createJob(req))).toBe("INVALID_DETAILS");
    req.customer.preferredDate = todayInIndia();
    expect(code(() => createJob(req))).toBe("OK");
  });
  it("never exposes the token in the customer view", () => {
    expect(toPublicJob(createJob(visitRequest()))).not.toHaveProperty("token");
  });
});

describe("service steps", () => {
  it("creates one wipe record per data-bearing unit", () => {
    // sample: 6 + 2 laptops, 3 desktops, 1 maybe-NAS, 1 maybe-switch = 13
    expect(devicesFor(SAMPLE_LISTING.items)).toHaveLength(13);
  });

  it("walks the full journey to a closed job", () => {
    let job = walkToWiped();
    expect(job.status).toBe("wiped");
    job = recordPayout(job, { amount: 30000, method: "upi", reference: "UPI-123" });
    expect(job.payout).toMatchObject({ amount: 30000, simulated: true });
    job = closeJob(job);
    expect(job.status).toBe("closed");
    expect(job.closure?.summary).toContain("13 units wiped");
    expect(job.events.map((e) => e.status)).toEqual(["requested", "scheduled", "inspected", "wiped", "paid", "closed"]);
  });

  it("blocks payment until every data-bearing unit has evidence (the wipe gate)", () => {
    let job = createJob(visitRequest());
    job = scheduleVisit(job, { date: future(), slot: "afternoon", technician: "Ravi K" });
    job = recordInspection(job, { items: SAMPLE_LISTING.items, notes: "" });
    job = recordDevice(job, device(job.devices[0].id));
    expect(code(() => completeWipe(job))).toBe("INVALID_STEP");
    expect(code(() => recordPayout(job, { amount: 1, method: "upi", reference: "x1" }))).toBe("INVALID_STEP");
  });

  it("refuses steps out of order", () => {
    const job = createJob(visitRequest());
    expect(code(() => recordInspection(job, { items: SAMPLE_LISTING.items, notes: "" }))).toBe("INVALID_STEP");
    expect(code(() => closeJob(job))).toBe("INVALID_STEP");
    expect(code(() => recordDevice(job, device("0-1")))).toBe("INVALID_STEP");
  });

  it("recalculates the quote from the confirmed items", () => {
    let job = scheduleVisit(createJob(visitRequest()), { date: future(), slot: "morning", technician: "Ravi K" });
    job = recordInspection(job, { items: [{ ...SAMPLE_LISTING.items[0], quantity: 1, condition: "good" }], notes: "Only one laptop found" });
    expect(job.inspection?.quote.subtotalLow).toBe(1200);
    expect(job.devices).toHaveLength(1);
  });

  it("allows a job with no data devices to pass the wipe step", () => {
    let job = scheduleVisit(createJob(visitRequest()), { date: future(), slot: "morning", technician: "Ravi K" });
    job = recordInspection(job, { items: [SAMPLE_LISTING.items[2]], notes: "" }); // monitors only
    expect(job.devices).toHaveLength(0);
    expect(completeWipe(job).status).toBe("wiped");
  });

  it("can cancel before payment but not after", () => {
    expect(cancelJob(createJob(visitRequest()), { reason: "Customer changed plans" }).status).toBe("cancelled");
    const paid = recordPayout(walkToWiped(), { amount: 5, method: "cheque", reference: "CHQ-1" });
    expect(code(() => cancelJob(paid, { reason: "too late" }))).toBe("INVALID_STEP");
  });

  it("rejects an unknown device id", () => {
    let job = scheduleVisit(createJob(visitRequest()), { date: future(), slot: "morning", technician: "Ravi K" });
    job = recordInspection(job, { items: SAMPLE_LISTING.items, notes: "" });
    expect(code(() => recordDevice(job, device("99-1")))).toBe("INVALID_DETAILS");
  });
});

describe("file job store", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "clearout-jobs-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const store = new FileJobStore(dir);

  it("creates, reads, updates and lists jobs", async () => {
    const job = createJob(visitRequest());
    await store.create(job);
    expect((await store.get(job.ref))?.customer.company).toBe("Acme Tech Pvt Ltd");
    const updated = await store.update(scheduleVisit(job, { date: future(), slot: "morning", technician: "Ravi K" }));
    expect(updated.revision).toBe(2);
    expect((await store.list()).map((j) => j.ref)).toContain(job.ref);
  });

  it("refuses an update based on a stale revision", async () => {
    const job = createJob(visitRequest());
    await store.create(job);
    await store.update({ ...job, notes: undefined } as Job);
    await expect(store.update(job)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses refs that could escape the folder", async () => {
    expect(await store.get("../../etc/passwd")).toBeNull();
    expect(await store.get("CO-AAAAAA")).toBeNull();
  });
});

describe("access control", () => {
  it("matches tokens exactly", () => {
    expect(tokenMatches("abc123", "abc123")).toBe(true);
    expect(tokenMatches("abc123", "abc124")).toBe(false);
    expect(tokenMatches("abc123", null)).toBe(false);
    expect(tokenMatches("abc123", "")).toBe(false);
  });
  it("needs a passcode of at least 8 characters", () => {
    expect(() => sessionValue({})).toThrow();
    expect(() => sessionValue({ OPS_PASSCODE: "short" })).toThrow();
    expect(passcodeMatches("long-enough-pass", { OPS_PASSCODE: "long-enough-pass" })).toBe(true);
    expect(passcodeMatches("wrong-pass-here", { OPS_PASSCODE: "long-enough-pass" })).toBe(false);
    expect(sessionValue({ OPS_PASSCODE: "long-enough-pass" })).not.toContain("long-enough-pass");
  });
});
