import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SamplePhoto } from "@/components/SamplePhoto";
import { InventorySummary, InventoryView } from "@/components/inventory/InventoryView";
import { QuoteCard } from "@/components/inventory/QuoteCard";
import { BatteryBadge, ConfidenceBadge, DataBadge } from "@/components/inventory/Badges";
import {
  AlertIcon,
  ArrowRightIcon,
  ClipboardIcon,
  ClockIcon,
  DataIcon,
  SearchIcon,
  ShieldIcon,
  TruckIcon,
  UploadIcon,
  WalletIcon,
} from "@/components/icons";
import { SAMPLE_LISTING, SAMPLE_PHOTOS } from "@/lib/demo";
import { rupeeRange } from "@/lib/format";
import { sortForReview } from "@/lib/inventory";
import { PRICES } from "@/lib/prices";
import { computeQuote, quoteHeadline } from "@/lib/quote";

// The landing page. Every sample number on it comes from the same sample data and price engine as the
// working estimate tool, so the preview can never disagree with the product.
const sampleItems = sortForReview(SAMPLE_LISTING.items);
const sampleQuote = computeQuote(sampleItems, PRICES);
const sampleHeadline = quoteHeadline(sampleQuote);
const sampleLabel = (n: number) => `Photo ${n}`;

const PAINS = [
  { icon: ClockIcon, title: "It piles up", text: "Retired laptops, monitors and batteries sit in storerooms for months because clearing them is nobody's main job." },
  { icon: ClipboardIcon, title: "Someone lists it by hand", text: "Before anyone will quote, a person has to count and describe every device." },
  { icon: WalletIcon, title: "Nobody knows what it's worth", text: "Without a reference price, teams negotiate blind or accept the first offer." },
  { icon: DataIcon, title: "Data risk", text: "Laptops, drives and some printers can still hold company data when they leave the building." },
  { icon: TruckIcon, title: "Vendors and paperwork", text: "Calls, site visits and chasing a certificate of destruction for the auditors take days." },
];

const STEPS = [
  { title: "Upload photos", text: "Send 1–5 photos of the pile from your phone or laptop.", live: "AI-assisted" },
  { title: "Review the inventory and estimate", text: "AI lists what it can see and flags data and batteries; fixed rules estimate the payout.", live: "Automatic" },
  { title: "Book an inspection visit", text: "Request a visit and follow every step through a private tracking link.", live: "Request and tracking" },
  { title: "Data wiping and collection", text: "Technicians confirm each item and record wipe or destruction evidence for every data-bearing unit.", live: "Recorded by the team" },
  { title: "Payment and documentation", text: "The payout is recorded and a closure pack lists every device and its evidence.", live: "Payment simulated" },
];

