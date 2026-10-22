// Job status names and labels. Kept separate from model.ts so browser code can import them
// (model.ts uses Node's crypto module, which can't run in the browser).

export const STATUSES = ["requested", "scheduled", "inspected", "wiped", "paid", "closed", "cancelled"] as const;
export type JobStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<JobStatus, string> = {
  requested: "Visit requested",
  scheduled: "Visit scheduled",
  inspected: "Items confirmed on site",
  wiped: "Data devices wiped or destroyed",
  paid: "Payment recorded",
  closed: "Closed, closure pack issued",
  cancelled: "Cancelled",
};

export const OUTCOME_LABELS = { wiped: "Wiped", destroyed: "Physically destroyed", "no-storage": "No storage found" } as const;
export const PAYOUT_METHOD_LABELS = { "bank-transfer": "Bank transfer", upi: "UPI", cheque: "Cheque" } as const;
