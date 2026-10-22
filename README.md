# ClearOut

**Photos of your storeroom in, a payout quote out.** A company sends 1–5 photos of its retired office electronics. ClearOut lists what's there, flags anything that stores data or contains a battery, and shows what ClearOut will pay. A ClearOut employee then visits, wipes the data and pays the company. Finding resale buyers is ClearOut's own backend job, so the company never deals with recyclers.

This is a hackathon MVP. It proves the first moment of that journey: photos → flagged item list → payout quote.

---

## Job to be done

> **When** our office has a storeroom full of retired laptops, monitors and batteries, **I want to** send a few photos and have someone come, wipe the data and pay us for the lot, **so I can** clear the room in one visit and get money plus audit-ready proof that the data was wiped.

**User:** the facilities or procurement manager at a 50–500-person IT/tech company in Bengaluru.

## The 3 tests the MVP must pass

1. **Photos → flagged list in about 30 s.** I upload 3 photos of a storeroom pile and, within about 30 seconds, see an itemised list with type, quantity and condition. Data devices get 🔴, batteries get 🔋, and low-confidence items are listed first.
2. **Payout quote.** On the same screen, in the same ~30 s, I see what ClearOut will pay per item, minus the wiping and pickup fee, as a total range. It's marked "Final amount confirmed on site".
3. **Bad input.** No photos, too many photos, a file that isn't a photo, a photo that can't be opened, or a photo with no electronics: each gets a clear message saying what to fix. No crash, no blank screen and no made-up items.

**Current status:**
- **Test 3:** the four browser-side checks pass.
- **Tests 1 and 2:** the results are correct, but on the Gemini free tier they took 41–49 s. The free tier is also limited to 20 requests a day.
- **Next:** Gemini thinking is now set to minimal, and the demo is planned on Claude. Both still need re-timing.

---

## Current workflow → future workflow

**Today:** a clear-out runs on calls, site visits and chasing, with no single tool.

1. Retired devices pile up in a storeroom, sometimes for months.
2. Someone lists the items by hand.
3. Facilities hunts for a registered recycler through calls, searches and referrals.
4. Recyclers visit to inspect, or turn down small loads.
5. The price is negotiated without knowing what the items are worth.
6. IT wipes drives in-house, or pays for destruction.
7. A vendor collects the lot.
8. Facilities chases and files a certificate of destruction for auditors.

**With ClearOut:** the company deals with one service.

1. Facilities uploads 3–5 photos. **← this MVP**
2. AI lists the items, flags data devices and batteries, and the price rules show a payout quote. **← this MVP**
3. The company books a visit. *(next)*
4. A ClearOut employee confirms the items on site, wipes each device and logs proof per serial number. *(next)*
5. ClearOut pays the company once every device has wipe proof. *(next)*
6. The company gets a closure pack: the item list, wipe proof per device and the payout record. *(next)*
7. ClearOut resells or recycles through its own verified vendors. *(backend, out of scope)*

Gone for the company: listing items by hand, hunting for recyclers, quote visits, blind negotiation, in-house wiping and chasing paperwork.

---

## Architecture: Input → AI → Logic → Action → Output

```
 INPUT (browser)            AI                       LOGIC (rules, no AI)          ACTION             OUTPUT (one screen)
 ───────────────            ──                       ────────────────────          ──────             ───────────────────
 1–5 photos           ──▶  /api/listing         ──▶  /api/quote               ──▶  none in the   ──▶  flagged item list
 checked + shrunk          Gemini Flash (testing)    n8n "quote" workflow           MVP: nothing      + payout quote
 to ≤1568 px JPEG          or Claude (demo)          or the same rules in           is booked,        or a clear error
                           → item list as JSON       lib/quote.ts                   paid or sent      message
```

| Layer | Where | What it does |
|---|---|---|
| **Input** | `app/page.tsx`, `components/PhotoUpload.tsx`, `lib/resizeImage.ts` | Refuses 0 or more than 5 photos, non-images and files that can't be opened, before anything is sent. Shrinks photos so uploads stay small. |
| **AI** | `app/api/listing/route.ts`, `lib/ai/gemini.ts`, `lib/ai/claude.ts`, `lib/prompt.ts` | One AI call per request. It returns each item's type, quantity, condition, price category, data/battery flags, source photo, confidence and a note. The answer must match a fixed JSON shape (`lib/schema.ts`), which is checked again in code. |
| **Logic** | `app/api/quote/route.ts` → n8n (`n8n/quote.json`) or `lib/quote.ts` | Payout per item = resale ₹ for that category × condition multiplier × buy-back % × quantity. The total is the sum minus the fee. Unknown categories become "priced on site". |
| **Action** | — | None in the MVP. Booking, the on-site wipe and payment are next. |
| **Output** | `components/ItemList.tsx`, `components/PayoutQuote.tsx` | The item list with low-confidence items first, the photo source, the AI's chosen price category and notes, then the quote. |

