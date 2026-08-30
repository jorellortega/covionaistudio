import type { Metadata } from "next"
import { PromoLanding } from "@/components/promo-landing"

export const metadata: Metadata = {
  title: "Preproduction – Ai Cinema Studio",
  description:
    "Projects, treatments, characters, and locations — scene-level prep and breakdowns before you hit the schedule.",
}

export default function PreproductionPromoPage() {
  return <PromoLanding pageId="preproduction" />
}
