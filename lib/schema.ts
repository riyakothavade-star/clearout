import { z } from "zod";

export const MAX_PHOTOS = 5;
export const MAX_ITEMS = 60;
export const MAX_QUANTITY = 500;

const Condition = z.enum(["good", "fair", "poor", "scrap"]);
const StoresData = z.enum(["yes", "maybe", "no"]);
const Confidence = z.enum(["high", "low"]);

// ---- What we ask the AI for --------------------------------------------------------------
// Kept simple (no min/max rules) because the AI providers' JSON-schema support is limited.
// Everything the AI returns is then checked again against the strict schemas below.

export const AiItemSchema = z.object({
  type: z.string().describe("What the item is, e.g. 'Dell laptop' or 'UPS battery'"),
  quantity: z.number().int(),
  condition: Condition,
  priceCategoryId: z
    .string()
    .describe("The id of the best-matching price category, or 'none' if nothing fits"),
  storesData: StoresData,
  hasBattery: z.boolean(),
  photos: z.array(z.number().int()).describe("Which photo numbers the item appears in"),
  confidence: Confidence,
  note: z.string().describe("Short note if unsure, otherwise empty"),
});

export const AiListingSchema = z.object({
  items: z.array(AiItemSchema),
  noElectronicsReason: z
    .string()
    .describe("If items is empty, why (e.g. 'The photo shows a plant'). Otherwise empty."),
});

// ---- Strict shapes the app relies on -------------------------------------------------------

export const ItemSchema = z.object({
  type: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  condition: Condition,
  priceCategoryId: z.string().trim().min(1).max(40),
  storesData: StoresData,
  hasBattery: z.boolean(),
  photos: z.array(z.number().int().min(1).max(MAX_PHOTOS)).max(MAX_PHOTOS),
  confidence: Confidence,
  note: z.string().max(400),
});

export const ListingSchema = z.object({
  items: z.array(ItemSchema).max(MAX_ITEMS),
  noElectronicsReason: z.string().max(400),
});

export const QuoteRequestSchema = z.object({
  items: z.array(ItemSchema).min(1).max(MAX_ITEMS),
});

export type Item = z.infer<typeof ItemSchema>;
export type Listing = z.infer<typeof ListingSchema>;

// ---- The quote ------------------------------------------------------------------------------

const Rupees = z.number().int();

export const QuoteLineSchema = z.object({
  index: z.number().int().min(0),
  type: z.string(),
  quantity: z.number().int().min(1),
  condition: Condition,
  categoryId: z.string(),
  categoryName: z.string(),
  pricedOnSite: z.boolean(),
  disposalCost: z.boolean(),
  low: Rupees,
  high: Rupees,
});

export const QuoteSchema = z.object({
  lines: z.array(QuoteLineSchema),
  buybackPercent: z.number().int().min(0).max(100),
  fee: Rupees.min(0),
  subtotalLow: Rupees,
  subtotalHigh: Rupees,
  // What is left after the fee. Can be negative: the UI then says the lot doesn't cover the fee.
  netLow: Rupees,
  netHigh: Rupees,
  pricedOnSiteCount: z.number().int().min(0),
});

export type QuoteLine = z.infer<typeof QuoteLineSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
