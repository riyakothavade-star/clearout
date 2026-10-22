import type { Metadata } from "next";
import { Suspense } from "react";
import { ClosurePack } from "@/components/jobs/ClosurePack";

export const metadata: Metadata = {
  title: "Closure pack · ClearOut",
  robots: { index: false, follow: false },
};

export default function ClosurePage() {
  return (
    <main className="min-h-screen bg-surface">
      <Suspense fallback={<p className="mx-auto max-w-3xl px-4 py-16 text-muted">Loading closure pack…</p>}>
        <ClosurePack />
      </Suspense>
    </main>
  );
}
