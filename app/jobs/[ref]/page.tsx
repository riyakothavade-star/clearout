import type { Metadata } from "next";
import { Suspense } from "react";
import { JobTracker } from "@/components/jobs/JobTracker";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Your clear-out · ClearOut",
  robots: { index: false, follow: false }, // private links must not be indexed
};

export default function JobPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={<p className="mx-auto max-w-4xl px-4 py-16 text-muted sm:px-6">Loading your clear-out…</p>}>
          <JobTracker />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
