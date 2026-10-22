import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { EstimateWorkspace } from "@/components/estimate/EstimateWorkspace";

export const metadata: Metadata = {
  title: "Get an estimate · ClearOut",
  description: "Upload photos of retired office electronics and get an itemised inventory with an estimated payout.",
};

export default function EstimatePage() {
  return (
    <>
      <SiteHeader showCta={false} />
      <main>
        <EstimateWorkspace />
      </main>
      <SiteFooter />
    </>
  );
}
