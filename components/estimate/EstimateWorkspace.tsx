"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertIcon, ArrowRightIcon, RefreshIcon, SparkIcon } from "@/components/icons";
import { InventorySummary, InventoryView } from "@/components/inventory/InventoryView";
import { QuoteCard } from "@/components/inventory/QuoteCard";
import { SamplePhoto } from "@/components/SamplePhoto";
import { preparePhoto, type PreparedPhoto } from "@/lib/client/preparePhoto";
import { SAMPLE_PHOTOS } from "@/lib/demo";
import { ERROR_MESSAGES, isErrorCode } from "@/lib/errors";
import { sortForReview } from "@/lib/inventory";
import { MAX_PHOTOS, type Item, type Quote } from "@/lib/schema";
import { ProcessingPanel, type Stage } from "./ProcessingPanel";
import { UploadPanel } from "./UploadPanel";

type Capabilities = { analysisConfigured: boolean; demoEnabled: boolean };
type Source = "ai" | "sample";
type Result = { source: Source; items: Item[]; noElectronicsReason: string };
type Failure = { code: string; message: string };
type QuoteState = { state: "idle" | "loading" | "ok" | "error"; quote?: Quote; message?: string };

const LISTING_TIMEOUT_MS = 65_000; // the server gives up at 60 s
const QUOTE_TIMEOUT_MS = 15_000;
const NETWORK_MESSAGE = "We couldn't reach ClearOut. Check your connection and try again.";

// Reads an API response into data or a safe failure. Never shows raw error text from the network layer.
async function readJson<T>(res: Response): Promise<{ ok: true; data: T } | { ok: false; failure: Failure }> {
  const body = (await res.json().catch(() => null)) as { error?: { code?: unknown; message?: unknown } } | null;
  if (res.ok && body) return { ok: true, data: body as T };
  const code = isErrorCode(body?.error?.code) ? body.error.code : "INTERNAL";
  return { ok: false, failure: { code, message: ERROR_MESSAGES[code] } };
}

function failureFromThrown(error: unknown): Failure {
  if (error instanceof DOMException && error.name === "TimeoutError") return { code: "PROVIDER_TIMEOUT", message: ERROR_MESSAGES.PROVIDER_TIMEOUT };
  return { code: "NETWORK", message: NETWORK_MESSAGE };
}

