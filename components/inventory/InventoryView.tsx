import { categoryName } from "@/lib/prices";
import { inventorySummary } from "@/lib/inventory";
import type { Item } from "@/lib/schema";
import { BatteryBadge, ConfidenceBadge, DataBadge } from "./Badges";

type Props = {
  items: Item[]; // already in review order (see sortForReview)
  photoLabel?: (n: number) => string;
};

const defaultLabel = (n: number) => `Photo ${n}`;

function photosText(item: Item, label: (n: number) => string) {
  return item.photos.length ? item.photos.map(label).join(", ") : "Not stated";
}

export function InventorySummary({ items }: { items: Item[] }) {
  const s = inventorySummary(items);
  const stats = [
    { label: "Item groups", value: s.groups },
    { label: "Estimated units", value: s.totalQuantity },
    { label: "Need checking", value: s.needsCheck, tone: s.needsCheck ? "text-attention-800" : "" },
    { label: "May hold data", value: s.dataBearing, tone: s.dataBearing ? "text-danger-700" : "" },
    { label: "With batteries", value: s.withBattery },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-5">
      {stats.map((st) => (
        <div key={st.label} className="bg-surface px-4 py-3">
          <dt className="text-xs font-medium text-muted">{st.label}</dt>
          <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${st.tone ?? ""}`}>{st.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function InventoryView({ items, photoLabel = defaultLabel }: Props) {
  return (
    <div>
      {/* Wide screens: a table. */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface md:block">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Detected items, uncertain ones first</caption>
          <thead className="bg-sunken/60 text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Item</th>
              <th scope="col" className="px-3 py-3 text-right">Qty</th>
              <th scope="col" className="px-3 py-3">Condition · category</th>
              <th scope="col" className="px-4 py-3">Checks and flags</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className={`border-t border-line align-top ${item.confidence === "low" ? "bg-attention-50/60" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{item.type}</p>
                  <p className="mt-0.5 text-xs text-muted">Seen in {photosText(item, photoLabel)}</p>
                  {item.note && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">AI note: {item.note}</p>}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{item.quantity}</td>
                <td className="px-3 py-3">
                  <p className="capitalize text-ink">{item.condition}</p>
                  <p className="mt-0.5 text-xs text-muted">{categoryName(item.priceCategoryId)}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <ConfidenceBadge confidence={item.confidence} />
                    <DataBadge storesData={item.storesData} />
                    <BatteryBadge hasBattery={item.hasBattery} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Narrow screens: cards, so flags and confidence are never cut off. */}
      <ul className="space-y-3 md:hidden" aria-label="Detected items, uncertain ones first">
        {items.map((item, i) => (
          <li
            key={i}
            className={`rounded-[var(--radius-card)] border bg-surface p-4 ${item.confidence === "low" ? "border-attention-200 bg-attention-50/50" : "border-line"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-ink">{item.type}</p>
              <span className="shrink-0 rounded-md bg-sunken px-2 py-0.5 text-sm font-semibold tabular-nums">× {item.quantity}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ConfidenceBadge confidence={item.confidence} />
              <DataBadge storesData={item.storesData} />
              <BatteryBadge hasBattery={item.hasBattery} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted">Condition</dt>
              <dd className="capitalize">{item.condition}</dd>
              <dt className="text-muted">Category</dt>
              <dd>{categoryName(item.priceCategoryId)}</dd>
              <dt className="text-muted">Source</dt>
              <dd>{photosText(item, photoLabel)}</dd>
            </dl>
            {item.note && <p className="mt-2 text-xs leading-relaxed text-muted">AI note: {item.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
