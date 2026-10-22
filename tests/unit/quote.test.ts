import { describe, expect, it } from "vitest";
import n8nWorkflow from "@/n8n/quote.json";
import { PRICES, PricesSchema, type Prices } from "@/lib/prices";
import { computeQuote, quoteHeadline } from "@/lib/quote";
import { QuoteSchema, type Item } from "@/lib/schema";
import { SAMPLE_LISTING } from "@/lib/demo";
import { rupeeRange, rupees } from "@/lib/format";

const item = (over: Partial<Item>): Item => ({
  type: "Test item",
  quantity: 1,
  condition: "good",
  priceCategoryId: "laptop-old",
  storesData: "yes",
  hasBattery: false,
  photos: [1],
  confidence: "high",
  note: "",
  ...over,
});

describe("computeQuote", () => {
  it("matches the hand-checked worked example (4 old laptops, fair)", () => {
    const q = computeQuote([item({ quantity: 4, condition: "fair" })], PRICES);
    expect(q.lines[0]).toMatchObject({ low: 3360, high: 8960, pricedOnSite: false, categoryName: "Laptop, 4+ years old" });
    expect(q.netLow).toBe(1860);
    expect(q.netHigh).toBe(7460);
  });

  it("applies each condition multiplier", () => {
    const low = (condition: Item["condition"]) => computeQuote([item({ condition })], PRICES).lines[0].low;
    expect(low("good")).toBe(1200); // 3000 x 1.0 x 40%
    expect(low("fair")).toBe(840); // 3000 x 0.7 x 40%
    expect(low("poor")).toBe(480); // 3000 x 0.4 x 40%
    expect(low("scrap")).toBe(120); // 3000 x 0.1 x 40%
  });

  it("returns whole rupees only", () => {
    const q = computeQuote(PRICES.categories.map((c, i) => item({ priceCategoryId: c.id, quantity: 7 + i, condition: "fair" })), PRICES);
    for (const l of q.lines) {
      expect(Number.isInteger(l.low)).toBe(true);
      expect(Number.isInteger(l.high)).toBe(true);
    }
    expect(QuoteSchema.safeParse(q).success).toBe(true);
  });

  it("deducts the fee once from the totals", () => {
    const q = computeQuote([item({}), item({})], PRICES);
    expect(q.subtotalLow).toBe(2400);
    expect(q.netLow).toBe(2400 - PRICES.feeRupees);
  });

  it("leaves unknown categories out of the total as 'priced on site'", () => {
    const q = computeQuote([item({}), item({ priceCategoryId: "none" }), item({ priceCategoryId: "made-up" })], PRICES);
    expect(q.pricedOnSiteCount).toBe(2);
    expect(q.lines[1]).toMatchObject({ pricedOnSite: true, low: 0, high: 0, categoryId: "none" });
    expect(q.subtotalLow).toBe(1200);
  });

  it("treats a negative resale price as a disposal cost, without condition or buy-back", () => {
    const prices: Prices = { ...PRICES, categories: [...PRICES.categories, { id: "crt-cost", name: "CRT (disposal)", resaleLow: -300, resaleHigh: -100 }] };
    const q = computeQuote([item({ priceCategoryId: "crt-cost", quantity: 2, condition: "scrap" })], prices);
    expect(q.lines[0]).toMatchObject({ disposalCost: true, low: -600, high: -200 });
  });
});

describe("quoteHeadline", () => {
  const withNet = (netLow: number, netHigh: number) => ({ ...computeQuote([item({})], PRICES), netLow, netHigh });
  it("shows a range when both ends clear the fee", () => {
    expect(quoteHeadline(withNet(500, 900))).toEqual({ kind: "range", low: 500, high: 900 });
  });
  it("shows 'up to' when only the high end clears the fee", () => {
    expect(quoteHeadline(withNet(-200, 900))).toEqual({ kind: "upTo", high: 900 });
    expect(quoteHeadline(withNet(0, 900))).toEqual({ kind: "upTo", high: 900 });
  });
  it("never promises ₹0: says the lot doesn't cover the fee", () => {
    expect(quoteHeadline(withNet(-900, 0))).toEqual({ kind: "doesNotCoverFee", fee: PRICES.feeRupees });
    expect(quoteHeadline(withNet(-900, -100)).kind).toBe("doesNotCoverFee");
  });
});

describe("price table", () => {
  it("data/prices.json is valid", () => {
    expect(PRICES.buybackPercent).toBe(40);
    expect(PRICES.feeRupees).toBe(1500);
    expect(PRICES.conditionMultiplier).toEqual({ good: 1, fair: 0.7, poor: 0.4, scrap: 0.1 });
  });
  it("rejects broken tables", () => {
    const bad = (over: object) => PricesSchema.safeParse({ ...PRICES, ...over }).success;
    expect(bad({ buybackPercent: 120 })).toBe(false);
    expect(bad({ feeRupees: -1 })).toBe(false);
    expect(bad({ categories: [{ id: "a", name: "A", resaleLow: 9, resaleHigh: 1 }] })).toBe(false);
    expect(bad({ categories: [{ id: "a", name: "A", resaleLow: 1, resaleHigh: 2 }, { id: "a", name: "B", resaleLow: 1, resaleHigh: 2 }] })).toBe(false);
    expect(bad({ categories: [{ id: "a", name: "A", resaleLow: 1.5, resaleHigh: 2 }] })).toBe(false);
  });
});

describe("sample clear-out", () => {
  it("quotes through the canonical engine with the expected numbers", () => {
    const q = computeQuote(SAMPLE_LISTING.items, PRICES);
    expect(q.subtotalLow).toBe(19692);
    expect(q.subtotalHigh).toBe(45948);
    expect(quoteHeadline(q)).toEqual({ kind: "range", low: 18192, high: 44448 });
    expect(q.pricedOnSiteCount).toBe(1);
  });
});

describe("n8n workflow parity", () => {
  // Runs the n8n Code node's JavaScript exactly as n8n would, and compares it with computeQuote.
  const node = n8nWorkflow.nodes.find((n) => n.name === "Compute quote");
  const run = new Function("$input", (node?.parameters as { jsCode: string }).jsCode) as (input: unknown) => [{ json: unknown }];
  const viaN8n = (items: Item[]) => run({ first: () => ({ json: { body: { items, prices: PRICES } } }) })[0].json;

  it("gives identical quotes for the sample and edge cases", () => {
    const cases: Item[][] = [
      SAMPLE_LISTING.items,
      [item({ quantity: 500, condition: "scrap", priceCategoryId: "cables" })],
      [item({ priceCategoryId: "none" })],
      PRICES.categories.map((c, i) => item({ priceCategoryId: c.id, quantity: 1 + i, condition: (["good", "fair", "poor", "scrap"] as const)[i % 4] })),
    ];
    for (const items of cases) expect(viaN8n(items)).toEqual(computeQuote(items, PRICES));
  });
});

describe("rupee formatting", () => {
  it("uses Indian digit grouping", () => {
    expect(rupees(123456)).toBe("₹1,23,456");
    expect(rupees(-1500)).toBe("−₹1,500");
    expect(rupeeRange(18192, 44448)).toBe("₹18,192–₹44,448");
    expect(rupeeRange(500, 500)).toBe("₹500");
  });
});
