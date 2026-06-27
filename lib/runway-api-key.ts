import { createClient } from "@supabase/supabase-js"

function getServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getSystemRunwayKey(admin: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: directRow } = await admin
    .from("system_ai_config")
    .select("setting_value")
    .eq("setting_key", "runway_api_key")
    .maybeSingle()

  if (directRow?.setting_value?.trim()) {
    return directRow.setting_value.trim()
  }

  const { data: systemConfig, error: systemError } = await admin.rpc("get_system_ai_config")
  if (!systemError && systemConfig && Array.isArray(systemConfig)) {
    const entry = systemConfig.find(
      (item: { setting_key: string; setting_value: string }) => item.setting_key === "runway_api_key",
    )
    if (entry?.setting_value?.trim()) {
      return entry.setting_value.trim()
    }
  }

  return null
}

function cleanRunwayKey(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null
  const cleaned = raw.replace(/nway_ml_api_key_here.*$/, "").trim()
  if (!cleaned.startsWith("key_") || cleaned.length < 20) return null
  return cleaned
}

/** Resolve Runway API key: system config → user profile → RUNWAYML_API_SECRET env. */
export async function getRunwayApiKeyForUser(userId: string): Promise<string | null> {
  const admin = getServiceRoleClient()

  if (admin) {
    try {
      const systemKey = await getSystemRunwayKey(admin)
      const cleanedSystem = cleanRunwayKey(systemKey)
      if (cleanedSystem) return cleanedSystem
    } catch (error) {
      console.error("Error checking system Runway API key:", error)
    }

    try {
      const { data: userData, error: userError } = await admin
        .from("users")
        .select("runway_api_key")
        .eq("id", userId)
        .maybeSingle()

      if (!userError && userData?.runway_api_key?.trim()) {
        const cleanedUser = cleanRunwayKey(userData.runway_api_key)
        if (cleanedUser) return cleanedUser
      }
    } catch (error) {
      console.error("Error fetching user Runway API key:", error)
    }
  }

  return cleanRunwayKey(process.env.RUNWAYML_API_SECRET)
}
