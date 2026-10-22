import { expect, test, type Page } from "@playwright/test";
import { SAMPLE_LISTING } from "@/lib/demo";
import { rupeeRange } from "@/lib/format";
import { sortForReview } from "@/lib/inventory";
import { PRICES } from "@/lib/prices";
import { computeQuote, quoteHeadline } from "@/lib/quote";

// A real 1x1 PNG, so the browser can actually decode and shrink it.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const photo = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

const sampleHeadline = (() => {
  const h = quoteHeadline(computeQuote(sortForReview(SAMPLE_LISTING.items), PRICES));
  if (h.kind !== "range") throw new Error("sample should produce a range");
  return rupeeRange(h.low, h.high);
})();

const LIVE_ITEMS = [
  { ...SAMPLE_LISTING.items[0], type: "ThinkPad laptops", quantity: 3 },
  { ...SAMPLE_LISTING.items[6], type: "UPS battery", quantity: 1 },
];

// Fails the test on any uncaught error in the page.
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const addPhotos = (page: Page, files: ReturnType<typeof photo>[]) => page.locator('input[type="file"][multiple]').setInputFiles(files);

test("landing page loads and the main CTA opens the estimate workspace", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Retired office tech.");
  await expect(page.getByText("Illustrative sample data").first()).toBeVisible();
  await page.getByRole("link", { name: "Get my estimate" }).first().click();
  await expect(page).toHaveURL(/\/estimate$/);
  await expect(page.getByRole("heading", { name: "Photos in. Inventory and estimate out." })).toBeVisible();
  expect(errors).toEqual([]);
});

