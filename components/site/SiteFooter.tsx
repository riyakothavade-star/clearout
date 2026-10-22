import Link from "next/link";
import { Logo } from "@/components/Logo";

export function SiteFooter() {
  return (
    <footer className="on-dark bg-forest-950 text-forest-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-forest-100/80">
            A proposed managed clear-out service for retired office electronics at technology companies in Bengaluru.
          </p>
        </div>
        <nav aria-label="Footer" className="text-sm">
          <p className="font-semibold text-white">Product</p>
          <ul className="mt-3 space-y-2">
            <li><Link className="hover:text-white" href="/#how-it-works">How it works</Link></li>
            <li><Link className="hover:text-white" href="/#what-we-handle">What we handle</Link></li>
            <li><Link className="hover:text-white" href="/#data-security">Data security</Link></li>
            <li><Link className="hover:text-white" href="/estimate">Get an estimate</Link></li>
            <li><Link className="hover:text-white" href="/ops">Team console</Link></li>
          </ul>
        </nav>
        <div className="text-sm">
          <p className="font-semibold text-white">Status</p>
          <p className="mt-3 leading-relaxed text-forest-100/80">
            Hackathon prototype. The full journey (estimate, visit request, inspection, wipe records, payment record and closure pack) works in software; physical visits and real payments are not yet offered. Prices are illustrative, not verified market rates.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-forest-100/70 sm:px-6">© 2026 ClearOut prototype.</p>
      </div>
    </footer>
  );
}