const HANDLED = [
  "Laptops", "Desktop PCs", "Monitors", "Servers", "Phones and tablets", "Printers and copiers",
  "Routers and switches", "UPS units and batteries", "Loose hard drives and SSDs", "Projectors", "Keyboards and peripherals", "Cables and chargers",
];

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wider text-forest-700">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-lg leading-relaxed text-muted">{text}</p>}
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <div className="rounded-[20px] border border-line bg-surface p-4 shadow-[var(--shadow-raised)] sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Sample clear-out</p>
          <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs font-medium text-muted">Illustrative sample data</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {SAMPLE_PHOTOS.map((p) => (
            <SamplePhoto key={p.number} number={p.number} label={p.label} />
          ))}
        </div>
        <ul className="mt-4 divide-y divide-line rounded-[var(--radius-control)] border border-line">
          {sampleItems.slice(0, 4).map((item) => (
            <li key={item.type} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <span className="min-w-0 text-sm font-medium text-ink">
                {item.quantity} × {item.type}
              </span>
              <span className="flex flex-wrap gap-1">
                {item.confidence === "low" && <ConfidenceBadge confidence="low" />}
                <DataBadge storesData={item.storesData} />
                <BatteryBadge hasBattery={item.hasBattery} />
              </span>
            </li>
          ))}
        </ul>
        <div className="on-dark mt-4 rounded-[var(--radius-control)] bg-forest-900 px-4 py-3.5">
          <p className="text-xs font-medium text-forest-100">Estimated payout</p>
          <p className="text-2xl font-semibold tracking-tight text-white">
            {sampleHeadline.kind === "range" ? rupeeRange(sampleHeadline.low, sampleHeadline.high) : "See estimate"}
          </p>
          <p className="mt-1 text-xs text-lime-200">Estimate based on submitted photos. Final amount confirmed on site.</p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-forest-100 bg-forest-50 px-3 py-1 text-sm font-medium text-forest-800">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-700" aria-hidden="true" />
              For IT and tech companies in Bengaluru
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.5rem]">
              Retired office tech. <span className="text-forest-700">One clear way out.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Turn your company&rsquo;s old electronics into an organised inventory and an estimated payout. ClearOut brings
              the clear-out process together, from assessment to a planned path for secure data handling and responsible
              recycling.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/estimate"
                className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-forest-900 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-forest-800"
              >
                Get my estimate <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-[var(--radius-control)] border border-line-strong bg-surface px-6 py-3.5 text-base font-semibold text-ink transition-colors hover:bg-sunken"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted">One clear-out. One accountable service.</p>
          </div>
          <HeroVisual />
        </section>

        {/* Problem and solution */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionHeading
                eyebrow="The problem"
                title="Clearing old electronics takes days it shouldn't."
                text="Facilities and procurement teams own the job, but the work is scattered across spreadsheets, vendor calls and audit follow-ups."
              />
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {PAINS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-[var(--radius-card)] border border-line bg-canvas p-5">
                  <Icon className="h-6 w-6 text-forest-700" />
                  <h3 className="mt-4 font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-12 rounded-[var(--radius-card)] bg-forest-50 p-6 sm:p-8">
              <p className="text-xl font-semibold leading-snug text-forest-900 sm:text-2xl">
                ClearOut proposes one accountable service in place of all of that: the company deals with ClearOut, and
                ClearOut handles the inspection, data handling, resale and recycling relationships behind the scenes.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="How it works" title="From photos to a planned clear-out." />
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-forest-900 px-3 py-1 font-medium text-white">
              <span className="h-2 w-2 rounded-full bg-lime-300" aria-hidden="true" /> Every step can be demonstrated in this prototype
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 font-medium text-muted">
              Physical visits, wiping and payments are not yet offered as a live service
            </span>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className={`relative rounded-[var(--radius-card)] border p-5 ${i < 2 ? "border-forest-800 bg-forest-900 text-white" : "border-line bg-surface"}`}>
                <span className={`text-sm font-semibold ${i < 2 ? "text-lime-300" : "text-forest-700"}`}>Step {i + 1}</span>
                <h3 className={`mt-2 font-semibold ${i < 2 ? "text-white" : "text-ink"}`}>{step.title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${i < 2 ? "text-forest-100" : "text-muted"}`}>{step.text}</p>
                <p className={`mt-4 text-xs font-semibold ${i < 2 ? "text-lime-200" : "text-forest-700"}`}>{step.live}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* What we handle */}
        <section id="what-we-handle" className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
            <SectionHeading
                eyebrow="What we handle"
                title="The usual contents of an office storeroom."
                text="The estimate tool recognises these categories today. Anything it can't match is marked for pricing on site instead of being guessed."
              />
            <ul className="grid grid-cols-2 gap-3 self-center sm:grid-cols-3">
              {HANDLED.map((h) => (
                <li key={h} className="rounded-[var(--radius-control)] border border-line bg-canvas px-4 py-3 text-sm font-medium text-ink">
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Product preview */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
              eyebrow="Product preview"
              title="An inventory you can check, and an estimate you can follow."
              text="This is the real estimate workspace showing the sample clear-out. Uncertain items come first, every flag is labelled, and the payout rule is shown in full."
            />
          <div className="mt-10 overflow-hidden rounded-[20px] border border-line bg-canvas shadow-[var(--shadow-raised)]">
            <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="ml-3 text-xs font-medium text-muted">ClearOut estimate · Illustrative sample data</span>
            </div>
            <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="min-w-0 space-y-4">
                <InventorySummary items={sampleItems} />
                <InventoryView items={sampleItems} photoLabel={sampleLabel} />
              </div>
              <div>
                <QuoteCard quote={sampleQuote} sample />
              </div>
            </div>
          </div>
        </section>

        {/* Data security */}
        <section id="data-security" className="on-dark bg-forest-950 text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-lime-300">Data security</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Data-bearing devices get special attention.</h2>
              <p className="mt-4 text-lg leading-relaxed text-forest-100">
                The estimate tool is built to surface risk, not hide it. The data handling itself is a proposed service step
                carried out by people on site.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: DataIcon, title: "Flagged from the start", text: "Anything that stores data, or might, is flagged in red with a label, not colour alone." },
                { icon: AlertIcon, title: "Uncertainty shown first", text: "Items the AI isn't sure about are listed first and marked for human review." },
                { icon: SearchIcon, title: "Photos are not proof", text: "Flags come from photos only. The proposed service checks every device physically." },
                { icon: ShieldIcon, title: "Device-level evidence", text: "Each data-bearing unit gets its own wipe or destruction record, and payment stays locked until every one is recorded." },
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-[var(--radius-card)] border border-white/10 bg-white/5 p-5">
                  <Icon className="h-6 w-6 text-lime-300" />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-forest-100">{text}</p>
                </li>
              ))}
            </ul>
            <p className="text-sm text-forest-100/80 lg:col-span-2">
              The prototype records the evidence technicians enter for each device; it does not wipe devices itself, and its closure pack is not a legally certified certificate. Uploaded photos are never stored.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 rounded-[20px] border border-line bg-surface p-8 shadow-[var(--shadow-card)] sm:p-10 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">See what your storeroom adds up to.</h2>
              <p className="mt-2 text-muted">Upload a few photos and get an itemised inventory with an estimated payout.</p>
            </div>
            <Link
              href="/estimate"
              className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-control)] bg-forest-900 px-6 py-3.5 font-semibold text-white transition-colors hover:bg-forest-800"
            >
              <UploadIcon className="h-5 w-5" /> Get my estimate
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
