import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_LISTING } from "@/lib/demo";
import { resetJobStore } from "@/lib/jobs/store";
import { resetRateLimits } from "@/lib/rateLimit";

const { POST: createJobRoute } = await import("@/app/api/jobs/route");
const { GET: readJobRoute } = await import("@/app/api/jobs/[ref]/route");
const session = await import("@/app/api/ops/session/route");
const { GET: listJobs } = await import("@/app/api/ops/jobs/route");
const opsJob = await import("@/app/api/ops/jobs/[ref]/route");

const dir = mkdtempSync(path.join(tmpdir(), "clearout-api-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const PASS = "test-ops-passcode";
const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
const customer = {
  company: "Acme Tech Pvt Ltd",
  contactName: "Asha Rao",
  email: "asha@acme.example",
  phone: "",
  address: "12 MG Road, Bengaluru 560001",
  preferredDate: future,
  notes: "",
};

const req = (url: string, init: RequestInit & { json?: unknown; cookie?: string } = {}) =>
  new Request(`http://localhost${url}`, {
    method: init.method ?? (init.json === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json", ...(init.cookie ? { cookie: init.cookie } : {}) },
    body: init.json === undefined ? undefined : JSON.stringify(init.json),
  });
const params = (ref: string) => ({ params: Promise.resolve({ ref }) });
const errorOf = async (res: Response) => ((await res.json()) as { error: { code: string; fields?: string[] } }).error;

async function signIn(): Promise<string> {
  const res = await session.POST(req("/api/ops/session", { json: { passcode: PASS } }));
  const cookie = res.headers.get("set-cookie") ?? "";
  expect(cookie).toContain("HttpOnly");
  return cookie.split(";")[0];
}

async function newJob() {
  const res = await createJobRoute(req("/api/jobs", { json: { customer, consent: true, source: "sample", items: SAMPLE_LISTING.items } }));
  expect(res.status).toBe(201);
  return (await res.json()) as { ref: string; token: string };
}

beforeEach(() => {
  resetRateLimits();
  resetJobStore();
  vi.stubEnv("CLEAROUT_DATA_DIR", dir);
  vi.stubEnv("OPS_PASSCODE", PASS);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("VERCEL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("customer requests", () => {
  it("creates a job and lets the customer read it only with the token", async () => {
    const { ref, token } = await newJob();
    const ok = await readJobRoute(req(`/api/jobs/${ref}?t=${token}`), params(ref));
    expect(ok.status).toBe(200);
    const { job } = await ok.json();
    expect(job.status).toBe("requested");
    expect(job).not.toHaveProperty("token");
    expect(job.estimate.quote.netHigh).toBe(44448);

    for (const bad of ["", "?t=wrong", `?t=${token.slice(0, -1)}0`]) {
      const res = await readJobRoute(req(`/api/jobs/${ref}${bad}`), params(ref));
      expect(res.status).toBe(404);
    }
  });

  it("reports which fields are invalid", async () => {
    const res = await createJobRoute(
      req("/api/jobs", { json: { customer: { ...customer, email: "not-an-email", company: "" }, consent: true, source: "ai", items: SAMPLE_LISTING.items } }),
    );
    expect(res.status).toBe(400);
    const err = await errorOf(res);
    expect(err.code).toBe("INVALID_DETAILS");
    expect(err.fields).toEqual(expect.arrayContaining(["customer.email", "customer.company"]));
  });

  it("requires consent and at least one item", async () => {
    expect((await createJobRoute(req("/api/jobs", { json: { customer, consent: false, source: "ai", items: SAMPLE_LISTING.items } }))).status).toBe(400);
    expect((await createJobRoute(req("/api/jobs", { json: { customer, consent: true, source: "ai", items: [] } }))).status).toBe(400);
  });

  it("ignores any quote sent by the browser", async () => {
    const res = await createJobRoute(
      req("/api/jobs", { json: { customer, consent: true, source: "ai", items: SAMPLE_LISTING.items, quote: { netHigh: 99999999 } } }),
    );
    const { ref, token } = await res.json();
    const { job } = await (await readJobRoute(req(`/api/jobs/${ref}?t=${token}`), params(ref))).json();
    expect(job.estimate.quote.netHigh).toBe(44448);
  });

  it("refuses to save on Vercel without a Blob store", async () => {
    vi.stubEnv("VERCEL", "1");
    resetJobStore();
    const res = await createJobRoute(req("/api/jobs", { json: { customer, consent: true, source: "sample", items: SAMPLE_LISTING.items } }));
    expect(res.status).toBe(503);
    expect((await errorOf(res)).code).toBe("STORAGE_NOT_CONFIGURED");
  });
});

describe("team console", () => {
  it("is closed without a session, and disabled without a passcode", async () => {
    expect((await listJobs(req("/api/ops/jobs"))).status).toBe(401);
    expect((await listJobs(req("/api/ops/jobs", { cookie: "clearout_ops=forged" }))).status).toBe(401);
    expect((await session.POST(req("/api/ops/session", { json: { passcode: "wrong-passcode" } }))).status).toBe(401);
    vi.stubEnv("OPS_PASSCODE", "");
    expect((await errorOf(await listJobs(req("/api/ops/jobs")))).code).toBe("OPS_DISABLED");
  });

  it("runs a job from request to closure, enforcing the wipe gate and revisions", async () => {
    const cookie = await signIn();
    const { ref, token } = await newJob();
    const act = async (body: object) => opsJob.POST(req(`/api/ops/jobs/${ref}`, { json: body, cookie }), params(ref));
    const current = async () => (await (await opsJob.GET(req(`/api/ops/jobs/${ref}`, { cookie }), params(ref))).json()).job;

    expect((await (await listJobs(req("/api/ops/jobs", { cookie }))).json()).jobs.map((j: { ref: string }) => j.ref)).toContain(ref);

    let job = await current();
    let res = await act({ action: "schedule", revision: job.revision, input: { date: future, slot: "morning", technician: "Ravi K" } });
    expect(res.status).toBe(200);

    // A stale revision is refused.
    res = await act({ action: "schedule", revision: job.revision, input: { date: future, slot: "afternoon", technician: "Ravi K" } });
    expect(res.status).toBe(409);
    expect((await errorOf(res)).code).toBe("CONFLICT");

    job = await current();
    res = await act({ action: "inspect", revision: job.revision, input: { items: SAMPLE_LISTING.items, notes: "All present" } });
    job = (await res.json()).job;
    expect(job.devices).toHaveLength(13);

    // Payment before the wipe gate is refused.
    res = await act({ action: "payout", revision: job.revision, input: { amount: 30000, method: "upi", reference: "UPI-1" } });
    expect((await errorOf(res)).code).toBe("INVALID_STEP");

    for (const d of job.devices) {
      res = await act({
        action: "device",
        revision: job.revision,
        input: { deviceId: d.id, serial: `SN-${d.id}`, outcome: "wiped", method: "NIST 800-88 Purge", evidence: `Report ${d.id}`, technician: "Ravi K" },
      });
      job = (await res.json()).job;
    }
    job = (await (await act({ action: "completeWipe", revision: job.revision })).json()).job;
    job = (await (await act({ action: "payout", revision: job.revision, input: { amount: 30000, method: "upi", reference: "UPI-1" } })).json()).job;
    job = (await (await act({ action: "close", revision: job.revision })).json()).job;
    expect(job.status).toBe("closed");

    // The customer sees the closed job through their link.
    const { job: publicJob } = await (await readJobRoute(req(`/api/jobs/${ref}?t=${token}`), params(ref))).json();
    expect(publicJob.status).toBe("closed");
    expect(publicJob.devices.every((d: { outcome: string }) => d.outcome === "wiped")).toBe(true);
    expect(publicJob.payout.simulated).toBe(true);
  });

  it("rejects malformed actions", async () => {
    const cookie = await signIn();
    const { ref } = await newJob();
    const res = await opsJob.POST(req(`/api/ops/jobs/${ref}`, { json: { action: "teleport", revision: 1 }, cookie }), params(ref));
    expect(res.status).toBe(400);
    const missing = await opsJob.GET(req("/api/ops/jobs/CO-ZZZZZZ", { cookie }), params("CO-ZZZZZZ"));
    expect(missing.status).toBe(404);
  });
});
