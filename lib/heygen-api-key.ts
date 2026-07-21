import { createClient } from "@supabase/supabase-js"

function getServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function cleanHeyGenKey(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null
  return raw.trim()
}

/** Resolve HeyGen API key: request override → user profile → HEYGEN_API_KEY env. */
export async function getHeyGenApiKeyForUser(userId: string, override?: string | null): Promise<string | null> {
  const trimmedOverride = override?.trim()
  if (trimmedOverride) return trimmedOverride

  const admin = getServiceRoleClient()
  if (admin) {
    try {
      const { data: userData, error: userError } = await admin
        .from("users")
        .select("heygen_api_key")
        .eq("id", userId)
        .maybeSingle()

      if (!userError && userData?.heygen_api_key?.trim()) {
        const cleanedUser = cleanHeyGenKey(userData.heygen_api_key)
        if (cleanedUser) return cleanedUser
      }
    } catch (error) {
      console.error("Error fetching user HeyGen API key:", error)
    }
  }

  return cleanHeyGenKey(process.env.HEYGEN_API_KEY)
}
