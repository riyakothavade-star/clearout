import type { Item, Quote } from "./schema";
import type pricesFile from "@/data/prices.json";

type Prices = typeof pricesFile;

// The payout rules. The same code is pasted into the n8n "quote" workflow (n8n/quote.json).
// payout per item = resale price for its category x condition multiplier x buy-back % x quantity
export function computeQuote(items: Item[], prices: Prices): Quote {
  const share = prices.buybackPercent / 100;
  const lines = items.map((item, index) => {
    const category = prices.categories.find((c) => c.id === item.priceCategoryId);
    if (!category) {
      return {
        index,
        type: item.type,
        quantity: item.quantity,
        condition: item.condition,
        categoryName: "No matching category",
        pricedOnSite: true,
        low: 0,
        high: 0,
      };
    }
    const factor = prices.conditionMultiplier[item.condition] * share * item.quantity;
    return {
      index,
      type: item.type,
      quantity: item.quantity,
      condition: item.condition,
      categoryName: category.name,
      pricedOnSite: false,
      low: Math.round(category.resaleLow * factor),
      high: Math.round(category.resaleHigh * factor),
    };
  });

  const sumLow = lines.reduce((sum, l) => sum + l.low, 0);
  const sumHigh = lines.reduce((sum, l) => sum + l.high, 0);

  return {
    lines,
    buybackPercent: prices.buybackPercent,
    fee: prices.feeRupees,
    totalLow: Math.max(0, sumLow - prices.feeRupees),
    totalHigh: Math.max(0, sumHigh - prices.feeRupees),
    pricedOnSiteCount: lines.filter((l) => l.pricedOnSite).length,
  };
}
