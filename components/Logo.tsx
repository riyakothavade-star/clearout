import Link from "next/link";

// Simple typographic brand mark: a rounded square with an open "C", plus the wordmark.
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#12301f" />
      <path d="M21.5 11.2a7 7 0 1 0 0 9.6" fill="none" stroke="#c8ec7d" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="ClearOut home">
      <LogoMark />
      <span className={`text-[1.15rem] font-semibold tracking-tight ${tone === "light" ? "text-white" : "text-forest-900"}`}>
        ClearOut
      </span>
    </Link>
  );
}
