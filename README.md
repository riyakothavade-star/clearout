# ClearOut

**Retired office tech. One clear way out.**

ClearOut is a proposed managed clear-out service for retired office electronics at IT and technology companies in Bengaluru (roughly 50–500 employees). A company uploads photos of its storeroom. ClearOut returns an itemised inventory, flags anything that may store data or contains a battery, and shows an estimated payout. The proposed service then handles the physical inspection, data wiping, payment and documentation, and ClearOut manages the resale and recycling relationships itself. It is not a marketplace: customers never search for recyclers.

This repository is the hackathon prototype. **The photo-to-estimate tool works today.** Inspection, wiping, collection, payment and documentation are proposed service steps and are not built.

**Target customer:** a facilities, procurement or IT operations manager at a mid-sized tech company in Bengaluru.

**Job to be done:** "When our office has a storeroom full of retired electronics, I want to upload a few photos and receive an inventory and estimated payout, so that we can clear the space without spending days identifying devices, negotiating with recyclers or chasing data-destruction paperwork."

---

## What works today

| Feature | Status |
|---|---|
| Landing page (`/`) explaining the service, with a product preview | Done |
| Estimate workspace (`/estimate`): drag-and-drop, 1–5 photos, numbered thumbnails, remove and replace | Done |
| Browser checks before upload (count, file type, HEIC, corrupt files, size) with messages next to each photo | Done |
| AI inventory: type, quantity, condition, price category, data and battery flags, source photo, confidence, AI note | Done (Gemini tested; Claude written but untested, see below) |
| Uncertain items listed first; colour always paired with an icon and words | Done |
| Payout estimate from fixed rules, never from the AI | Done |
| Sample clear-out (demo mode) that needs no AI, no network and no quota | Done |
| Clear errors and recovery for outages, timeouts, quota, bad AI answers and quote failures | Done |
| Phone, tablet and desktop layouts (cards on phones, table on wider screens) | Done |
| Optional n8n quote workflow | Written and tested against the app's rules; **not connected** to a live n8n account |

**Planned, not built:** booking an inspection, the on-site wipe workflow, payments, closure documents, accounts and notifications.

## The three acceptance tests

1. **Photos to an itemised inventory.** Upload 1–5 photos; get an inventory with flags, uncertain items first, the source photo for each item, and no invented items.
2. **A transparent payout estimate.** Fixed rules calculate the payout. The AI never sets money, fee or prices. The page always shows: *"Estimate based on submitted photos. Final amount confirmed on site."*
3. **Invalid input and failures.** Every bad input and failure gives a short, actionable message. No crashes, and no technical details in the browser.

---

## How it works

```
Browser                        Server routes                       Rules
───────                        ─────────────                       ─────
choose photos ──check+shrink──▶ POST /api/listing ──▶ Gemini or Claude (server-side key)
                                 │  validates photos, rate-limits,      │
                                 │  checks the AI answer strictly ◀─────┘
                                 ▼
inventory ─────────────────────▶ POST /api/quote ──▶ lib/quote.ts (canonical)
                                                     (optional n8n, used only if it agrees exactly)
"View the sample" ─────────────▶ GET /api/demo  (DEMO_MODE=true; fixed sample, no AI)
page load ─────────────────────▶ GET /api/status (yes/no: analysis set up? demo on?)
```

**Where AI is used:** one call per analysis, to recognise items, judge condition, pick a price category, and flag data storage and batteries. Its answer must match a fixed JSON shape and is then checked again strictly on the server. An answer that doesn't match is rejected rather than quoted; unknown categories become "Priced on site".

**What stays human:** taking and choosing the photos, checking the list, deciding whether to proceed, the final amount (confirmed on site), and setting prices, buy-back share and fee.

### Repository structure

