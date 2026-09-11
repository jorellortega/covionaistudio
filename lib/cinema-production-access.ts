import { NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/supabase"

export const CINEMA_PRODUCTION_UPGRADE_MESSAGE =
  "Upgrade required to use the video production page. Studio and Production House plans include Cinema Production."

export function canAccessCinemaProduction(
  role?: string | null,
  planId?: string | null,
): boolean {
  const normalizedRole = (role || "").toLowerCase()
  const normalizedPlan = (planId || "").toLowerCase()

  if (normalizedRole === "ceo" || normalizedRole === "cinema") return true
  if (normalizedPlan === "creator") return false
  if (normalizedPlan === "studio" || normalizedPlan === "production") return true
  return normalizedRole === "studio" || normalizedRole === "production"
}

export async function resolveCinemaProductionAccess(
  supabase: { from: (table: string) => any },
  userId: string,
): Promise<{ allowed: boolean; role: string | null; planId: string | null }> {
  const [{ data: userRow }, { data: subscription }] = await Promise.all([
    supabase.from("users").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const role = typeof userRow?.role === "string" ? userRow.role : null
  const planId = typeof subscription?.plan_id === "string" ? subscription.plan_id : null
  return {
    allowed: canAccessCinemaProduction(role, planId),
    role,
    planId,
  }
}

export async function fetchCinemaProductionAccess(userId: string) {
  return resolveCinemaProductionAccess(getSupabaseClient(), userId)
}

export async function cinemaProductionAccessDeniedResponse(
  supabase: { from: (table: string) => any },
  userId: string,
) {
  const access = await resolveCinemaProductionAccess(supabase, userId)
  if (access.allowed) return null
  return NextResponse.json(
    {
      error: CINEMA_PRODUCTION_UPGRADE_MESSAGE,
      code: "UPGRADE_REQUIRED",
    },
    { status: 403 },
  )
}
