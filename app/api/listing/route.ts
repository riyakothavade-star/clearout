import { readPhotosWithClaude } from "@/lib/ai/claude";
import { readPhotosWithGemini } from "@/lib/ai/gemini";
import prices from "@/data/prices.json";

export const maxDuration = 60;

const TRY_AGAIN = "Something went wrong reading your photos. Please try again.";

// Which AI reads the photos: AI_PROVIDER=gemini (default while testing) or AI_PROVIDER=claude.
const PROVIDERS = {
  gemini: { keyName: "GEMINI_API_KEY", label: "Gemini", read: readPhotosWithGemini },
  claude: { keyName: "ANTHROPIC_API_KEY", label: "Claude", read: readPhotosWithClaude },
};

// POST { photos: string[] } (base64 JPEGs) -> { items, noElectronicsReason } or { error }
export async function POST(request: Request) {
  const provider = process.env.AI_PROVIDER === "claude" ? PROVIDERS.claude : PROVIDERS.gemini;
  const key = process.env[provider.keyName];
  if (!key || key === "paste-your-key-here") {
    return Response.json(
      { error: `The ${provider.label} API key isn't set yet. Paste it into .env.local, then restart the app.` },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const photos: unknown = body?.photos;
  if (!Array.isArray(photos) || photos.length < 1 || photos.length > 5) {
    return Response.json({ error: "Add 1–5 photos of the pile." }, { status: 400 });
  }

  try {
    const listing = await provider.read(photos.map(String), key);

    // Never trust a category id we don't have: unknown ids become "none" ("priced on site").
    const knownIds = new Set(prices.categories.map((c) => c.id));
    const items = listing.items.map((item) =>
      knownIds.has(item.priceCategoryId) ? item : { ...item, priceCategoryId: "none" },
    );

    return Response.json({ items, noElectronicsReason: listing.noElectronicsReason });
  } catch (error) {
    console.error(`${provider.label} listing failed:`, error);
    // 429 = the API key's usage limit is used up. Retrying won't help, so say so plainly.
    if ((error as { status?: number }).status === 429) {
      return Response.json(
        { error: `The ${provider.label} API's usage limit is used up for now. Please try again later.` },
        { status: 429 },
      );
    }
    return Response.json({ error: TRY_AGAIN }, { status: 502 });
  }
}
