import { createClient } from "@supabase/supabase-js"

function getServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function cleanMireloKey(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null
  return raw.trim()
}

/** Resolve Mirelo API key: request override → user profile → MIRELO_API_KEY env. */
export async function getMireloApiKeyForUser(userId: string, override?: string | null): Promise<string | null> {
  const trimmedOverride = override?.trim()
  if (trimmedOverride) return trimmedOverride

  const admin = getServiceRoleClient()
  if (admin) {
    try {
      const { data: userData, error: userError } = await admin
        .from("users")
        .select("mirelo_api_key")
        .eq("id", userId)
        .maybeSingle()

      if (!userError && userData?.mirelo_api_key?.trim()) {
        const cleanedUser = cleanMireloKey(userData.mirelo_api_key)
        if (cleanedUser) return cleanedUser
      }
    } catch (error) {
      console.error("Error fetching user Mirelo API key:", error)
    }
  }

  return cleanMireloKey(process.env.MIRELO_API_KEY)
}
