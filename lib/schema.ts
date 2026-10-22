import { z } from "zod";

// One item Claude found in the photos.
export const ItemSchema = z.object({
  type: z.string().describe("What the item is, e.g. 'Dell laptop' or 'UPS battery'"),
  quantity: z.number().int(),
  condition: z.enum(["good", "fair", "poor", "scrap"]),
  priceCategoryId: z
    .string()
    .describe("The id of the best-matching price category, or 'none' if nothing fits"),
  storesData: z.enum(["yes", "maybe", "no"]),
  hasBattery: z.boolean(),
  photos: z.array(z.number().int()).describe("Which photo numbers the item appears in"),
  confidence: z.enum(["high", "low"]),
  note: z.string().describe("Short note if unsure, otherwise empty"),
});

// Everything Claude returns for one set of photos.
export const ListingSchema = z.object({
  items: z.array(ItemSchema),
  noElectronicsReason: z
    .string()
    .describe("If items is empty, why (e.g. 'The photo shows a plant'). Otherwise empty."),
});

export type Item = z.infer<typeof ItemSchema>;
export type Listing = z.infer<typeof ListingSchema>;

// One row of the payout quote.
export const QuoteLineSchema = z.object({
  index: z.number().int(),
  type: z.string(),
  quantity: z.number(),
  condition: z.string(),
  categoryName: z.string(),
  pricedOnSite: z.boolean(),
  low: z.number(),
  high: z.number(),
});

export const QuoteSchema = z.object({
  lines: z.array(QuoteLineSchema),
  buybackPercent: z.number(),
  fee: z.number(),
  totalLow: z.number(),
  totalHigh: z.number(),
  pricedOnSiteCount: z.number(),
});

export type Quote = z.infer<typeof QuoteSchema>;
