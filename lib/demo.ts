import type { Listing } from "./schema";

// The sample clear-out used by demo mode and by the product preview on the landing page.
// It is simulated data, written by hand to look like a typical office storeroom. It is not the result
// of analysing any photo, and every screen that shows it says so. Its payout is never typed in here:
// it is always calculated by the same price engine (lib/quote.ts) as a live result.

export function demoEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DEMO_MODE?.trim().toLowerCase() === "true";
}

export const SAMPLE_PHOTOS = [
  { number: 1, label: "Laptop shelf" },
  { number: 2, label: "Monitors and desktops" },
  { number: 3, label: "Power and network corner" },
] as const;

export const SAMPLE_LISTING: Listing = {
  noElectronicsReason: "",
  items: [
    {
      type: "Dell Latitude laptops (older models)",
      quantity: 6,
      condition: "fair",
      priceCategoryId: "laptop-old",
      storesData: "yes",
      hasBattery: true,
      photos: [1],
      confidence: "high",
      note: "",
    },
    {
      type: "Lenovo ThinkPad laptops",
      quantity: 2,
      condition: "good",
      priceCategoryId: "laptop-recent",
      storesData: "yes",
      hasBattery: true,
      photos: [1],
      confidence: "high",
      note: "",
    },
    {
      type: "24-inch flat-panel monitors",
      quantity: 5,
      condition: "fair",
      priceCategoryId: "monitor-flat",
      storesData: "no",
      hasBattery: false,
      photos: [2],
      confidence: "high",
      note: "",
    },
    {
      type: "HP small-form-factor desktops",
      quantity: 3,
      condition: "poor",
      priceCategoryId: "desktop",
      storesData: "yes",
      hasBattery: false,
      photos: [2],
      confidence: "low",
      note: "Two units are partly hidden behind the monitors, so the count may be off by one.",
    },
    {
      type: "Unidentified grey box, possibly a small network storage drive",
      quantity: 1,
      condition: "poor",
      priceCategoryId: "none",
      storesData: "maybe",
      hasBattery: false,
      photos: [2],
      confidence: "low",
      note: "Model not visible. It may store data, so it needs a closer look on site.",
    },
    {
      type: "UPS units",
      quantity: 2,
      condition: "poor",
      priceCategoryId: "ups-unit",
      storesData: "no",
      hasBattery: true,
      photos: [3],
      confidence: "high",
      note: "",
    },
    {
      type: "Loose lead-acid UPS batteries",
      quantity: 4,
      condition: "scrap",
      priceCategoryId: "battery-lead",
      storesData: "no",
      hasBattery: true,
      photos: [3],
      confidence: "low",
      note: "Batteries look swollen. They need careful handling and may have no resale value.",
    },
    {
      type: "24-port network switch",
      quantity: 1,
      condition: "fair",
      priceCategoryId: "network",
      storesData: "maybe",
      hasBattery: false,
      photos: [3],
      confidence: "high",
      note: "",
    },
    {
      type: "Cables, chargers and adapters",
      quantity: 30,
      condition: "scrap",
      priceCategoryId: "cables",
      storesData: "no",
      hasBattery: false,
      photos: [3],
      confidence: "high",
      note: "",
    },
  ],
};
