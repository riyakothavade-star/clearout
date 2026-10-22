import type { Item, Quote, QuoteLine } from "./schema";
import type { Prices } from "./prices";

// The one canonical set of payout rules. The n8n workflow (n8n/quote.json) runs a copy of this
// logic; a unit test runs that copy against this function to prove the two give identical results.
//
// For an item worth something:  payout = resale price x condition multiplier x buy-back % x quantity
// For a disposal-cost item (negative resale price): cost = price x quantity. The condition multiplier
// and buy-back share are not applied, because a broken CRT costs as much to dispose of as a working one.
//
// All money is whole rupees. Multipliers are turned into whole percentages first, so the maths is
// integer arithmetic with a single rounding step per line.

const pct = (multiplier: number) => Math.round(multiplier * 100);

export function computeQuote(items: Item[], prices: Prices): Quote {
  const buyback = prices.buybackPercent;

  const lines: QuoteLine[] = items.map((item, index) => {
    const category = prices.categories.find((c) => c.id === item.priceCategoryId);
    const base = { index, type: item.type, quantity: item.quantity, condition: item.condition };
    if (!category) {
      return {
        ...base,
        categoryId: "none",
        categoryName: "No matching category",
        pricedOnSite: true,
        disposalCost: false,
        low: 0,
        high: 0,
      };
    }
    const condition = pct(prices.conditionMultiplier[item.condition]);
    const value = (rupees: number) =>
      rupees < 0 ? rupees * item.quantity : Math.round((rupees * condition * buyback * item.quantity) / 10_000);
    return {
      ...base,
      categoryId: category.id,
      categoryName: category.name,
      pricedOnSite: false,
      disposalCost: category.resaleLow < 0,
      // For a cost, the "low" end of the payout is the bigger cost.
      low: Math.min(value(category.resaleLow), value(category.resaleHigh)),
      high: Math.max(value(category.resaleLow), value(category.resaleHigh)),
    };
  });

  const subtotalLow = lines.reduce((sum, l) => sum + l.low, 0);
  const subtotalHigh = lines.reduce((sum, l) => sum + l.high, 0);

  return {
    lines,
    buybackPercent: buyback,
    fee: prices.feeRupees,
    subtotalLow,
    subtotalHigh,
    netLow: subtotalLow - prices.feeRupees,
    netHigh: subtotalHigh - prices.feeRupees,
    pricedOnSiteCount: lines.filter((l) => l.pricedOnSite).length,
  };
}

export type QuoteHeadline =
  | { kind: "range"; low: number; high: number }
  | { kind: "upTo"; high: number }
  | { kind: "doesNotCoverFee"; fee: number };

// Which of the three headlines to show. Never produces a "We'll pay you ₹0" promise.
export function quoteHeadline(quote: Quote): QuoteHeadline {
  if (quote.netLow > 0) return { kind: "range", low: quote.netLow, high: quote.netHigh };
  if (quote.netHigh > 0) return { kind: "upTo", high: quote.netHigh };
  return { kind: "doesNotCoverFee", fee: quote.fee };
}
