import { expect, test, type Page } from "@playwright/test";

// The full managed-service journey, through the real UI and API (jobs are stored in a temporary
// folder for the test server; no AI is used because the sample clear-out drives the estimate).

const PASSCODE = "e2e-team-passcode";
const visitDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

async function requestVisitFromSample(page: Page) {
  await page.goto("/estimate");
  await page.getByRole("button", { name: "View the sample clear-out" }).click();
  await expect(page.getByRole("heading", { name: "Request a ClearOut visit" })).toBeVisible();
  await page.getByLabel("Company").fill("E2E Test Co");
  await page.getByLabel("Contact name").fill("Test Person");
  await page.getByLabel("Work email").fill("facilities@e2e.test");
  await page.getByLabel("Office address in Bengaluru").fill("1 Test Street, Bengaluru 560001");
  await page.getByLabel("Preferred visit date").fill(visitDate);
  await page.getByLabel("ClearOut may store these details and contact me about this clear-out.").check();
  await page.getByRole("button", { name: "Request visit" }).click();
  await expect(page).toHaveURL(/\/jobs\/CO-[A-Z0-9]{6}\?t=[0-9a-f]{32}/);
  const url = new URL(page.url());
  return { ref: url.pathname.split("/")[2], trackingUrl: `${url.pathname}?t=${url.searchParams.get("t")}` };
}

async function signIn(page: Page) {
  await page.goto("/ops");
  await page.getByLabel("Team passcode").fill(PASSCODE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Clear-outs" })).toBeVisible();
}

test("visit request form validates and creates a private tracking link", async ({ page }) => {
  await page.goto("/estimate");
  await page.getByRole("button", { name: "View the sample clear-out" }).click();
  await page.getByRole("button", { name: "Request visit" }).click();
  await expect(page.getByText("Enter your company name.")).toBeVisible();
  await expect(page.getByText("Enter a valid work email.")).toBeVisible();

  const { ref, trackingUrl } = await requestVisitFromSample(page);
  await expect(page.getByText(`Request sent. Your reference is ${ref}.`)).toBeVisible();
  await expect(page.getByText("Demo request · sample inventory")).toBeVisible();
  await expect(page.getByText("Next step").first()).toBeVisible();

  // Without the token the job is not visible.
  await page.goto(`/jobs/${ref}`);
  await expect(page.getByText("We couldn't find that clear-out.")).toBeVisible();
  await page.goto(trackingUrl);
  await expect(page.getByRole("heading", { name: "E2E Test Co" })).toBeVisible();
});

test("team console runs the job to a closure pack, with the wipe gate enforced", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop console flow");
  const { ref, trackingUrl } = await requestVisitFromSample(page);

  await page.goto("/ops");
  await page.getByLabel("Team passcode").fill("wrong-passcode");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That passcode isn't right.")).toBeVisible();
  await signIn(page);

  await page.getByRole("link", { name: new RegExp(ref) }).click();
  await page.getByLabel("Technician").fill("Ravi Kumar");
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await expect(page.getByText("Visit scheduled.")).toBeVisible();

  await page.getByRole("button", { name: "Confirm items on site" }).click();
  await expect(page.getByText("Items confirmed. Wipe records created.")).toBeVisible();
  await expect(page.getByText("0 of 13 units have evidence.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete wipe step" })).toBeDisabled();

  // Record every unit through the form.
  for (let i = 0; i < 13; i++) {
    const row = page.locator("li").filter({ has: page.getByRole("button", { name: "Save record" }) }).first();
    await row.getByLabel("Serial number").fill(`SN-${i + 1}`);
    await row.getByLabel("Evidence").fill(`Report ${i + 1}`);
    await row.getByRole("button", { name: "Save record" }).click();
    await expect(page.getByText(`${i + 1} of 13 units have evidence.`, { exact: false })).toBeVisible();
  }

  await page.getByRole("button", { name: "Complete wipe step" }).click();
  await expect(page.getByText("Wipe step complete.")).toBeVisible();
  await page.getByLabel("Amount (₹)").fill("30000");
  await page.getByLabel("Reference").fill("UTR-E2E-1");
  await page.getByLabel("I understand this prototype only records the payment. No money is moved.").check();
  await page.getByRole("button", { name: /Record payment/ }).click();
  await expect(page.getByText("Payment recorded (simulated).")).toBeVisible();
  await page.getByRole("button", { name: "Close clear-out" }).click();
  await expect(page.getByRole("status")).toContainText("Clear-out closed.");

  // The customer sees the closed job and the closure pack.
  await page.goto(trackingUrl);
  await expect(page.getByText("Simulated in this prototype: no money was transferred.")).toBeVisible();
  await page.getByRole("link", { name: "View closure pack" }).click();
  await expect(page.getByRole("heading", { name: "Clear-out closure pack" })).toBeVisible();
  await expect(page.getByText("Data-bearing devices (13)")).toBeVisible();
  await expect(page.getByText("not a legally certified certificate of destruction", { exact: false })).toBeVisible();
});
