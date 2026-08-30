import type { Metadata } from "next"
import { PromoLanding } from "@/components/promo-landing"

export const metadata: Metadata = {
  title: "Production – Ai Cinema Studio",
  description:
    "Per film: Timeline, Storyboards, Lighting Plot, Call Sheet, Crew Sheet, Equipment List, Props List, and the shared Assets library.",
}

export default function ProductionPromoPage() {
  return <PromoLanding pageId="production" />
}
