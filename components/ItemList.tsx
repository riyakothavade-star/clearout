import type { Item } from "@/lib/schema";
import prices from "@/data/prices.json";

function categoryName(id: string) {
  return prices.categories.find((c) => c.id === id)?.name ?? "No matching category";
}

// The AI's list. Low-confidence items go first, and every row shows where it came from
// (photo number, chosen price category, Claude's note) so mistakes are easy to spot.
export default function ItemList({ items }: { items: Item[] }) {
  const sorted = [...items].sort((a, b) => Number(a.confidence === "high") - Number(b.confidence === "high"));

  return (
    <section>
      <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
        AI read your photos. Check this list against them. Flags come from the photos only; ClearOut checks
        every device on site.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-300 text-zinc-600">
            <tr>
              <th className="py-2 pr-3">Item</th>
              <th className="py-2 pr-3">Qty</th>
              <th className="py-2 pr-3">Condition</th>
              <th className="py-2 pr-3">Price category</th>
              <th className="py-2 pr-3">Photo</th>
              <th className="py-2 pr-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr key={i} className={`border-b border-zinc-200 ${item.confidence === "low" ? "bg-amber-50" : ""}`}>
                <td className="py-2 pr-3">
                  <div className="font-medium">{item.type}</div>
                  {item.confidence === "low" && (
                    <span className="mt-1 inline-block rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                      Please check
                    </span>
                  )}
                  {item.note && <div className="mt-1 text-xs text-zinc-600">AI note: {item.note}</div>}
                </td>
                <td className="py-2 pr-3">{item.quantity}</td>
                <td className="py-2 pr-3 capitalize">{item.condition}</td>
                <td className="py-2 pr-3">{categoryName(item.priceCategoryId)}</td>
                <td className="py-2 pr-3">{item.photos.join(", ")}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {item.storesData === "yes" && <div>🔴 Stores data</div>}
                  {item.storesData === "maybe" && <div>🔴? Possible storage</div>}
                  {item.hasBattery && <div>🔋 Battery</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
