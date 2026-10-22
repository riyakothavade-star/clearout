import type { Item } from "./schema";

// Uncertain items first so the user sees what needs checking, then possible data-bearing devices.
// The sort is stable, so items keep the AI's order within each group. The quote is calculated on this
// same order, so quote rows and inventory rows line up.
export function sortForReview(items: Item[]): Item[] {
  const rank = (item: Item) => (item.confidence === "low" ? 0 : 2) + (item.storesData === "no" ? 1 : 0);
  return items.map((item, i) => ({ item, i })).sort((a, b) => rank(a.item) - rank(b.item) || a.i - b.i).map(({ item }) => item);
}

export function inventorySummary(items: Item[]) {
  return {
    groups: items.length,
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    needsCheck: items.filter((i) => i.confidence === "low").length,
    dataBearing: items.filter((i) => i.storesData !== "no").reduce((sum, i) => sum + i.quantity, 0),
    withBattery: items.filter((i) => i.hasBattery).reduce((sum, i) => sum + i.quantity, 0),
  };
}