```
app/
  page.tsx                 Landing page
  estimate/page.tsx        Estimate workspace page
  api/listing/route.ts     Photo analysis (validation, rate limit, provider, strict checks)
  api/quote/route.ts       Payout estimate (canonical rules; optional n8n)
  api/demo/route.ts        Sample clear-out (only when DEMO_MODE=true)
  api/status/route.ts      Capability flags for the page (never secrets)
components/
  estimate/                Upload, progress and results workspace
  inventory/               Inventory table/cards, badges, quote card (shared with the landing page)
  site/                    Header and footer
lib/
  ai/provider.ts           Picks Gemini or Claude from server settings; strict answer check
  ai/gemini.ts, ai/claude.ts  Provider calls, timeouts, retries, error mapping
  quote.ts                 The canonical pricing rules and the payout headline
  prices.ts                Loads and validates data/prices.json
  schema.ts                Shared data shapes (zod)
  photos.ts                Server-side photo checks (base64, JPEG, size, dimensions)
  demo.ts                  The sample clear-out data
  errors.ts                Error codes and user messages
  client/preparePhoto.ts   Browser-side photo checks and resizing
data/prices.json           Price table (illustrative placeholders)
n8n/quote.json             Optional n8n workflow (same rules; parity is tested)
tests/                     Unit, API and end-to-end tests
DEMO.md                    Hackathon demo script and troubleshooting
```

---

## Pricing assumptions and limitations

All values live in `data/prices.json` and are checked when the app starts. A broken file stops the app instead of producing wrong quotes.

- Buy-back share: **40%** of resale value. Wiping and pickup fee: **₹1,500**.
- Condition multipliers: good 1.0, fair 0.7, poor 0.4, scrap 0.1.
- Per item: resale value for the category × condition × 40% × quantity, in whole rupees. Total = sum − fee.
- Items with no matching category are **"Priced on site"** and left out of the total.
- Headline: a range if both ends clear the fee; "Up to ₹X" if only the high end does; otherwise "This lot's estimated value doesn't cover the fee". It never says "We'll pay you ₹0".
- **The category prices are illustrative placeholders, not verified Bengaluru market prices.** The app says so wherever an estimate is shown.

**Disposal costs.** The table can now hold a negative value for a category that costs money to dispose of: the line then shows as a cost (value × quantity, without the condition or buy-back adjustment). **No current price was changed.** Recommendation, not yet applied: once real data is available, CRT monitors and damaged batteries are likely candidates for a disposal cost instead of a small positive value. That is a business decision for the founder.

---

## Setup

You need **Node.js 24 LTS** and **npm**.

```bash
git clone https://github.com/riyakothavade-star/clearout.git
cd clearout
npm install
cp .env.example .env.local
```

Then edit `.env.local`:

| Variable | Needed? | Purpose |
|---|---|---|
| `AI_PROVIDER` | Optional (default `gemini`) | `gemini` or `claude`. Anything else counts as "not set up". |
| `GEMINI_API_KEY` | If `AI_PROVIDER=gemini` | Google AI Studio key. |
| `ANTHROPIC_API_KEY` | If `AI_PROVIDER=claude` | Claude Console key. |
| `GEMINI_MODEL` | Optional | Override the Gemini model (default `gemini-flash-latest`). |
| `DEMO_MODE` | Recommended for the pitch | `true` shows the clearly labelled sample clear-out. |
| `N8N_QUOTE_URL`, `N8N_SECRET` | Optional | n8n webhook and shared secret. Leave empty to use the built-in rules. |

Only the key for the chosen provider is needed. Without any key, the app still runs: the page says photo analysis isn't set up, and the sample clear-out still works if `DEMO_MODE=true`.

`.env.local` is in `.gitignore` and must never be committed.

### Run, test, build

```bash
npm run dev          # development server at http://localhost:3000
npm run lint         # code style checks
npm run typecheck    # TypeScript checks
npm test             # unit and API tests (AI is mocked; no quota used)
npm run test:e2e     # browser tests: builds the app, runs it on port 3100, uses your installed Google Chrome
npm run build        # production build
```

The end-to-end tests use the installed Google Chrome (`channel: "chrome"`). If Chrome isn't installed, run `npx playwright install chromium` and remove `channel: "chrome"` from `playwright.config.ts`.

---

## Demo mode

Set `DEMO_MODE=true`. The estimate page then shows **"View the sample clear-out"**. It loads a fixed, hand-written sample of a typical office storeroom (laptops, monitors, desktops, a UPS corner) with data flags, battery flags and uncertain items. Its payout is calculated by the same rules as a live result. Every screen that shows it says **"simulated data, not AI analysis"**.

