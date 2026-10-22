"use client";

import { useState } from "react";
import PhotoUpload from "@/components/PhotoUpload";
import ItemList from "@/components/ItemList";
import PayoutQuote from "@/components/PayoutQuote";
import { resizeImage } from "@/lib/resizeImage";
import type { Item, Quote } from "@/lib/schema";

// Checks the photos before anything is sent. Returns a message to show, or null if they're fine.
function checkFiles(files: File[]): string | null {
  if (files.length === 0) return "Add 1–5 photos of the pile.";
  if (files.length > 5) return `Up to 5 photos, please. Remove ${files.length - 5}.`;
  const notPhoto = files.find((f) => !f.type.startsWith("image/"));
  if (notPhoto) return `"${notPhoto.name}" isn't a photo. Choose JPEG or PNG photos.`;
  return null;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);

  async function loadQuote(forItems: Item[]) {
    setQuoteError(false);
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: forItems }),
    }).catch(() => null);
    if (!res?.ok) {
      setQuoteError(true);
      return;
    }
    setQuote(await res.json());
  }

  async function getQuote() {
    setMessage(null);
    setItems(null);
    setQuote(null);
    setQuoteError(false);
    setSeconds(null);

    const problem = checkFiles(files);
    if (problem) {
      setMessage(problem);
      return;
    }

    // Shrink every photo in the browser; name any photo the browser can't open.
    const photos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        photos.push(await resizeImage(files[i]));
      } catch {
        setMessage(`Photo ${i + 1} couldn't be opened. If it's an iPhone (HEIC) photo, export it as JPEG.`);
        return;
      }
    }

    setBusy(true);
    const started = Date.now();
    try {
      const res = await fetch("/api/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos }),
      }).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (!res?.ok || !data) {
        setMessage(data?.error ?? "Something went wrong reading your photos. Please try again.");
        return;
      }
      if (data.items.length === 0) {
        setMessage(
          `We couldn't spot any electronics: try a clearer photo of the pile.${data.noElectronicsReason ? ` (${data.noElectronicsReason})` : ""}`,
        );
        return;
      }
      setItems(data.items);
      await loadQuote(data.items);
    } finally {
      setSeconds(Math.round((Date.now() - started) / 1000));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">ClearOut</h1>
      <p className="mt-1 text-zinc-600">
        Send photos of your storeroom. See what you have and what we’ll pay. We come, wipe the data and pay you.
      </p>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
        <PhotoUpload
          files={files}
          disabled={busy}
          onChange={(f) => {
            setFiles(f);
            setMessage(null);
          }}
        />
        <button
          onClick={getQuote}
          disabled={busy}
          className="mt-5 rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? "Reading your photos…" : "Get my quote"}
        </button>
        {seconds !== null && !busy && <span className="ml-3 text-sm text-zinc-500">Took {seconds} s</span>}
      </div>

      {message && (
        <div role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900">
          {message}
        </div>
      )}

      {items && (
        <div className="mt-8 space-y-8">
          <ItemList items={items} />
          {quote && <PayoutQuote quote={quote} />}
          {quoteError && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900">
              Couldn’t calculate your quote.{" "}
              <button onClick={() => loadQuote(items)} className="font-semibold underline">
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
