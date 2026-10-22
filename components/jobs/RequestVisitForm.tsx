"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertIcon, ArrowRightIcon } from "@/components/icons";
import { api } from "@/lib/client/api";
import type { Item } from "@/lib/schema";

type Fields = { company: string; contactName: string; email: string; phone: string; address: string; preferredDate: string; notes: string };

const EMPTY: Fields = { company: "", contactName: "", email: "", phone: "", address: "", preferredDate: "", notes: "" };

const todayInIndia = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

// Browser-side checks for quick feedback. The server repeats every check.
function check(f: Fields, consent: boolean): Partial<Record<keyof Fields | "consent", string>> {
  const e: Partial<Record<keyof Fields | "consent", string>> = {};
  if (f.company.trim().length < 2) e.company = "Enter your company name.";
  if (f.contactName.trim().length < 2) e.contactName = "Enter a contact name.";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid work email.";
  if (f.phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(f.phone.trim())) e.phone = "Use digits, spaces, + or -.";
  if (f.address.trim().length < 5) e.address = "Enter the office address in Bengaluru.";
  if (!f.preferredDate) e.preferredDate = "Choose a preferred date.";
  else if (f.preferredDate < todayInIndia()) e.preferredDate = "Choose today or a later date.";
  if (!consent) e.consent = "Please confirm so we can contact you about this request.";
  return e;
}

const inputClass = (error?: string) =>
  `mt-1 block w-full rounded-[var(--radius-control)] border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-forest-700 focus:outline-none ${
    error ? "border-danger-700" : "border-line-strong"
  }`;

export function RequestVisitForm({ items, source }: { items: Item[]; source: "ai" | "sample" }) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof check>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFields((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const found = check(fields, consent);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    const res = await api<{ ref: string; token: string }>("/api/jobs", { method: "POST", json: { customer: fields, consent, source, items } });
    if (res.ok) {
      router.push(`/jobs/${res.data.ref}?t=${res.data.token}&new=1`);
      return;
    }
    setSubmitting(false);
    setFailure(res.message);
    const serverErrors: ReturnType<typeof check> = {};
    for (const f of res.fields) {
      const key = f.replace(/^customer\./, "") as keyof Fields;
      if (key in EMPTY) serverErrors[key] = "Please check this field.";
    }
    setErrors(serverErrors);
  };

  const field = (key: keyof Fields, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`visit-${key}`} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={`visit-${key}`}
        value={fields[key]}
        onChange={set(key)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `visit-${key}-error` : undefined}
        className={inputClass(errors[key])}
        {...props}
      />
      {errors[key] && (
        <p id={`visit-${key}-error`} className="mt-1 text-xs text-danger-700">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <section aria-labelledby="request-visit-heading" className="rounded-[20px] border border-forest-800 bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 id="request-visit-heading" className="text-xl font-semibold tracking-tight text-ink">
        Request a ClearOut visit
      </h2>
      <p className="mt-1 text-sm text-muted">
        We&rsquo;ll confirm the items on site, wipe or destroy every data-bearing device with a record for each one, pay
        you, and send a closure pack. You&rsquo;ll get a private link to follow every step.
      </p>
      {source === "sample" && (
        <p className="mt-3 rounded-[var(--radius-control)] bg-lime-200/60 px-3 py-2 text-xs font-medium text-forest-900">
          This request will be marked as a demo, because it uses the simulated sample inventory.
        </p>
      )}

      <form onSubmit={submit} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
        {field("company", "Company", { autoComplete: "organization", placeholder: "Acme Technologies Pvt Ltd" })}
        {field("contactName", "Contact name", { autoComplete: "name" })}
        {field("email", "Work email", { type: "email", autoComplete: "email", inputMode: "email" })}
        {field("phone", "Phone (optional)", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
        <div className="sm:col-span-2">{field("address", "Office address in Bengaluru", { autoComplete: "street-address" })}</div>
        {field("preferredDate", "Preferred visit date", { type: "date", min: todayInIndia() })}
        <div>
          <label htmlFor="visit-notes" className="text-sm font-medium text-ink">
            Notes for the team (optional)
          </label>
          <textarea
            id="visit-notes"
            rows={2}
            maxLength={500}
            value={fields.notes}
            onChange={set("notes")}
            className={inputClass()}
            placeholder="Access instructions, loading bay, etc."
          />
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-invalid={errors.consent ? true : undefined}
              className="mt-0.5 h-4 w-4 accent-[#245a40]"
            />
            <span>ClearOut may store these details and contact me about this clear-out.</span>
          </label>
          {errors.consent && <p className="mt-1 text-xs text-danger-700">{errors.consent}</p>}
        </div>

        {failure && (
          <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700 sm:col-span-2">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> {failure}
          </p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-forest-900 px-5 py-3 font-semibold text-white hover:bg-forest-800 disabled:opacity-60"
          >
            {submitting ? "Sending request…" : "Request visit"} <ArrowRightIcon className="h-4 w-4" />
          </button>
          <p className="mt-2 text-xs text-muted">
            Prototype: requests are saved and handled in the ClearOut team console. No email is sent yet, so keep the link
            you get next.
          </p>
        </div>
      </form>
    </section>
  );
}
