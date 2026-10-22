# ClearOut hackathon demo

A 90–120 second demo that works without any live AI. Rehearse it on the deployed site you will present from.

## Before you present (5 minutes)

1. **Open the site.** Open the live site in a fresh browser window, at 100% zoom: https://clearout-lcea.vercel.app (or `http://localhost:3000` with `npm run dev`).
2. **Check demo mode is on.** `/api/status` should show `"demoEnabled":true`. If not, add `DEMO_MODE=true` in Vercel and redeploy.
3. **Rehearse.** Go to `/estimate`, click **View the sample clear-out**, check the estimate shows **₹18,192–₹44,448**, then click **Start over**.
4. **Live attempt (optional).** If you plan one, keep 2–3 well-lit storeroom photos (JPEG) on the laptop. Run one test analysis first: the free Gemini key allows only 20 requests a day.
5. **Prepare the team console.** Sign in to `/ops` in a second tab. Run one demo job to **closed** beforehand so you can show a finished closure pack without entering 13 wipe records live.
6. **Close distractions.** Close other tabs and turn off notifications.

## Script

| # | Say / do | Time |
|---|---|---|
| 1 | "Every growing tech company has a storeroom of old laptops and monitors, and clearing it takes days of calls, guesswork on price and chasing proof that the data was wiped." | 10 s |
| 2 | Show the landing page hero: "ClearOut turns that into one clear-out with one accountable service." | 8 s |
| 3 | Scroll to **How it works**: "Every step runs in this prototype, from estimate to closure pack. The visit, wiping and payment are recorded by our team; real payments aren't live yet." | 10 s |
| 4 | Click **Get an estimate**. | 3 s |
| 5 | Click **View the sample clear-out**. Say: "This is a simulated sample of a typical storeroom, so the demo doesn't depend on a live AI." (If live AI is healthy, upload your photos instead and say it is a live analysis.) | 8 s |
| 6 | Point to the inventory summary: 9 item groups, 54 units. | 5 s |
| 7 | Point to a red **Stores data** flag ("the desktops can hold company data, so they get special attention") and a **Battery** flag (UPS batteries). | 10 s |
| 8 | Point to **Please check**: "Anything the AI isn't sure about comes first, with its note, so a person reviews it." | 8 s |
| 9 | Point to the estimate **₹18,192–₹44,448** and the rule underneath: "The AI only suggests category and condition. Fixed rules set the money: resale value, condition, a 40% buy-back share, minus the fee." | 12 s |
| 10 | "It's an estimate from photos. The final amount is confirmed on site." | 5 s |
| 11 | Click **Request visit**, fill in the form and submit. Show the private tracking page: "the company follows every step here." | 15 s |
| 12 | Open `/ops` in a second tab (already signed in). Show the request, schedule it, confirm items: "one wipe record per data-bearing unit, and payment stays locked until every unit has evidence." | 20 s |
| 13 | (If time) Show a pre-closed job's **closure pack**: every device, serial, method and evidence, the payment record and the history. | 10 s |

## If something goes wrong

| Problem | What to do |
|---|---|
| A live analysis shows "busy", "took too long" or "usage limit" | Say "the live AI is busy, so here's the labelled sample", and click **View the sample clear-out instead**. |
| "Requests can't be saved on this site yet" | The Blob store isn't connected on that deployment. Use `localhost:3000`, where jobs are saved locally. |
| No sample button | Demo mode is off on that deployment. Switch to `localhost:3000` with `DEMO_MODE=true`, or show the landing page's product preview (same data and numbers). |
| Site won't load | Use the local copy (`npm run dev`) or the second tab you opened before presenting. |
| Estimate shows "Couldn't calculate your estimate" | Click **Retry estimate**. The inventory stays. |
| Asked "are these real prices?" | "No. They're illustrative assumptions that we'll replace with verified Bengaluru resale prices. The rules are transparent and configurable." |
| Asked "does the app wipe devices?" | "No. The app does the assessment. Wiping is done by people on site as part of the proposed service." |

Never present the sample as a live analysis of real photos.
