"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertIcon, CheckIcon, ClipboardIcon, RefreshIcon, ShieldIcon } from "@/components/icons";
import { InventoryView } from "@/components/inventory/InventoryView";
import { QuoteCard } from "@/components/inventory/QuoteCard";
import { api } from "@/lib/client/api";
import { rupees } from "@/lib/format";
import type { PublicJob } from "@/lib/jobs/model";
import { PAYOUT_METHOD_LABELS } from "@/lib/jobs/status";
import { sortForReview } from "@/lib/inventory";
import { StatusBadge, StatusTimeline } from "./StatusTimeline";

const REFRESH_MS = 30_000;

export function JobTracker() {
  const { ref } = useParams<{ ref: string }>();
  const search = useSearchParams();
  const token = search.get("t") ?? "";
  const isNew = search.get("new") === "1";
  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await api<{ job: PublicJob }>(`/api/jobs/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}`);
    setLoading(false);
    if (res.ok) {
      setJob(res.data.job);
      setError(null);
    } else setError(res.message);
  }, [ref, token]);

  useEffect(() => {
    // Load now, then refresh while the page is open so the customer sees progress.
    const first = setTimeout(load, 0);
    const t = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const privateLink = typeof window !== "undefined" ? `${window.location.origin}/jobs/${ref}?t=${token}` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(privateLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  if (loading && !job) return <p className="mx-auto max-w-4xl px-4 py-16 text-muted sm:px-6">Loading your clear-out…</p>;
  if (error && !job) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-card)] border border-danger-200 bg-danger-50 p-5 text-danger-700">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" /> {error}
        </p>
        <Link href="/estimate" className="mt-4 inline-block font-semibold text-forest-700 underline underline-offset-4">
          Start a new estimate
        </Link>
      </div>
    );
  }
  if (!job) return null;

  const items = sortForReview(job.inspection?.items ?? job.estimate.items);
  const recorded = job.devices.filter((d) => d.outcome !== null).length;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
      {isNew && (
        <div className="mb-6 rounded-[20px] border border-forest-700 bg-forest-50 p-5">
          <p className="flex items-center gap-2 font-semibold text-forest-900">
            <CheckIcon className="h-5 w-5" /> Request sent. Your reference is {job.ref}.
          </p>
          <p className="mt-1 text-sm text-forest-800">
            Save this private link: it&rsquo;s the only way to see this clear-out. Anyone with it can view the details.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-forest-700">Clear-out {job.ref}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">{job.customer.company}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge status={job.status} />
            {job.demo && <span className="rounded-full bg-lime-300 px-2.5 py-0.5 text-xs font-semibold text-forest-950">Demo request · sample inventory</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-sunken"
          >
            <ClipboardIcon className="h-4 w-4" /> {copied ? "Link copied" : "Copy private link"}
          </button>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-sunken"
          >
            <RefreshIcon className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <section className="rounded-[20px] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-semibold text-ink">Progress</h2>
            <div className="mt-4">
              <StatusTimeline job={job} />
            </div>
          </section>

          <section className="rounded-[20px] border border-line bg-surface p-5 text-sm shadow-[var(--shadow-card)]">
            <h2 className="font-semibold text-ink">Visit</h2>
            {job.visit ? (
              <p className="mt-2 text-ink">
                {job.visit.date}, {job.visit.slot === "morning" ? "9am–1pm" : "2pm–6pm"}, with {job.visit.technician}
              </p>
            ) : (
              <p className="mt-2 text-muted">Requested for {job.customer.preferredDate}. The ClearOut team will confirm a time.</p>
            )}
            <p className="mt-2 text-muted">{job.customer.address}</p>
          </section>

          {job.devices.length > 0 && (
            <section className="rounded-[20px] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <h2 className="flex items-center gap-2 font-semibold text-ink">
                <ShieldIcon className="h-5 w-5 text-forest-700" /> Data-bearing devices
              </h2>
              <p className="mt-1 text-sm text-muted">
                {recorded} of {job.devices.length} units have wipe or destruction evidence recorded.
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                <div className="h-full rounded-full bg-forest-700" style={{ width: `${(recorded / job.devices.length) * 100}%` }} />
              </div>
            </section>
          )}

          {job.payout && (
            <section className="rounded-[20px] border border-line bg-surface p-5 text-sm shadow-[var(--shadow-card)]">
              <h2 className="font-semibold text-ink">Payment</h2>
              <p className="mt-2 text-2xl font-semibold text-ink">{rupees(job.payout.amount)}</p>
              <p className="text-muted">
                {PAYOUT_METHOD_LABELS[job.payout.method]} · reference {job.payout.reference}
              </p>
              <p className="mt-2 text-xs text-attention-800">Simulated in this prototype: no money was transferred.</p>
            </section>
          )}

          {job.status === "closed" && (
            <Link
              href={`/jobs/${job.ref}/closure?t=${token}`}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-forest-900 px-5 py-3 font-semibold text-white hover:bg-forest-800"
            >
              <ClipboardIcon className="h-5 w-5" /> View closure pack
            </Link>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <div>
            <h2 className="mb-3 font-semibold text-ink">{job.inspection ? "Confirmed on site" : "Your estimate"}</h2>
            <QuoteCard quote={job.inspection?.quote ?? job.estimate.quote} sample={job.demo} />
            {job.inspection && (
              <p className="mt-2 text-xs text-muted">
                Original online estimate: {rupees(job.estimate.quote.netLow)} to {rupees(job.estimate.quote.netHigh)} after the fee.
              </p>
            )}
          </div>
          <div>
            <h2 className="mb-3 font-semibold text-ink">Items</h2>
            <InventoryView items={items} />
          </div>
        </div>
      </div>
    </div>
  );
}