Prices, the buy-back % and the fee live in `data/prices.json`. **The ₹ values there are placeholders until they're replaced with real Bengaluru resale prices.**

---

## Where AI is used, and why

There is one AI call, and it does the only work that needs judgment:

| Task | Why AI and not a rule |
|---|---|
| Identify the items in a messy pile | Mixed brands, angles, cables and half-hidden devices. No rule turns pixels into "4 CRT monitors, 3 desktops". |
| Judge condition (good / fair / poor / scrap) | Cracks, rust and missing parts need visual judgment; there's nothing to measure against a threshold. |
| Match each item to a price category | "Commodore PC 20-II" has to map to "Desktop tower". A text rule would miss most variations. |
| Flag data storage and batteries | Only the image shows whether a printer may hold a drive or a box contains batteries. |
| Avoid double-counting across photos | It means recognising the same object from another angle. |

**The AI never sets an amount of money.** It picks a price category and a condition, and fixed rules turn those into ₹.

## What stays human

- **Taking and choosing the photos,** and retaking them when something is marked "Please check".
- **Checking the list against the photos.** Each row shows which photo it came from, and a banner asks the user to check.
- **Deciding whether the quote is worth booking a visit for.**
- **The final amount,** which a ClearOut employee confirms on site, not the AI.
- **Setting prices, the buy-back % and the fee** in `data/prices.json`. The AI never changes them.

## Why these tools

| Tool | Why |
|---|---|
| **Next.js** | One app holds both the screen and the small server routes that keep API keys out of the browser. It deploys to Vercel on every push. |
| **Claude API** (planned for the demo) / **Gemini Flash** (testing) | A vision model is needed to read the photos. Gemini Flash is used while testing; switch with `AI_PROVIDER` in `.env.local`, no code changes. |
| **Structured JSON output + zod** | The AI must answer in a fixed shape, and the app checks it again, so a malformed answer becomes a clear error instead of a broken page. |
| **n8n** | Keeps the money rules outside the app, where they're visible and easy to change. The same rules also run in `lib/quote.ts`, so the app works before n8n is connected. |

## Failure cases, and what the user sees

| Failure | What happens |
|---|---|
| No photos, more than 5, a non-image file, a photo that can't be opened (e.g. HEIC in Chrome) | An instant message saying what to fix. Nothing is sent to the AI. |
| Photo with no electronics | "We couldn't spot any electronics: try a clearer photo of the pile", plus the AI's reason. |
| Blurry or partial photo | Items come back as low confidence, listed first with "Please check" and the AI's note. |
| AI miscounts, misnames or picks the wrong category | Every row shows its source photo and the chosen category, so mistakes are visible. Unknown categories become "Priced on site" and are left out of the total. |
| AI busy (503) | Automatic retry, up to 3 tries. If all fail: "Something went wrong reading your photos. Please try again." |
| AI usage limit reached (429) | "The Gemini API's usage limit is used up for now. Please try again later." |
| AI slow | Everything must finish within 55 s, or the user gets the "please try again" message. |
| Quote service (n8n) down | The item list still shows; the quote area says "Couldn't calculate your quote" with a Retry button. |
| The fee is bigger than the low estimate | The headline shows "We'll pay you up to ₹X", never "₹0". If even the high estimate doesn't cover the fee, it says so plainly. |

**Known limits:**
- **Gemini free tier:** 20 requests a day, and turned away first when Google is busy.
- **Narrow screens:** the item table needs horizontal scrolling.
- **Prices:** the ₹ values are placeholders.

---

## Run it locally

You need [Node.js](https://nodejs.org) 24 LTS.

```bash
git clone https://github.com/riyakothavade-star/clearout.git
cd clearout
npm install
cp .env.example .env.local
```

Open `.env.local` and fill it in:

```
AI_PROVIDER=gemini            # or claude
GEMINI_API_KEY=...            # from Google AI Studio (when AI_PROVIDER=gemini)
ANTHROPIC_API_KEY=...         # from the Claude Console (when AI_PROVIDER=claude)
N8N_QUOTE_URL=                # optional; leave empty to run the price rules in the app
N8N_SECRET=
```

Then start the app and open http://localhost:3000:

```bash
npm run dev
```

`.env.local` is in `.gitignore`, so your keys are never committed.

### Connecting n8n (optional)

1. In n8n, import `n8n/quote.json`.
2. On the Webhook node, add a **Header Auth** credential: name `x-clearout-secret`, value any long password.
3. Activate the workflow.
4. In `.env.local`, set `N8N_QUOTE_URL` to the workflow's production URL and `N8N_SECRET` to the same password.
