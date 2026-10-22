import type { Quote } from "@/lib/schema";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const range = (low: number, high: number) => (low === high ? rupees(low) : `${rupees(low)}–${rupees(high)}`);

// The headline. Never promises "₹0": when the fee eats the low end, show "up to" the high end instead.
function headline(quote: Quote) {
  if (quote.totalLow > 0) return `We’ll pay you ${range(quote.totalLow, quote.totalHigh)}`;
  if (quote.totalHigh > 0) return `We’ll pay you up to ${rupees(quote.totalHigh)}`;
  return `This lot’s estimated value doesn’t cover our ${rupees(quote.fee)} fee`;
}

// What ClearOut will pay. Every amount here comes from the rules in prices.json, never from the AI.
export default function PayoutQuote({ quote }: { quote: Quote }) {
  return (
    <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
      <h2 className="text-lg font-semibold text-emerald-900">Your payout quote</h2>
      <p className="mt-1 text-3xl font-bold text-emerald-900">{headline(quote)}</p>
      {quote.totalLow === 0 && quote.totalHigh > 0 && (
        <p className="mt-1 text-sm text-emerald-900">
          At the low end of our estimate, the items’ value wouldn’t cover the {rupees(quote.fee)} wiping and pickup
          fee.
        </p>
      )}
      <p className="mt-1 text-sm text-emerald-900">Estimate from photos. Final amount confirmed on site.</p>

      <table className="mt-4 w-full text-left text-sm">
        <tbody>
          {quote.lines.map((line) => (
            <tr key={line.index} className="border-b border-emerald-200">
              <td className="py-1.5 pr-3">
                {line.quantity} × {line.type} <span className="text-emerald-800">({line.condition})</span>
              </td>
              <td className="py-1.5 text-right whitespace-nowrap">
                {line.pricedOnSite ? "Priced on site" : range(line.low, line.high)}
              </td>
            </tr>
          ))}
          <tr className="border-b border-emerald-200">
            <td className="py-1.5 pr-3">Wiping and pickup fee</td>
            <td className="py-1.5 text-right">−{rupees(quote.fee)}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-3 text-xs text-emerald-900">
        We pay {quote.buybackPercent}% of each item’s resale value, adjusted for condition.
        {quote.pricedOnSiteCount > 0 &&
          ` ${quote.pricedOnSiteCount} item${quote.pricedOnSiteCount > 1 ? "s" : ""} will be priced on site and ${quote.pricedOnSiteCount > 1 ? "aren't" : "isn't"} in this total.`}
      </p>
    </section>
  );
}
