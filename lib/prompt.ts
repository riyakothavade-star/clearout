import { PRICES } from "@/lib/prices";

const categoryList = PRICES.categories.map((c) => `- ${c.id}: ${c.name}`).join("\n");

// The instruction sent to the AI provider along with the photos.
export const LISTING_PROMPT = `These are photos of a storeroom of retired office electronics. The photos are numbered.

List every item you can see. For each item give:
- type: what it is (brand/model if visible)
- quantity
- condition: good, fair, poor or scrap
- priceCategoryId: the best-matching id from this list, or "none" if nothing fits:
${categoryList}
- storesData: "yes" if it can store data (laptops, desktops, servers, phones, tablets, drives), "maybe" if it might (printers, copiers, network gear, anything you can't tell), "no" otherwise
- hasBattery: true if it contains or is a battery
- photos: the photo numbers you saw it in
- confidence: "high", or "low" if you are unsure about what it is, how many there are, or its condition
- note: a short note when confidence is low, otherwise empty

Rules:
- Don't count the same item twice across photos.
- Don't list what you can't see.
- If there are no electronics in the photos, return an empty items list and say why in noElectronicsReason.`;
