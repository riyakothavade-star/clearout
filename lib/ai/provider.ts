import { AppError } from "@/lib/errors";
import { ListingSchema, type Listing } from "@/lib/schema";
import { CATEGORY_IDS } from "@/lib/prices";
import { readPhotosWithClaude } from "./claude";
import { readPhotosWithGemini } from "./gemini";

export type ProviderName = "gemini" | "claude";
export type Env = Record<string, string | undefined>;

const PROVIDERS = {
  gemini: { keyName: "GEMINI_API_KEY", read: readPhotosWithGemini },
  claude: { keyName: "ANTHROPIC_API_KEY", read: readPhotosWithClaude },
} as const;

const PLACEHOLDER_KEYS = new Set(["", "paste-your-key-here"]);

// Which provider is configured on the server, and its key. Never controlled by the browser.
// AI_PROVIDER must be "gemini" or "claude"; unset means "gemini". Anything else counts as not configured.
export function providerConfig(env: Env = process.env): { name: ProviderName; key: string } | null {
  const raw = (env.AI_PROVIDER ?? "gemini").trim().toLowerCase();
  if (raw !== "gemini" && raw !== "claude") return null;
  const key = env[PROVIDERS[raw].keyName]?.trim() ?? "";
  return PLACEHOLDER_KEYS.has(key) ? null : { name: raw, key };
}

// Checks an AI answer strictly. Unknown price categories become "none" ("priced on site");
// anything else that's wrong rejects the whole answer, so a bad reply can't produce a misleading quote.
export function finalizeListing(raw: unknown): Listing {
  const parsed = ListingSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("INVALID_AI_RESPONSE", `schema: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
  }
  return {
    items: parsed.data.items.map((item) => (CATEGORY_IDS.has(item.priceCategoryId) ? item : { ...item, priceCategoryId: "none" })),
    noElectronicsReason: parsed.data.noElectronicsReason,
  };
}

export async function analysePhotos(photos: string[], env: Env = process.env): Promise<{ listing: Listing; provider: ProviderName }> {
  const config = providerConfig(env);
  if (!config) throw new AppError("NOT_CONFIGURED", "no valid AI_PROVIDER and key");
  const raw = await PROVIDERS[config.name].read(photos, config.key);
  return { listing: finalizeListing(raw), provider: config.name };
}