test("invalid input shows useful errors and blocks analysis", async ({ page }) => {
  await page.goto("/estimate");
  const analyse = page.getByRole("button", { name: /Analyse photos/ });
  await expect(analyse).toBeDisabled();
  await expect(page.getByText("Add at least one photo to start.")).toBeVisible();

  await addPhotos(page, [{ name: "invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") }]);
  await expect(page.getByText("This isn't a photo. Choose a JPEG or PNG image.")).toBeVisible();
  await expect(page.getByText("1 photo can't be used. Remove or replace it to continue.").first()).toBeVisible();
  await expect(analyse).toBeDisabled();

  await page.getByRole("button", { name: "Remove photo 1" }).click();
  await addPhotos(page, [{ name: "IMG_0042.HEIC", mimeType: "image/heic", buffer: Buffer.from("not really an image") }]);
  await expect(page.getByText(/iPhone HEIC photos can't be opened/)).toBeVisible();
  await expect(page.locator('img[alt^="Photo 1"]')).toHaveCount(0); // no broken thumbnail
  await page.getByRole("button", { name: "Remove photo 1" }).click();

  await addPhotos(page, ["a", "b", "c", "d", "e", "f"].map((n) => photo(`${n}.png`)));
  await expect(page.getByText("Up to 5 photos can be analysed. Remove 1 to continue.").first()).toBeVisible();
  await expect(analyse).toBeDisabled();
  await page.getByRole("button", { name: "Remove photo 6" }).click();
  await expect(analyse).toBeEnabled();
});

test("sample clear-out completes without AI and matches the pricing engine", async ({ page }) => {
  const errors = watchErrors(page);
  let aiCalls = 0;
  await page.route("**/api/listing", (route) => {
    aiCalls += 1;
    return route.abort();
  });
  await page.goto("/estimate");
  await page.getByRole("button", { name: "View the sample clear-out" }).click();

  await expect(page.getByText("Sample clear-out · simulated data, not AI analysis")).toBeVisible();
  await expect(page.getByTestId("quote-headline")).toHaveText(sampleHeadline);
  await expect(page.getByText("Estimate based on submitted photos. Final amount confirmed on site.")).toBeVisible();
  await expect(page.getByText("Sample estimate · simulated data")).toBeVisible();
  await expect(page.getByText("Stores data").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Battery").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Please check").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Priced on site", { exact: true })).toBeVisible();
  expect(aiCalls).toBe(0);

  // Repeatable: run it again and get the same answer.
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("button", { name: "View the sample clear-out" }).click();
  await expect(page.getByTestId("quote-headline")).toHaveText(sampleHeadline);
  expect(errors).toEqual([]);
});

test("live analysis: failure offers retry and the sample, then a retry succeeds", async ({ page }) => {
  const errors = watchErrors(page);
  let attempt = 0;
  await page.route("**/api/listing", (route) => {
    attempt += 1;
    return attempt === 1
      ? route.fulfill({ status: 503, json: { error: { code: "PROVIDER_BUSY", message: "ignored" } } })
      : route.fulfill({ json: { source: "ai", items: LIVE_ITEMS, noElectronicsReason: "" } });
  });
  await page.goto("/estimate");
  await addPhotos(page, [photo("pile.png")]);
  await page.getByRole("button", { name: /Analyse photos/ }).click();

  await expect(page.getByRole("alert").filter({ hasText: "The AI service is busy right now." })).toBeVisible();
  await expect(page.getByRole("button", { name: "View the sample clear-out instead" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(page.getByText("AI-assisted analysis of your photos")).toBeVisible();
  const expected = quoteHeadline(computeQuote(sortForReview(LIVE_ITEMS), PRICES));
  await expect(page.getByTestId("quote-headline")).toHaveText(expected.kind === "range" ? rupeeRange(expected.low, expected.high) : /./);
  await expect(page.getByText("ThinkPad laptops").filter({ visible: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("a failed estimate keeps the inventory and can be retried", async ({ page }) => {
  let quoteCalls = 0;
  await page.route("**/api/quote", async (route) => {
    quoteCalls += 1;
    if (quoteCalls === 1) return route.fulfill({ status: 502, json: { error: { code: "QUOTE_FAILED", message: "x" } } });
    return route.continue();
  });
  await page.goto("/estimate");
  await page.getByRole("button", { name: "View the sample clear-out" }).click();
  await expect(page.getByText("We couldn't calculate your estimate.")).toBeVisible();
  await expect(page.getByText("HP small-form-factor desktops").filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Retry estimate" }).click();
  await expect(page.getByTestId("quote-headline")).toHaveText(sampleHeadline);
});

test("no electronics found is explained, with no quote", async ({ page }) => {
  await page.route("**/api/listing", (route) =>
    route.fulfill({ json: { source: "ai", items: [], noElectronicsReason: "The photo shows a potted plant." } }),
  );
  await page.goto("/estimate");
  await addPhotos(page, [photo("plant.png")]);
  await page.getByRole("button", { name: /Analyse photos/ }).click();
  await expect(page.getByRole("heading", { name: "No electronics found" })).toBeVisible();
  await expect(page.getByText("AI note: The photo shows a potted plant.")).toBeVisible();
  await expect(page.getByTestId("quote-headline")).toHaveCount(0);
});

test("double clicks never send overlapping requests", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/listing", async (route) => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 800));
    return route.fulfill({ json: { source: "ai", items: LIVE_ITEMS, noElectronicsReason: "" } });
  });
  await page.goto("/estimate");
  await addPhotos(page, [photo("pile.png")]);
  const analyse = page.getByRole("button", { name: /Analyse photos/ });
  await analyse.click();
  await page.getByRole("button", { name: /Analysing/ }).click({ force: true }).catch(() => {});
  await expect(page.getByTestId("quote-headline")).toBeVisible();
  expect(calls).toBe(1);
});

test("mobile layout keeps flags and the estimate visible without sideways scrolling", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/estimate");
  await page.getByRole("button", { name: "View the sample clear-out" }).click();
  await expect(page.getByTestId("quote-headline")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const card = page.getByRole("list", { name: "Detected items, uncertain ones first" });
  await expect(card).toBeVisible();
  const badge = card.getByText("Stores data").first();
  await badge.scrollIntoViewIfNeeded();
  await expect(badge).toBeInViewport({ ratio: 1 }); // fully on screen, not cut off at the side
  await expect(card.getByText("Please check").first()).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Get an estimate" }).click();
  await expect(page).toHaveURL(/\/estimate$/);
});
