"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { api } from "@/lib/client/api";
import { rupees } from "@/lib/format";
import { categoryName } from "@/lib/prices";
import type { PublicJob } from "@/lib/jobs/model";
import { OUTCOME_LABELS, PAYOUT_METHOD_LABELS, STATUS_LABELS } from "@/lib/jobs/status";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "—";

// A printable record of a closed clear-out. "Print or save as PDF" uses the browser's own print dialog.
export function ClosurePack() {
  const { ref } = useParams<{ ref: string }>();
  const token = useSearchParams().get("t") ?? "";
  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ job: PublicJob }>(`/api/jobs/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}`).then((res) => {
      if (cancelled) return;
      if (res.ok) setJob(res.data.job);
      else setError(res.message);
    });
    return () => {
      cancelled = true;
    };
  }, [ref, token]);

  if (error) return <p role="alert" className="mx-auto max-w-3xl px-4 py-16 text-danger-700">{error}</p>;
  if (!job) return <p className="mx-auto max-w-3xl px-4 py-16 text-muted">Loading closure pack…</p>;
  if (job.status !== "closed") {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-muted">The closure pack is issued when the clear-out is closed. Current status: {STATUS_LABELS[job.status]}.</p>;
  }

  const items = job.inspection?.items ?? job.estimate.items;

  return (
    <article className="mx-auto max-w-4xl bg-surface px-6 py-10 text-sm text-ink print:max-w-none print:px-0 print:py-0">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <a href={`/jobs/${job.ref}?t=${token}`} className="font-semibold text-forest-700 underline underline-offset-4">
          ← Back to tracking
        </a>
        <button type="button" onClick={() => window.print()} className="rounded-[var(--radius-control)] bg-forest-900 px-4 py-2.5 font-semibold text-white hover:bg-forest-800">
          Print or save as PDF
        </button>
      </div>

      <header className="mt-6 flex items-start justify-between gap-6 border-b-2 border-forest-900 pb-4 print:mt-0">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <span className="text-xl font-semibold">ClearOut</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold">Clear-out closure pack</h1>
          <p className="text-muted">Reference {job.ref} · closed {when(job.closure?.at ?? null)}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{job.customer.company}</p>
          <p className="text-muted">{job.customer.contactName}</p>
          <p className="max-w-xs text-muted">{job.customer.address}</p>
        </div>
      </header>

      <p className="mt-4 rounded-[var(--radius-control)] border border-attention-200 bg-attention-50 px-3 py-2 text-xs text-attention-800">
        Prototype document generated from records entered in the ClearOut team console.
        {job.demo ? " This is a demo clear-out based on simulated sample data." : ""} It is not a legally certified
        certificate of destruction, and the payment shown was simulated.
      </p>

      <section className="mt-6">
        <h2 className="text-base font-semibold">Summary</h2>
        <p className="mt-1">{job.closure?.summary}</p>
        {job.visit && (
          <p className="mt-1 text-muted">
            Visit on {job.visit.date} ({job.visit.slot}) by {job.visit.technician}.
          </p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">Items collected</h2>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line-strong text-xs uppercase text-muted">
              <th className="py-1.5 pr-2">Item</th>
              <th className="py-1.5 pr-2 text-right">Qty</th>
              <th className="py-1.5 pr-2">Condition</th>
              <th className="py-1.5">Category</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-1.5 pr-2">{item.type}</td>
                <td className="py-1.5 pr-2 text-right">{item.quantity}</td>
                <td className="py-1.5 pr-2 capitalize">{item.condition}</td>
                <td className="py-1.5">{categoryName(item.priceCategoryId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 break-inside-avoid-page">
        <h2 className="text-base font-semibold">Data-bearing devices ({job.devices.length})</h2>
        {job.devices.length === 0 ? (
          <p className="mt-1 text-muted">No data-bearing devices were found on site.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line-strong uppercase text-muted">
                <th className="py-1.5 pr-2">Device</th>
                <th className="py-1.5 pr-2">Serial</th>
                <th className="py-1.5 pr-2">Outcome</th>
                <th className="py-1.5 pr-2">Method</th>
                <th className="py-1.5 pr-2">Evidence</th>
                <th className="py-1.5 pr-2">By</th>
                <th className="py-1.5">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {job.devices.map((d) => (
                <tr key={d.id} className="border-b border-line align-top">
                  <td className="py-1.5 pr-2">{d.label}</td>
                  <td className="py-1.5 pr-2 font-mono">{d.serial}</td>
                  <td className="py-1.5 pr-2">{d.outcome ? OUTCOME_LABELS[d.outcome] : "—"}</td>
                  <td className="py-1.5 pr-2">{d.method}</td>
                  <td className="py-1.5 pr-2">{d.evidence}</td>
                  <td className="py-1.5 pr-2">{d.technician}</td>
                  <td className="py-1.5">{when(d.recordedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {job.payout && (
        <section className="mt-6">
          <h2 className="text-base font-semibold">Payment (simulated)</h2>
          <p className="mt-1">
            {rupees(job.payout.amount)} by {PAYOUT_METHOD_LABELS[job.payout.method]}, reference {job.payout.reference}, recorded {when(job.payout.at)}.
          </p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-base font-semibold">History</h2>
        <ul className="mt-1 space-y-1">
          {job.events.map((e, i) => (
            <li key={i}>
              <span className="text-muted">{when(e.at)}</span> · {e.note}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
