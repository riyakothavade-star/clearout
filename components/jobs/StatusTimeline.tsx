import { CheckIcon } from "@/components/icons";
import type { Job } from "@/lib/jobs/model";
import { STATUS_LABELS, type JobStatus } from "@/lib/jobs/status";

const ORDER: JobStatus[] = ["requested", "scheduled", "inspected", "wiped", "paid", "closed"];

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

// The six service steps, with the date each one happened and its note.
export function StatusTimeline({ job }: { job: Pick<Job, "status" | "events"> }) {
  const reached = job.status === "cancelled" ? -1 : ORDER.indexOf(job.status);
  const lastEvent = (s: JobStatus) => [...job.events].reverse().find((e) => e.status === s);

  return (
    <ol className="space-y-0">
      {ORDER.map((status, i) => {
        const event = lastEvent(status);
        const done = i <= reached;
        const current = i === reached + 1 && job.status !== "closed" && job.status !== "cancelled";
        return (
          <li key={status} className="relative flex gap-3 pb-5 last:pb-0">
            {i < ORDER.length - 1 && (
              <span className={`absolute left-[11px] top-6 h-[calc(100%-1rem)] w-0.5 ${done ? "bg-forest-700" : "bg-line"}`} aria-hidden="true" />
            )}
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                done ? "border-forest-700 bg-forest-700 text-white" : current ? "border-forest-700 bg-surface" : "border-line bg-surface"
              }`}
            >
              {done ? <CheckIcon className="h-3.5 w-3.5" /> : <span className="sr-only">{current ? "Next" : "Not yet"}</span>}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${done || current ? "text-ink" : "text-muted"}`}>
                {STATUS_LABELS[status]}
                {current && <span className="ml-2 rounded-full bg-attention-50 px-2 py-0.5 text-xs font-medium text-attention-800">Next step</span>}
              </p>
              {event && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {formatWhen(event.at)} · {event.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
      {job.status === "cancelled" && (
        <li className="mt-2 rounded-[var(--radius-control)] border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {lastEvent("cancelled")?.note ?? "Cancelled."}
        </li>
      )}
    </ol>
  );
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const tone =
    status === "closed" ? "bg-forest-900 text-white"
    : status === "cancelled" ? "bg-danger-50 text-danger-700 border border-danger-200"
    : status === "requested" ? "bg-attention-50 text-attention-800 border border-attention-200"
    : "bg-forest-100 text-forest-900";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{STATUS_LABELS[status]}</span>;
}
