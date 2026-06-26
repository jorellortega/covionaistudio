import { createClient } from '@supabase/supabase-js'

function getServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

async function getSystemElevenLabsKey(admin: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: directRow } = await admin
    .from('system_ai_config')
    .select('setting_value')
    .eq('setting_key', 'elevenlabs_api_key')
    .maybeSingle()

  if (directRow?.setting_value?.trim()) {
    return directRow.setting_value.trim()
  }

  const { data: systemConfig, error: systemError } = await admin.rpc('get_system_ai_config')
  if (!systemError && systemConfig && Array.isArray(systemConfig)) {
    const entry = systemConfig.find(
      (item: { setting_key: string; setting_value: string }) => item.setting_key === 'elevenlabs_api_key',
    )
    if (entry?.setting_value?.trim()) {
      return entry.setting_value.trim()
    }
  }

  return null
}

/** Resolve ElevenLabs API key: system config first, then user profile (service role read). */
export async function getElevenLabsApiKeyForUser(userId: string): Promise<string | null> {
  const admin = getServiceRoleClient()
  if (!admin) {
    console.error('SUPABASE_SERVICE_ROLE_KEY missing — cannot resolve ElevenLabs API key')
    return null
  }

  try {
    const systemKey = await getSystemElevenLabsKey(admin)
    if (systemKey) return systemKey
  } catch (error) {
    console.error('Error checking system ElevenLabs API key:', error)
  }

  try {
    const { data: userData, error: userError } = await admin
      .from('users')
      .select('elevenlabs_api_key')
      .eq('id', userId)
      .maybeSingle()

    if (!userError && userData?.elevenlabs_api_key?.trim()) {
      return userData.elevenlabs_api_key.trim()
    }
  } catch (error) {
    console.error('Error fetching user ElevenLabs API key:', error)
  }

  return null
}
