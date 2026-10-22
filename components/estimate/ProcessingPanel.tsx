import { CheckIcon } from "@/components/icons";

export type Stage = "analysing" | "quoting";

// Only shows stages that correspond to real work: photos were prepared in the browser when chosen,
// then one request reads them, then one request calculates the estimate.
export function ProcessingPanel({ stage, seconds, sample, onCancel }: { stage: Stage; seconds: number; sample: boolean; onCancel: () => void }) {
  const steps = [
    { label: sample ? "Sample clear-out selected" : "Photos prepared in your browser", state: "done" },
    { label: sample ? "Loading the sample inventory (no AI used)" : "Analysing photos with AI", state: stage === "analysing" ? "active" : "done" },
    { label: "Calculating your estimate", state: stage === "quoting" ? "active" : "waiting" },
  ] as const;

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-4">
        <p className="font-semibold text-ink">{stage === "analysing" && !sample ? "Analysing your photos…" : "Working on your estimate…"}</p>
        <span className="rounded-md bg-sunken px-2 py-0.5 text-sm font-medium tabular-nums text-muted" aria-label={`${seconds} seconds elapsed`}>
          {seconds} s
        </span>
      </div>
      <ol className="mt-4 space-y-2.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            {s.state === "done" ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-700 text-white">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
            ) : s.state === "active" ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-forest-100 border-t-forest-700" aria-hidden="true" />
            ) : (
              <span className="h-5 w-5 rounded-full border-2 border-line" aria-hidden="true" />
            )}
            <span className={s.state === "waiting" ? "text-muted" : "text-ink"}>{s.label}</span>
          </li>
        ))}
      </ol>
      {stage === "analysing" && !sample && (
        <p className="mt-4 text-xs text-muted">Usually under a minute. If the AI service is busy we retry automatically.</p>
      )}
      <button type="button" onClick={onCancel} className="mt-4 text-sm font-medium text-forest-700 underline underline-offset-4 hover:text-forest-900">
        Cancel
      </button>
    </div>
  );
}
