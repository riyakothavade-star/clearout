"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { CloseIcon, MenuIcon } from "@/components/icons";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#what-we-handle", label: "What we handle" },
  { href: "/#data-security", label: "Data security" },
];

export function SiteHeader({ showCta = true }: { showCta?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-muted transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {showCta && (
            <Link
              href="/estimate"
              className="hidden rounded-[var(--radius-control)] bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-forest-800 sm:inline-flex"
            >
              Get an estimate
            </Link>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] text-ink hover:bg-sunken md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line bg-canvas px-4 pb-4 pt-2 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-3 text-base font-medium text-ink hover:bg-sunken"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/estimate"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-[var(--radius-control)] bg-forest-900 px-4 py-3 text-center font-semibold text-white"
          >
            Get an estimate
          </Link>
        </nav>
      )}
    </header>
  );
}
