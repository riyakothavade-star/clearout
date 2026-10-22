"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertIcon, CheckIcon, ClipboardIcon, CloseIcon, ShieldIcon } from "@/components/icons";
import { QuoteCard } from "@/components/inventory/QuoteCard";
import { StatusBadge, StatusTimeline } from "@/components/jobs/StatusTimeline";
import { api } from "@/lib/client/api";
import { rupeeRange, rupees } from "@/lib/format";
import type { Device, Job } from "@/lib/jobs/model";
import { OUTCOME_LABELS, PAYOUT_METHOD_LABELS } from "@/lib/jobs/status";
import { PRICES } from "@/lib/prices";
import { computeQuote } from "@/lib/quote";
import type { Item } from "@/lib/schema";
import { OpsSignIn } from "./OpsHome";

const input =
  "mt-1 block w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-forest-700 focus:outline-none";
const primary = "inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50";
const secondary = "inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-sunken disabled:opacity-50";

const todayInIndia = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function Step({ number, title, done, children }: { number: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="flex items-center gap-2 font-semibold text-ink">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${done ? "bg-forest-700 text-white" : "bg-sunken text-ink"}`}>
          {done ? <CheckIcon className="h-3.5 w-3.5" /> : number}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ---- Step 2: confirm items on site -------------------------------------------------------

const newItem = (): Item => ({
  type: "",
  quantity: 1,
  condition: "fair",
  priceCategoryId: "none",
  storesData: "no",
  hasBattery: false,
  photos: [],
  confidence: "high",
  note: "",
});

function ItemsEditor({ initial, busy, onSave }: { initial: Item[]; busy: boolean; onSave: (items: Item[], notes: string) => void }) {
  const [rows, setRows] = useState<Item[]>(() => initial.map((i) => ({ ...i, confidence: "high" as const })));
  const [notes, setNotes] = useState("");
  const update = (i: number, patch: Partial<Item>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const valid = rows.length > 0 && rows.every((r) => r.type.trim().length > 0 && Number.isInteger(r.quantity) && r.quantity >= 1 && r.quantity <= 500);
  const preview = useMemo(() => (valid ? computeQuote(rows, PRICES) : null), [rows, valid]);
  const dataUnits = rows.filter((r) => r.storesData !== "no").reduce((s, r) => s + (r.quantity || 0), 0);

  return (
    <div>
      <p className="text-sm text-muted">Correct anything the photos got wrong. Saving recalculates the payout and creates one wipe record per data-bearing unit.</p>
      <div className="mt-3 space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-[var(--radius-control)] border border-line p-3 sm:grid-cols-12 sm:items-end">
            <label className="col-span-2 text-xs font-medium text-muted sm:col-span-12">
              Item
              <input className={input} value={row.type} onChange={(e) => update(i, { type: e.target.value })} aria-label={`Item ${i + 1} description`} />
            </label>
            <label className="text-xs font-medium text-muted sm:col-span-2">
              Qty
              <input
                className={input}
                type="number"
                min={1}
                max={500}
                value={Number.isFinite(row.quantity) ? row.quantity : ""}
                onChange={(e) => update(i, { quantity: Math.floor(Number(e.target.value)) })}
                aria-label={`Item ${i + 1} quantity`}
              />
            </label>
            <label className="text-xs font-medium text-muted sm:col-span-2">
              Condition
              <select className={input} value={row.condition} onChange={(e) => update(i, { condition: e.target.value as Item["condition"] })} aria-label={`Item ${i + 1} condition`}>
                {["good", "fair", "poor", "scrap"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="col-span-2 text-xs font-medium text-muted sm:col-span-4">
              Price category
              <select className={input} value={row.priceCategoryId} onChange={(e) => update(i, { priceCategoryId: e.target.value })} aria-label={`Item ${i + 1} price category`}>
                <option value="none">No matching category (priced on site)</option>
                {PRICES.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted sm:col-span-2">
              Stores data?
              <select className={input} value={row.storesData} onChange={(e) => update(i, { storesData: e.target.value as Item["storesData"] })} aria-label={`Item ${i + 1} stores data`}>
                <option value="yes">Yes</option>
                <option value="maybe">Maybe</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 pb-2 text-xs font-medium text-muted sm:col-span-1">
              <input type="checkbox" checked={row.hasBattery} onChange={(e) => update(i, { hasBattery: e.target.checked })} /> Battery
            </label>
            <button type="button" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} className={`${secondary} justify-center sm:col-span-1`} aria-label={`Remove item ${i + 1}`}>
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows((r) => [...r, newItem()])} className={`${secondary} mt-3`}>
        Add item
      </button>
      <label className="mt-4 block text-sm font-medium text-ink">
        Inspection notes (optional)
        <textarea className={input} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button type="button" disabled={!valid || busy} onClick={() => onSave(rows, notes)} className={primary}>
          Confirm items on site
        </button>
        <p className="text-sm text-muted">
          {preview ? `Payout after fee: ${rupeeRange(preview.netLow, preview.netHigh)} · ${dataUnits} data-bearing unit${dataUnits === 1 ? "" : "s"}` : "Every item needs a description and a quantity of 1–500."}
        </p>
      </div>
    </div>
  );
}

// ---- Step 3: wipe log ---------------------------------------------------------------------

function DeviceRow({ device, technician, busy, onSave }: { device: Device; technician: string; busy: boolean; onSave: (d: { deviceId: string; serial: string; outcome: "wiped" | "destroyed" | "no-storage"; method: string; evidence: string; technician: string }) => void }) {
  const [serial, setSerial] = useState(device.serial);
  const [outcome, setOutcome] = useState<"wiped" | "destroyed" | "no-storage">(device.outcome ?? "wiped");
  const [method, setMethod] = useState(device.method || "NIST 800-88 Purge (software overwrite)");
  const [evidence, setEvidence] = useState(device.evidence);
  const [by, setBy] = useState(device.technician || technician);
  const done = device.outcome !== null;
  const [editing, setEditing] = useState(!done);
  const valid = serial.trim().length >= 1 && method.trim().length >= 2 && evidence.trim().length >= 2 && by.trim().length >= 2;

  return (
    <li className={`rounded-[var(--radius-control)] border p-3 ${done ? "border-forest-100 bg-success-50/60" : "border-line"}`}>
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        {done ? <CheckIcon className="h-4 w-4 text-success-700" /> : <ShieldIcon className="h-4 w-4 text-danger-700" />}
        {device.label}
        {done && <span className="text-xs font-normal text-success-700">{OUTCOME_LABELS[device.outcome!]}</span>}
      </p>
      {done && !editing ? (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            Serial <span className="font-mono text-ink">{device.serial}</span> · {device.method} · {device.evidence} · {device.technician}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="font-semibold text-forest-700 underline underline-offset-2">
            Edit
          </button>
        </div>
      ) : (
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6 sm:items-end">
        <label className="text-xs font-medium text-muted sm:col-span-2">
          Serial number
          <input className={input} value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="or 'Not visible'" />
        </label>
        <label className="text-xs font-medium text-muted sm:col-span-2">
          Outcome
          <select
            className={input}
            value={outcome}
            onChange={(e) => {
              const o = e.target.value as typeof outcome;
              setOutcome(o);
              if (o === "destroyed") setMethod("Drive physically shredded");
              if (o === "no-storage") setMethod("Inspected: no storage media present");
              if (o === "wiped") setMethod("NIST 800-88 Purge (software overwrite)");
            }}
          >
            <option value="wiped">Wiped</option>
            <option value="destroyed">Destroyed</option>
            <option value="no-storage">No storage found</option>
          </select>
        </label>
        <label className="col-span-2 text-xs font-medium text-muted sm:col-span-3">
          Method
          <input className={input} value={method} onChange={(e) => setMethod(e.target.value)} />
        </label>
        <label className="col-span-2 text-xs font-medium text-muted sm:col-span-3">
          Evidence
          <input className={input} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Wipe report ID or photo ref" />
        </label>
        <label className="text-xs font-medium text-muted sm:col-span-2">
          Technician
          <input className={input} value={by} onChange={(e) => setBy(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => onSave({ deviceId: device.id, serial, outcome, method, evidence, technician: by })}
          className={`${done ? secondary : primary} col-span-2 justify-center sm:col-span-6 sm:justify-self-start`}
        >
          {done ? "Update record" : "Save record"}
        </button>
      </div>
      )}
    </li>
  );
}

// ---- The console --------------------------------------------------------------------------

export function OpsJobConsole() {
  const { ref } = useParams<{ ref: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [state, setState] = useState<"loading" | "signedOut" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Step form values.
  const [visitDate, setVisitDate] = useState("");
  const [slot, setSlot] = useState<"morning" | "afternoon">("morning");
  const [technician, setTechnician] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bank-transfer" | "upi" | "cheque">("bank-transfer");
  const [reference, setReference] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    const res = await api<{ job: Job }>(`/api/ops/jobs/${encodeURIComponent(ref)}`);
    if (res.ok) {
      setJob(res.data.job);
      setState("ready");
      setVisitDate((d) => d || res.data.job.visit?.date || res.data.job.customer.preferredDate);
      setTechnician((t) => t || res.data.job.visit?.technician || "");
    } else if (res.code === "UNAUTHORIZED") setState("signedOut");
    else {
      setMessage({ tone: "error", text: res.message });
      setState("error");
    }
  }, [ref]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const act = async (action: string, input?: unknown, success?: string) => {
    if (!job || busy) return;
    setBusy(true);
    setMessage(null);
    const res = await api<{ job: Job }>(`/api/ops/jobs/${encodeURIComponent(ref)}`, { method: "POST", json: { action, revision: job.revision, input } });
    setBusy(false);
    if (res.ok) {
      setJob(res.data.job);
      if (success) setMessage({ tone: "ok", text: success });
    } else {
      setMessage({ tone: "error", text: res.fields.length ? `${res.message} (${res.fields.join(", ")})` : res.message });
      if (res.code === "CONFLICT") load();
      if (res.code === "UNAUTHORIZED") setState("signedOut");
    }
  };

  if (state === "loading") return <p className="mx-auto max-w-5xl px-4 py-16 text-muted">Loading…</p>;
  if (state === "signedOut") return <div className="px-4"><OpsSignIn onSignedIn={load} /></div>;
  if (!job) return <p role="alert" className="mx-auto max-w-5xl px-4 py-16 text-danger-700">{message?.text}</p>;

  const s = job.status;
  const after = (...statuses: Job["status"][]) => statuses.includes(s);
  const finalQuote = job.inspection?.quote ?? job.estimate.quote;
  const pending = job.devices.filter((d) => d.outcome === null).length;
  const customerLink = typeof window !== "undefined" ? `${window.location.origin}/jobs/${job.ref}?t=${job.token}` : "";
  const amountNumber = Number(amount);
  const amountValid = amount !== "" && Number.isInteger(amountNumber) && amountNumber >= 0 && amountNumber <= 10_000_000;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      <Link href="/ops" className="text-sm font-semibold text-forest-700 underline underline-offset-4">← All clear-outs</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted">{job.ref}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{job.customer.company}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge status={s} />
            {job.demo && <span className="rounded-full bg-lime-300 px-2.5 py-0.5 text-xs font-semibold text-forest-950">Demo request · sample inventory</span>}
          </div>
        </div>
        <button
          type="button"
          className={secondary}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(customerLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            } catch {
              setCopied(false);
            }
          }}
        >
          <ClipboardIcon className="h-4 w-4" /> {copied ? "Copied" : "Copy customer link"}
        </button>
      </div>

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mt-4 flex items-start gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm ${message.tone === "error" ? "border-danger-200 bg-danger-50 text-danger-700" : "border-forest-100 bg-success-50 text-success-700"}`}
        >
          {message.tone === "error" ? <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />} {message.text}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Step number={1} title="Schedule the visit" done={!after("requested")}>
            {after("requested", "scheduled") ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.3fr_auto] sm:items-end">
                <label className="text-xs font-medium text-muted">
                  Date
                  <input type="date" className={input} min={todayInIndia()} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                </label>
                <label className="text-xs font-medium text-muted">
                  Time
                  <select className={input} value={slot} onChange={(e) => setSlot(e.target.value as typeof slot)}>
                    <option value="morning">Morning (9am–1pm)</option>
                    <option value="afternoon">Afternoon (2pm–6pm)</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-muted">
                  Technician
                  <input className={input} value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="Name" />
                </label>
                <button
                  type="button"
                  className={primary}
                  disabled={busy || !visitDate || technician.trim().length < 2}
                  onClick={() => act("schedule", { date: visitDate, slot, technician }, "Visit scheduled.")}
                >
                  {s === "scheduled" ? "Reschedule" : "Schedule"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-ink">{job.visit ? `${job.visit.date}, ${job.visit.slot}, ${job.visit.technician}` : "—"}</p>
            )}
          </Step>

          <Step number={2} title="Confirm items on site" done={after("inspected", "wiped", "paid", "closed") || (s === "cancelled" && !!job.inspection)}>
            {after("scheduled", "inspected") ? (
              <ItemsEditor
                key={job.inspection?.at ?? "estimate"}
                initial={job.inspection?.items ?? job.estimate.items}
                busy={busy}
                onSave={(items, notes) => {
                  if (s === "inspected" && job.devices.some((d) => d.outcome) && !window.confirm("Re-confirming items clears the wipe records entered so far. Continue?")) return;
                  act("inspect", { items, notes }, "Items confirmed. Wipe records created.");
                }}
              />
            ) : s === "requested" ? (
              <p className="text-sm text-muted">Schedule the visit first.</p>
            ) : (
              <p className="text-sm text-ink">
                {job.inspection?.items.length ?? 0} item groups confirmed · payout {rupeeRange(finalQuote.netLow, finalQuote.netHigh)}
              </p>
            )}
          </Step>

          <Step number={3} title="Wipe or destroy every data-bearing device" done={after("wiped", "paid", "closed")}>
            {s === "inspected" ? (
              <div>
                <p className="text-sm text-muted">
                  {job.devices.length === 0
                    ? "No data-bearing units were confirmed on site."
                    : `${job.devices.length - pending} of ${job.devices.length} units have evidence. Payment stays locked until every unit is recorded.`}
                </p>
                <ul className="mt-3 space-y-2">
                  {job.devices.map((d) => (
                    <DeviceRow key={`${d.id}-${d.recordedAt}`} device={d} technician={job.visit?.technician ?? ""} busy={busy} onSave={(input) => act("device", input)} />
                  ))}
                </ul>
                <button type="button" className={`${primary} mt-4`} disabled={busy || pending > 0} onClick={() => act("completeWipe", undefined, "Wipe step complete.")}>
                  <ShieldIcon className="h-4 w-4" /> Complete wipe step
                </button>
                {pending > 0 && <p className="mt-2 text-xs text-muted">{pending} unit{pending === 1 ? "" : "s"} still need evidence.</p>}
              </div>
            ) : after("wiped", "paid", "closed") ? (
              <p className="text-sm text-ink">All {job.devices.length} data-bearing units recorded.</p>
            ) : (
              <p className="text-sm text-muted">Available after the items are confirmed on site.</p>
            )}
          </Step>

          <Step number={4} title="Record the payment" done={after("paid", "closed")}>
            {s === "wiped" ? (
              <div>
                <p className="text-sm text-muted">
                  Estimated payout after the fee: <span className="font-semibold text-ink">{rupeeRange(Math.max(0, finalQuote.netLow), Math.max(0, finalQuote.netHigh))}</span>. Enter the amount agreed with the customer.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1.3fr] sm:items-end">
                  <label className="text-xs font-medium text-muted">
                    Amount (₹)
                    <input className={input} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} />
                  </label>
                  <label className="text-xs font-medium text-muted">
                    Method
                    <select className={input} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                      {Object.entries(PAYOUT_METHOD_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-muted">
                    Reference
                    <input className={input} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / UPI ref / cheque no." />
                  </label>
                </div>
                <label className="mt-3 flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5" />
                  I understand this prototype only records the payment. No money is moved.
                </label>
                <button
                  type="button"
                  className={`${primary} mt-3`}
                  disabled={busy || !amountValid || reference.trim().length < 2 || !understood}
                  onClick={() => act("payout", { amount: amountNumber, method, reference }, "Payment recorded (simulated).")}
                >
                  Record payment {amountValid ? rupees(amountNumber) : ""}
                </button>
              </div>
            ) : job.payout ? (
              <p className="text-sm text-ink">
                {rupees(job.payout.amount)} by {PAYOUT_METHOD_LABELS[job.payout.method]}, ref {job.payout.reference} <span className="text-attention-800">(simulated)</span>
              </p>
            ) : (
              <p className="text-sm text-muted">Locked until every data-bearing unit has evidence.</p>
            )}
          </Step>

          <Step number={5} title="Close and issue the closure pack" done={s === "closed"}>
            {s === "paid" ? (
              <button type="button" className={primary} disabled={busy} onClick={() => act("close", undefined, "Clear-out closed. The customer can now open the closure pack.")}>
                Close clear-out
              </button>
            ) : s === "closed" ? (
              <a href={`/jobs/${job.ref}/closure?t=${job.token}`} className={secondary}>
                <ClipboardIcon className="h-4 w-4" /> Open closure pack
              </a>
            ) : (
              <p className="text-sm text-muted">Available after the payment is recorded.</p>
            )}
          </Step>

          {after("requested", "scheduled", "inspected", "wiped") && (
            <details className="rounded-[20px] border border-line bg-surface p-5">
              <summary className="cursor-pointer text-sm font-semibold text-danger-700">Cancel this clear-out</summary>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input className={input} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (shown to the customer)" />
                <button type="button" className={secondary} disabled={busy || cancelReason.trim().length < 2} onClick={() => act("cancel", { reason: cancelReason }, "Clear-out cancelled.")}>
                  Cancel clear-out
                </button>
              </div>
            </details>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-[20px] border border-line bg-surface p-5 text-sm shadow-[var(--shadow-card)]">
            <h2 className="font-semibold text-ink">Customer</h2>
            <dl className="mt-2 space-y-1">
              <div><dt className="inline text-muted">Contact: </dt><dd className="inline">{job.customer.contactName}</dd></div>
              <div><dt className="inline text-muted">Email: </dt><dd className="inline">{job.customer.email}</dd></div>
              {job.customer.phone && <div><dt className="inline text-muted">Phone: </dt><dd className="inline">{job.customer.phone}</dd></div>}
              <div><dt className="inline text-muted">Address: </dt><dd className="inline">{job.customer.address}</dd></div>
              <div><dt className="inline text-muted">Preferred date: </dt><dd className="inline">{job.customer.preferredDate}</dd></div>
              {job.customer.notes && <div><dt className="inline text-muted">Notes: </dt><dd className="inline">{job.customer.notes}</dd></div>}
            </dl>
          </section>
          <QuoteCard quote={finalQuote} sample={job.demo} />
          <section className="rounded-[20px] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-semibold text-ink">History</h2>
            <div className="mt-4">
              <StatusTimeline job={job} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
