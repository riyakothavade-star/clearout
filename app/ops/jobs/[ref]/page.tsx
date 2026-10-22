import type { Metadata } from "next";
import { Suspense } from "react";
import { OpsJobConsole } from "@/components/ops/OpsJobConsole";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = { title: "Clear-out · Team console · ClearOut", robots: { index: false, follow: false } };

export default function OpsJobPage() {
  return (
    <>
      <SiteHeader showCta={false} />
      <main>
        <Suspense fallback={<p className="mx-auto max-w-5xl px-4 py-16 text-muted">Loading…</p>}>
          <OpsJobConsole />
        </Suspense>
      </main>
    </>
  );
}
