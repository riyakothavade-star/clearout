import { promises as fs } from "node:fs";
import path from "node:path";
import { BlobNotFoundError, BlobPreconditionFailedError, get, list, put } from "@vercel/blob";
import { AppError } from "@/lib/errors";
import { JobSchema, REF_PATTERN, type Job } from "./model";

// Where jobs are kept. One JSON document per job.
// - On Vercel: a PRIVATE Vercel Blob store (needs BLOB_READ_WRITE_TOKEN, added when a Blob store is
//   connected to the project). Private blobs can't be read by URL; only this server can read them.
// - Locally and in tests: files in .data/jobs (ignored by git).
// Each save checks the job hasn't changed since it was read, so two people can't overwrite each other.

export interface JobStore {
  create(job: Job): Promise<void>;
  get(ref: string): Promise<Job | null>;
  update(job: Job): Promise<Job>; // job.revision must be the revision that was read
  list(): Promise<Job[]>;
}

const MAX_LIST = 200;

function parse(text: string): Job {
  return JobSchema.parse(JSON.parse(text));
}

export class FileJobStore implements JobStore {
  constructor(private readonly dir: string) {}

  private file(ref: string) {
    if (!REF_PATTERN.test(ref)) throw new AppError("JOB_NOT_FOUND", "bad ref");
    return path.join(this.dir, `${ref}.json`);
  }

  async create(job: Job) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.file(job.ref), JSON.stringify(job, null, 2), { flag: "wx" });
  }

  async get(ref: string) {
    if (!REF_PATTERN.test(ref)) return null;
    try {
      return parse(await fs.readFile(this.file(ref), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async update(job: Job) {
    const current = await this.get(job.ref);
    if (!current) throw new AppError("JOB_NOT_FOUND", job.ref);
    if (current.revision !== job.revision) throw new AppError("CONFLICT", `revision ${job.revision} vs ${current.revision}`);
    const next = { ...job, revision: job.revision + 1 };
    await fs.writeFile(this.file(job.ref), JSON.stringify(next, null, 2));
    return next;
  }

  async list() {
    try {
      const names = (await fs.readdir(this.dir)).filter((n) => n.endsWith(".json")).slice(0, MAX_LIST);
      const jobs = await Promise.all(names.map((n) => this.get(n.replace(/\.json$/, ""))));
      return jobs.filter((j): j is Job => j !== null);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}

export class BlobJobStore implements JobStore {
  private etags = new Map<string, string>();

  private pathname(ref: string) {
    if (!REF_PATTERN.test(ref)) throw new AppError("JOB_NOT_FOUND", "bad ref");
    return `jobs/${ref}.json`;
  }

  async create(job: Job) {
    const res = await put(this.pathname(job.ref), JSON.stringify(job), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    this.etags.set(job.ref, res.etag);
  }

  async get(ref: string) {
    if (!REF_PATTERN.test(ref)) return null;
    try {
      const res = await get(this.pathname(ref), { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return null;
      this.etags.set(ref, res.blob.etag);
      return parse(await new Response(res.stream).text());
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  }

  async update(job: Job) {
    const current = await this.get(job.ref);
    if (!current) throw new AppError("JOB_NOT_FOUND", job.ref);
    if (current.revision !== job.revision) throw new AppError("CONFLICT", `revision ${job.revision} vs ${current.revision}`);
    const next = { ...job, revision: job.revision + 1 };
    try {
      await put(this.pathname(job.ref), JSON.stringify(next), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        ifMatch: this.etags.get(job.ref),
      });
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) throw new AppError("CONFLICT", "blob etag changed");
      throw error;
    }
    return next;
  }

  async list() {
    const { blobs } = await list({ prefix: "jobs/", limit: MAX_LIST });
    const jobs = await Promise.all(blobs.map((b) => this.get(b.pathname.replace(/^jobs\//, "").replace(/\.json$/, ""))));
    return jobs.filter((j): j is Job => j !== null);
  }
}

let cached: JobStore | null = null;

// Picks the store for this environment. On Vercel without a Blob store, saving is refused with a clear
// message instead of silently writing to a disk that disappears.
export function jobStore(env: Record<string, string | undefined> = process.env): JobStore {
  if (cached) return cached;
  if (env.BLOB_READ_WRITE_TOKEN) cached = new BlobJobStore();
  else if (env.VERCEL) throw new AppError("STORAGE_NOT_CONFIGURED", "no BLOB_READ_WRITE_TOKEN on Vercel");
  else cached = new FileJobStore(env.CLEAROUT_DATA_DIR || path.join(process.cwd(), ".data", "jobs"));
  return cached;
}

export function resetJobStore() {
  cached = null;
}
