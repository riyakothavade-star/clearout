import type { Metadata } from "next";
import { OpsHome } from "@/components/ops/OpsHome";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = { title: "Team console · ClearOut", robots: { index: false, follow: false } };

export default function OpsPage() {
  return (
    <>
      <SiteHeader showCta={false} />
      <main>
        <OpsHome />
      </main>
    </>
  );
}
