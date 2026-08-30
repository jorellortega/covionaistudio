import type { Metadata } from "next"
import { PromoLanding } from "@/components/promo-landing"

export const metadata: Metadata = {
  title: "Workspace – Ai Cinema Studio",
  description:
    "Build screenplays, characters, and assets in one AI creative workspace, then attach the work to a movie project.",
}

export default function WorkspacePromoPage() {
  return <PromoLanding pageId="workspace" />
}
