import { createClient } from "@supabase/supabase-js"

function getServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getSystemHedraKey(admin: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: directRow } = await admin
    .from("system_ai_config")
    .select("setting_value")
    .eq("setting_key", "hedra_api_key")
    .maybeSingle()

  if (directRow?.setting_value?.trim()) {
    return directRow.setting_value.trim()
  }

  const { data: systemConfig, error: systemError } = await admin.rpc("get_system_ai_config")
  if (!systemError && systemConfig && Array.isArray(systemConfig)) {
    const entry = systemConfig.find(
      (item: { setting_key: string; setting_value: string }) => item.setting_key === "hedra_api_key",
    )
    if (entry?.setting_value?.trim()) {
      return entry.setting_value.trim()
    }
  }

  return null
}

function cleanHedraKey(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null
  return raw.trim()
}

/** Resolve Hedra API key: request override → system config → user profile → HEDRA_API_KEY env. */
export async function getHedraApiKeyForUser(userId: string, override?: string | null): Promise<string | null> {
  const trimmedOverride = override?.trim()
  if (trimmedOverride) return trimmedOverride

  const admin = getServiceRoleClient()

  if (admin) {
    try {
      const systemKey = await getSystemHedraKey(admin)
      const cleanedSystem = cleanHedraKey(systemKey)
      if (cleanedSystem) return cleanedSystem
    } catch (error) {
      console.error("Error checking system Hedra API key:", error)
    }

    try {
      const { data: userData, error: userError } = await admin
        .from("users")
        .select("hedra_api_key")
        .eq("id", userId)
        .maybeSingle()

      if (!userError && userData?.hedra_api_key?.trim()) {
        const cleanedUser = cleanHedraKey(userData.hedra_api_key)
        if (cleanedUser) return cleanedUser
      }
    } catch (error) {
      console.error("Error fetching user Hedra API key:", error)
    }
  }

  return cleanHedraKey(process.env.HEDRA_API_KEY)
}

/** Sync resolve for override or env only (legacy). Prefer getHedraApiKeyForUser on the server. */
export function resolveHedraApiKey(override?: string | null): string | null {
  const trimmed = override?.trim()
  if (trimmed) return trimmed
  return cleanHedraKey(process.env.HEDRA_API_KEY)
}
