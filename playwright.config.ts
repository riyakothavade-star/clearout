import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build on port 3100. They use the installed Google Chrome
// (channel "chrome"), so no extra browser download is needed. Every AI call is intercepted in the
// tests, so they never use a real AI key or quota.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", channel: "chrome", trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1280, height: 860 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: "rm -rf .data/e2e-jobs && npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DEMO_MODE: "true",
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "e2e-placeholder-not-a-real-key",
      N8N_QUOTE_URL: "",
      OPS_PASSCODE: "e2e-team-passcode",
      CLEAROUT_DATA_DIR: ".data/e2e-jobs",
    },
  },
});
