import { AlertIcon, BatteryIcon, CheckIcon, DataIcon } from "@/components/icons";
import type { Item } from "@/lib/schema";

// Every badge pairs colour with an icon and words, so meaning never depends on colour alone.

const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function DataBadge({ storesData }: { storesData: Item["storesData"] }) {
  if (storesData === "yes") {
    return (
      <span className={`${base} border-danger-200 bg-danger-50 text-danger-700`}>
        <DataIcon className="h-3.5 w-3.5" /> Stores data
      </span>
    );
  }
  if (storesData === "maybe") {
    return (
      <span className={`${base} border-danger-200 bg-surface text-danger-700`}>
        <DataIcon className="h-3.5 w-3.5" /> May store data
      </span>
    );
  }
  return null;
}

export function BatteryBadge({ hasBattery }: { hasBattery: boolean }) {
  if (!hasBattery) return null;
  return (
    <span className={`${base} border-attention-200 bg-attention-50 text-attention-800`}>
      <BatteryIcon className="h-3.5 w-3.5" /> Battery
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: Item["confidence"] }) {
  return confidence === "low" ? (
    <span className={`${base} border-attention-200 bg-attention-50 text-attention-800`}>
      <AlertIcon className="h-3.5 w-3.5" /> Please check
    </span>
  ) : (
    <span className={`${base} border-forest-100 bg-success-50 text-success-700`}>
      <CheckIcon className="h-3.5 w-3.5" /> Confident
    </span>
  );
}

