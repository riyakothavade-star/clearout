import { z } from "zod";
import pricesFile from "@/data/prices.json";

// The price table in data/prices.json, checked once when the app starts.
// A mistake in the file (a typo, a duplicate id, low > high) fails loudly instead of producing wrong quotes.

const Multiplier = z.number().min(0).max(1);

export const PricesSchema = z
  .object({
    buybackPercent: z.number().int().min(0).max(100),
    feeRupees: z.number().int().min(0),
    conditionMultiplier: z.object({ good: Multiplier, fair: Multiplier, poor: Multiplier, scrap: Multiplier }),
    categories: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]+$/),
            name: z.string().min(1),
            // Rupees for ONE item in good condition. A negative number means the item costs money to
            // dispose of (for example CRT monitors); see lib/quote.ts for how that is handled.
            resaleLow: z.number().int(),
            resaleHigh: z.number().int(),
          })
          .refine((c) => c.resaleLow <= c.resaleHigh, { message: "resaleLow must be <= resaleHigh" }),
      )
      .min(1)
      .refine((cats) => new Set(cats.map((c) => c.id)).size === cats.length, { message: "duplicate category id" }),
  })
  .passthrough();

export type Prices = z.infer<typeof PricesSchema>;

export const PRICES: Prices = PricesSchema.parse(pricesFile);

export const CATEGORY_IDS = new Set(PRICES.categories.map((c) => c.id));

export function categoryName(id: string, prices: Prices = PRICES): string {
  return prices.categories.find((c) => c.id === id)?.name ?? "No matching category";
}
