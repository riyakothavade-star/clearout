"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertIcon, RefreshIcon } from "@/components/icons";
import { StatusBadge } from "@/components/jobs/StatusTimeline";
import { api } from "@/lib/client/api";
import { rupeeRange } from "@/lib/format";
import type { JobStatus } from "@/lib/jobs/status";

type Summary = {
  ref: string;
  status: JobStatus;
  demo: boolean;
  company: string;
  contactName: string;
  preferredDate: string;
  createdAt: string;
  netLow: number;
  netHigh: number;
};

export function OpsSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await api("/api/ops/session", { method: "POST", json: { passcode } });
    setBusy(false);
    if (res.ok) onSignedIn();
    else setError(res.code === "UNAUTHORIZED" ? "That passcode isn't right." : res.message);
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-16 max-w-sm rounded-[20px] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h1 className="text-xl font-semibold text-ink">ClearOut team console</h1>
      <p className="mt-1 text-sm text-muted">For ClearOut staff handling visits, data wiping and payouts.</p>
      <label htmlFor="ops-passcode" className="mt-5 block text-sm font-medium text-ink">
        Team passcode
      </label>
      <input
        id="ops-passcode"
        type="password"
        autoComplete="current-password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        className="mt-1 block w-full rounded-[var(--radius-control)] border border-line-strong px-3 py-2.5 text-sm focus:border-forest-700 focus:outline-none"
      />
      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-danger-700">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <button type="submit" disabled={busy || !passcode} className="mt-4 w-full rounded-[var(--radius-control)] bg-forest-900 px-4 py-2.5 font-semibold text-white hover:bg-forest-800 disabled:opacity-50">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

// Signs in if needed, then lists every clear-out, newest first.
export function OpsHome() {
  const [state, setState] = useState<"checking" | "signedOut" | "signedIn">("checking");
  const [jobs, setJobs] = useState<Summary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = useCallback(async () => {
    const res = await api<{ jobs: Summary[] }>("/api/ops/jobs");
    if (res.ok) {
      setJobs(res.data.jobs);
      setError(null);
      setState("signedIn");
    } else if (res.code === "UNAUTHORIZED") setState("signedOut");
    else {
      setError(res.message);
      setState(res.code === "OPS_DISABLED" ? "signedOut" : "signedIn");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const signOut = async () => {
    await api("/api/ops/session", { method: "DELETE" });
    setJobs(null);
    setState("signedOut");
  };

  if (state === "checking") return <p className="mx-auto max-w-5xl px-4 py-16 text-muted">Loading…</p>;
  if (state === "signedOut") {
    return (
      <div className="px-4">
        {error && <p role="alert" className="mx-auto mt-10 max-w-sm rounded-[var(--radius-control)] border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
        {!error && <OpsSignIn onSignedIn={load} />}
      </div>
    );
  }

  const shown = (jobs ?? []).filter((j) => filter === "all" || (j.status !== "closed" && j.status !== "cancelled"));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-forest-700">Team console</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Clear-outs</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-sm font-semibold hover:bg-sunken">
            <RefreshIcon className="h-4 w-4" /> Refresh
          </button>
          <button type="button" onClick={signOut} className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-sm font-semibold hover:bg-sunken">
            Sign out
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Filter" className="mt-6 inline-flex rounded-[var(--radius-control)] border border-line bg-surface p-1 text-sm">
        {(["open", "all"] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 font-medium ${filter === f ? "bg-forest-900 text-white" : "text-muted hover:text-ink"}`}
          >
            {f === "open" ? "Open" : "All"}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 rounded-[var(--radius-control)] border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

      {jobs && shown.length === 0 && (
        <p className="mt-6 rounded-[20px] border border-line bg-surface p-6 text-muted">
          No {filter === "open" ? "open " : ""}clear-outs yet. Requests appear here when a customer clicks &ldquo;Request visit&rdquo; after an estimate.
        </p>
      )}

      {shown.length > 0 && (
        <ul className="mt-6 space-y-3">
          {shown.map((j) => (
            <li key={j.ref}>
              <Link
                href={`/ops/jobs/${j.ref}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-colors hover:border-forest-700"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {j.company} <span className="font-mono text-sm font-normal text-muted">{j.ref}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {j.contactName} · preferred {j.preferredDate}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {j.demo && <span className="rounded-full bg-lime-300 px-2 py-0.5 text-xs font-semibold text-forest-950">Demo</span>}
                  <StatusBadge status={j.status} />
                  <span className="text-sm tabular-nums text-muted">{rupeeRange(j.netLow, j.netHigh)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
