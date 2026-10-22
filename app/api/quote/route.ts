import { z } from "zod";
import { ItemSchema, QuoteSchema } from "@/lib/schema";
import { computeQuote } from "@/lib/quote";
import prices from "@/data/prices.json";

const QUOTE_FAILED = "Couldn't calculate your quote.";

// POST { items } -> quote. Uses the n8n "quote" workflow when N8N_QUOTE_URL is set,
// otherwise runs the same rules here so the app works before n8n is set up.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = z.object({ items: z.array(ItemSchema) }).safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: QUOTE_FAILED }, { status: 400 });
  }
  const { items } = parsed.data;

  const n8nUrl = process.env.N8N_QUOTE_URL;
  if (!n8nUrl) {
    return Response.json(computeQuote(items, prices));
  }

  try {
    const res = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-clearout-secret": process.env.N8N_SECRET ?? "" },
      body: JSON.stringify({ items, prices }),
      signal: AbortSignal.timeout(15_000),
    });
    const quote = QuoteSchema.safeParse(await res.json());
    if (!res.ok || !quote.success) {
      console.error("n8n quote failed:", res.status, quote.error);
      return Response.json({ error: QUOTE_FAILED }, { status: 502 });
    }
    return Response.json(quote.data);
  } catch (error) {
    console.error("n8n quote error:", error);
    return Response.json({ error: QUOTE_FAILED }, { status: 502 });
  }
}