export function EstimateWorkspace() {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [stage, setStage] = useState<Stage | null>(null);
  const [runSource, setRunSource] = useState<Source>("ai");
  const [seconds, setSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [quote, setQuote] = useState<QuoteState>({ state: "idle" });
  const [announcement, setAnnouncement] = useState("");

  const runId = useRef(0); // bumps on every new run or photo change; stale responses are ignored
  const abort = useRef<AbortController | null>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const busy = stage !== null;

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((c: Capabilities) => setCaps(c))
      .catch(() => setCaps({ analysisConfigured: true, demoEnabled: false }));
  }, []);

  useEffect(() => {
    if (!busy || startedAt === null) return;
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(t);
  }, [busy, startedAt]);

  useEffect(() => {
    if (result && !busy) resultsHeading.current?.focus();
  }, [result, busy]);

  // Any change to the photos makes earlier results stale.
  const invalidate = () => {
    runId.current += 1;
    abort.current?.abort();
    setStage(null);
    setResult(null);
    setFailure(null);
    setQuote({ state: "idle" });
  };

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    invalidate();
    setPreparing((n) => n + files.length);
    const prepared = await Promise.all(files.map(preparePhoto));
    setPreparing((n) => n - files.length);
    setPhotos((p) => [...p, ...prepared]);
  };

  const replaceFile = async (id: string, file: File) => {
    invalidate();
    const prepared = await preparePhoto(file);
    setPhotos((p) => p.map((ph) => (ph.id === id ? prepared : ph)));
  };

  const removePhoto = (id: string) => {
    invalidate();
    setPhotos((p) => p.filter((ph) => ph.id !== id));
  };

  const fetchQuote = useCallback(async (items: Item[], id: number) => {
    setStage("quoting");
    setQuote({ state: "loading" });
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
        signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS),
      });
      const out = await readJson<{ quote: Quote }>(res);
      if (id !== runId.current) return;
      setQuote(out.ok ? { state: "ok", quote: out.data.quote } : { state: "error", message: ERROR_MESSAGES.QUOTE_FAILED });
    } catch {
      if (id !== runId.current) return;
      setQuote({ state: "error", message: ERROR_MESSAGES.QUOTE_FAILED });
    } finally {
      if (id === runId.current) setStage(null);
    }
  }, []);

  const finish = async (source: Source, data: { items: Item[]; noElectronicsReason: string }, id: number) => {
    const items = sortForReview(data.items);
    setResult({ source, items, noElectronicsReason: data.noElectronicsReason });
    if (!items.length) {
      setStage(null);
      setAnnouncement("No electronics were found in the photos.");
      return;
    }
    await fetchQuote(items, id);
    if (id === runId.current) setAnnouncement(`Inventory ready: ${items.length} item groups.`);
  };

  const run = async (source: Source) => {
    if (busy) return; // no overlapping requests
    const id = ++runId.current;
    const controller = new AbortController();
    abort.current = controller;
    setRunSource(source);
    setStartedAt(Date.now());
    setSeconds(0);
    setFailure(null);
    setResult(null);
    setQuote({ state: "idle" });
    setStage("analysing");
    setAnnouncement(source === "sample" ? "Loading the sample clear-out." : "Analysing your photos.");

    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(LISTING_TIMEOUT_MS)]);
      const res =
        source === "sample"
          ? await fetch("/api/demo", { signal })
          : await fetch("/api/listing", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ photos: photos.flatMap((p) => (p.status === "ready" ? [p.base64] : [])) }),
              signal,
            });
      const out = await readJson<{ items: Item[]; noElectronicsReason: string }>(res);
      if (id !== runId.current) return;
      if (!out.ok) {
        setStage(null);
        setFailure(out.failure);
        setAnnouncement(out.failure.message);
        return;
      }
      await finish(source, out.data, id);
    } catch (error) {
      if (id !== runId.current) return;
      setStage(null);
      if (controller.signal.aborted) {
        setAnnouncement("Cancelled.");
        return;
      }
      const f = failureFromThrown(error);
      setFailure(f);
      setAnnouncement(f.message);
    }
  };

  const cancel = () => {
    runId.current += 1;
    abort.current?.abort();
    setStage(null);
    setAnnouncement("Cancelled.");
  };

  const startOver = () => {
    invalidate();
    setPhotos([]);
  };

  const errorCount = photos.filter((p) => p.status === "error").length;
  const tooMany = photos.length > MAX_PHOTOS;
  const setError = tooMany
    ? `Up to ${MAX_PHOTOS} photos can be analysed. Remove ${photos.length - MAX_PHOTOS} to continue.`
    : errorCount
      ? `${errorCount} photo${errorCount > 1 ? "s" : ""} can't be used. Remove or replace ${errorCount > 1 ? "them" : "it"} to continue.`
      : null;
  const notConfigured = caps?.analysisConfigured === false;
  const blockReason = notConfigured
    ? ERROR_MESSAGES.NOT_CONFIGURED
    : !photos.length
      ? "Add at least one photo to start."
      : preparing
        ? "Preparing photos…"
        : setError;
  const canAnalyse = !busy && !blockReason;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-forest-700">Estimate</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Photos in. Inventory and estimate out.</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Upload photos of your retired electronics. You&rsquo;ll get an itemised inventory with data and battery flags,
          and an estimated payout from transparent pricing rules.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section aria-label="Upload photos" className="rounded-[20px] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
          <UploadPanel
            photos={photos}
            preparing={preparing}
            disabled={busy}
            setError={setError}
            onAdd={addFiles}
            onRemove={removePhoto}
            onReplace={replaceFile}
          />
          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => run("ai")}
              disabled={!canAnalyse}
              aria-describedby={blockReason ? "analyse-hint" : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-forest-900 px-5 py-3 font-semibold text-white transition-colors hover:bg-forest-800 disabled:cursor-not-allowed disabled:bg-forest-900/40"
            >
              {busy && runSource === "ai" ? "Analysing…" : "Analyse photos"} <ArrowRightIcon className="h-4 w-4" />
            </button>
            {blockReason && !busy && (
              <p id="analyse-hint" className="text-sm text-muted">
                {blockReason}
              </p>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          {stage ? (
            <ProcessingPanel stage={stage} seconds={seconds} sample={runSource === "sample"} onCancel={cancel} />
          ) : (
            <div className="rounded-[20px] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <h2 className="font-semibold text-ink">What you&rsquo;ll get</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>An itemised list with quantity, condition and the source photo for each item.</li>
                <li>Red flags on anything that may store data, and battery flags.</li>
                <li>Uncertain items listed first so you know what to check.</li>
                <li>An estimated payout. The AI never sets the amount; fixed rules do.</li>
              </ul>
            </div>
          )}
          {caps?.demoEnabled && (
            <div className="rounded-[20px] border border-forest-100 bg-forest-50 p-5">
              <h2 className="flex items-center gap-2 font-semibold text-forest-900">
                <SparkIcon className="h-5 w-5" /> Sample clear-out
              </h2>
              <p className="mt-2 text-sm text-forest-800">
                See the full workflow with simulated data for a typical office storeroom. No photos or AI needed; it is
                not an analysis of your photos.
              </p>
              <button
                type="button"
                onClick={() => run("sample")}
                disabled={busy}
                className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-forest-700 bg-surface px-4 py-2.5 text-sm font-semibold text-forest-900 hover:bg-forest-100 disabled:opacity-50"
              >
                View the sample clear-out
              </button>
            </div>
          )}
        </aside>
      </div>

      {failure && !busy && (
        <div role="alert" className="mt-8 rounded-[20px] border border-danger-200 bg-danger-50 p-5 sm:p-6">
          <p className="flex items-start gap-2 font-semibold text-danger-700">
            <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" /> {failure.message}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {runSource === "ai" && failure.code !== "NOT_CONFIGURED" && failure.code !== "PROVIDER_AUTH" && (
              <button
                type="button"
                onClick={() => run("ai")}
                disabled={!canAnalyse}
                className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
              >
                <RefreshIcon className="h-4 w-4" /> Try again
              </button>
            )}
            {caps?.demoEnabled && runSource === "ai" && (
              <button
                type="button"
                onClick={() => run("sample")}
                className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-forest-700 bg-surface px-4 py-2.5 text-sm font-semibold text-forest-900 hover:bg-forest-50"
              >
                View the sample clear-out instead
              </button>
            )}
          </div>
          {caps?.demoEnabled && runSource === "ai" && (
            <p className="mt-3 text-xs text-danger-700">The sample uses simulated data. It is not an analysis of your photos.</p>
          )}
        </div>
      )}

      {result && (
        <section aria-labelledby="results-heading" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${result.source === "sample" ? "bg-lime-300 text-forest-950" : "bg-forest-100 text-forest-900"}`}>
                {result.source === "sample" ? "Sample clear-out · simulated data, not AI analysis" : "AI-assisted analysis of your photos"}
              </p>
              <h2 id="results-heading" ref={resultsHeading} tabIndex={-1} className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                {result.items.length ? "Your inventory" : "No electronics found"}
              </h2>
            </div>
            <button
              type="button"
              onClick={startOver}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-sunken disabled:opacity-50"
            >
              <RefreshIcon className="h-4 w-4" /> Start over
            </button>
          </div>

          {result.source === "sample" && (
            <div className="mt-4 grid max-w-xl grid-cols-3 gap-2">
              {SAMPLE_PHOTOS.map((p) => (
                <SamplePhoto key={p.number} number={p.number} label={p.label} />
              ))}
            </div>
          )}

          {result.items.length === 0 ? (
            <div className="mt-5 rounded-[20px] border border-line bg-surface p-6">
              <p className="font-medium text-ink">We couldn&rsquo;t spot any electronics in these photos.</p>
              {result.noElectronicsReason && <p className="mt-1 text-sm text-muted">AI note: {result.noElectronicsReason}</p>}
              <p className="mt-3 text-sm text-muted">Try a clearer, well-lit photo of the pile, taken from a little further back.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="min-w-0 space-y-4">
                <InventorySummary items={result.items} />
                <p className="flex items-start gap-2 rounded-[var(--radius-control)] border border-attention-200 bg-attention-50 px-3 py-2.5 text-sm text-attention-800">
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  {result.source === "sample"
                    ? "Simulated sample. In a live analysis, these flags come from photos only and every device is checked physically."
                    : "AI read your photos: check this list against them. Flags come from photos only; physical inspection is still needed."}
                </p>
                <InventoryView items={result.items} />
              </div>
              <div className="order-first lg:order-none lg:sticky lg:top-24 lg:self-start">
                {quote.state === "ok" && quote.quote ? (
                  <QuoteCard quote={quote.quote} sample={result.source === "sample"} />
                ) : quote.state === "error" ? (
                  <div role="alert" className="rounded-[var(--radius-card)] border border-danger-200 bg-danger-50 p-5">
                    <p className="font-semibold text-danger-700">{quote.message}</p>
                    <p className="mt-1 text-sm text-danger-700">Your inventory is kept. You can retry the estimate.</p>
                    <button
                      type="button"
                      onClick={() => fetchQuote(result.items, runId.current)}
                      disabled={busy}
                      className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
                    >
                      <RefreshIcon className="h-4 w-4" /> Retry estimate
                    </button>
                  </div>
                ) : (
                  <div className="h-64 animate-pulse rounded-[var(--radius-card)] border border-line bg-sunken" aria-label="Calculating estimate" />
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