- It makes no AI call and uses no quota. It can be repeated any number of times; "Start over" resets it.
- If a live analysis fails, the error offers the sample as a separate, clearly labelled option. A real upload is never silently swapped for sample results.

See **[DEMO.md](DEMO.md)** for the pitch script and troubleshooting.

---

## AI providers

- **Gemini (tested):** model `gemini-flash-latest` (currently resolves to `gemini-3.8-flash`). JSON output with a schema, thinking level LOW (MINIMAL is rejected by this model), 30 s per attempt, up to 3 attempts on 5xx errors with backoff and jitter, 50 s overall. Quota (429), auth and bad-request errors are never retried.
  - **Measured on the free tier:** 5.8–21 s when Google was healthy. Often timed out, or answered 503 after up to 62 s, when Google was busy. The free tier allows 20 requests per day per model.
- **Claude (written, not yet tested with a real key):** model `claude-sonnet-5-5`, structured output, 25 s per attempt, 1 retry. Add `ANTHROPIC_API_KEY`, set `AI_PROVIDER=claude`, then test before relying on it.

---

## Deploying to Vercel

The Vercel project **`clearout-lcea`** (https://clearout-lcea.vercel.app) is connected to this GitHub repository's `main` branch, so **every push to `main` deploys automatically.** Two older projects created from the command line (`clearout` at clearout-rouge.vercel.app, and `clearout-cvhd`) run copies of the code and are not connected to GitHub; they can be deleted from the Vercel dashboard to avoid confusion.

1. In Vercel, open **clearout-lcea → Settings → Environment Variables**. For **Production**, add `AI_PROVIDER`, the matching key (`GEMINI_API_KEY` or `ANTHROPIC_API_KEY`) and `DEMO_MODE=true`. Add the n8n values only if you use n8n.
2. Environment changes only apply to new deployments: open **Deployments → ⋯ → Redeploy**, or push a commit.
3. To verify, open the site, then `/estimate`, and click "View the sample clear-out". Then try one real photo. `https://clearout-lcea.vercel.app/api/status` should show `{"analysisConfigured":true,"demoEnabled":true}`.
4. **If a deployment fails,** open the failed deployment's build log in Vercel. Run `npm run build` locally to reproduce the error. To roll back, choose an earlier deployment and **Promote to Production**.

---

## Security notes

- AI keys are read only on the server and never sent to the browser. `/api/status` reveals only yes/no flags.
- The server re-checks every photo (1–5, real JPEG, ≤1.5 MB, ≤2048 px), rejects bodies over 4.4 MB and malformed JSON, and validates every quote item.
- Errors return a stable code and a plain message. Provider messages and stack traces go only to the server log, which records codes and timings, never images or keys.
- An n8n answer is used only if it has the right shape and matches the canonical calculation exactly.
- Security headers (no framing, no MIME sniffing, a strict referrer policy, camera/microphone/location blocked, HSTS, a limited CSP).
- **Rate limit:** 6 analyses and 60 quotes per minute per visitor IP. It's in-memory, so on Vercel it is per server instance and best-effort, not strict.
- Uploaded photos are not stored.
- These are baseline protections for a prototype, not a full security review.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Photo analysis isn't set up on this site yet." | Add `AI_PROVIDER` and the matching key (locally in `.env.local`; on Vercel in Environment Variables, then redeploy). |
| "The AI service is busy" or "took too long" | The provider is overloaded. Try again, use fewer photos, or use the sample clear-out. |
| "usage limit is used up" | The free Gemini key's daily limit (20 requests) is spent. Wait for it to reset, use a paid key, or switch to Claude. |
| No "View the sample clear-out" button | Set `DEMO_MODE=true` and restart (or redeploy). |
| iPhone photos rejected | Export as JPEG, or set Camera → Formats → Most Compatible. |
| Preview/dev server can't find Node | Run `source ~/.zprofile` in that terminal, or open a new Terminal window. |

## Known limitations

- **Live analysis depends on the AI provider.** The free Gemini tier is slow and often unavailable; use demo mode for the pitch.
- **Claude hasn't been run with a real key.**
- **Prices are placeholders.**
- **The rate limit is best-effort.**
- **n8n isn't connected.**
- **AI results are estimates:** it can misread model names or miss items, so the UI tells users to check every item.
