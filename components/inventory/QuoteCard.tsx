import { rupeeRange, rupees } from "@/lib/format";
import { quoteHeadline } from "@/lib/quote";
import type { Quote } from "@/lib/schema";

export const ESTIMATE_NOTICE = "Estimate based on submitted photos. Final amount confirmed on site.";

function Headline({ quote }: { quote: Quote }) {
  const h = quoteHeadline(quote);
  if (h.kind === "range") {
    return (
      <>
        <p className="text-sm font-medium text-forest-100">Estimated payout</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl" data-testid="quote-headline">
          {rupeeRange(h.low, h.high)}
        </p>
      </>
    );
  }
  if (h.kind === "upTo") {
    return (
      <>
        <p className="text-sm font-medium text-forest-100">Estimated payout</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl" data-testid="quote-headline">
          Up to {rupees(h.high)}
        </p>
        <p className="mt-2 text-sm text-forest-100">
          At the low end of the estimate, the items&rsquo; value would not cover the {rupees(quote.fee)} wiping and pickup fee.
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-sm font-medium text-forest-100">Estimated payout</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-white" data-testid="quote-headline">
        This lot&rsquo;s estimated value doesn&rsquo;t cover the {rupees(h.fee)} fee
      </p>
      <p className="mt-2 text-sm text-forest-100">No payout is estimated. An on-site check could still change this.</p>
    </>
  );
}

export function QuoteCard({ quote, sample = false }: { quote: Quote; sample?: boolean }) {
  return (
    <section aria-label="Payout estimate" className="overflow-hidden rounded-[var(--radius-card)] border border-forest-800 bg-surface shadow-[var(--shadow-card)]">
      <div className="on-dark bg-forest-900 px-5 py-5">
        {sample && (
          <p className="mb-3 inline-block rounded-full bg-lime-300 px-2.5 py-0.5 text-xs font-semibold text-forest-950">
            Sample estimate · simulated data
          </p>
        )}
        <Headline quote={quote} />
        <p className="mt-3 text-sm font-medium text-lime-200">{ESTIMATE_NOTICE}</p>
      </div>

      <div className="px-5 py-4">
        <table className="w-full text-sm">
          <caption className="sr-only">How the estimate is made up</caption>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.index} className="border-b border-line last:border-b-0">
                <td className="py-2 pr-3 text-ink">
                  {line.quantity} × {line.type} <span className="text-muted">({line.condition})</span>
                </td>
                <td className="py-2 text-right whitespace-nowrap tabular-nums">
                  {line.pricedOnSite ? (
                    <span className="text-attention-800">Priced on site</span>
                  ) : line.disposalCost ? (
                    <span className="text-danger-700">{rupeeRange(line.low, line.high)} cost</span>
                  ) : (
                    rupeeRange(line.low, line.high)
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-line">
              <td className="py-2 pr-3 font-medium">Wiping and pickup fee</td>
              <td className="py-2 text-right font-medium tabular-nums">−{rupees(quote.fee)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 space-y-1.5 rounded-[var(--radius-control)] bg-sunken/70 px-3 py-2.5 text-xs leading-relaxed text-muted">
          <p>
            Rule: resale value for the category × condition × {quote.buybackPercent}% buy-back share × quantity, minus the
            fee. The AI only suggests the category and condition; it never sets an amount.
          </p>
          {quote.pricedOnSiteCount > 0 && (
            <p>
              {quote.pricedOnSiteCount} item group{quote.pricedOnSiteCount > 1 ? "s are" : " is"} priced on site and not
              included in this total.
            </p>
          )}
          <p>Category prices are illustrative assumptions until verified against real Bengaluru resale data.</p>
        </div>
      </div>
    </section>
  );
}
