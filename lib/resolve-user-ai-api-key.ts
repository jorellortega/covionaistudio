import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

export type AiServiceName = 'openai' | 'anthropic'

export function normalizeAiService(service?: string | null): AiServiceName {
  const value = (service || 'openai').toLowerCase()
  if (value.includes('claude') || value.includes('anthropic')) {
    return 'anthropic'
  }
  return 'openai'
}

function getKeyColumn(service: AiServiceName): 'openai_api_key' | 'anthropic_api_key' {
  return service === 'openai' ? 'openai_api_key' : 'anthropic_api_key'
}

function readKeyFromRow(
  row: Record<string, unknown> | null | undefined,
  keyColumn: string,
): string {
  const value = row?.[keyColumn]
  return typeof value === 'string' ? value.trim() : ''
}

async function getSystemApiKey(
  supabase: SupabaseClient,
  keyColumn: string,
): Promise<string> {
  const { data: directRow } = await supabase
    .from('system_ai_config')
    .select('setting_value')
    .eq('setting_key', keyColumn)
    .maybeSingle()

  if (directRow?.setting_value?.trim()) {
    return directRow.setting_value.trim()
  }

  const { data: systemConfig, error } = await supabase.rpc('get_system_ai_config')
  if (!error && Array.isArray(systemConfig)) {
    const entry = systemConfig.find(
      (item: { setting_key?: string; setting_value?: string }) =>
        item.setting_key === keyColumn,
    )
    if (entry?.setting_value?.trim()) {
      return entry.setting_value.trim()
    }
  }

  return ''
}

export interface ResolveUserAiApiKeyInput {
  userId: string
  service?: string | null
  supabase?: SupabaseClient | null
}

/**
 * Resolve an AI API key in priority order:
 * 1. User's own key (Settings → your profile)
 * 2. Site-wide key (Settings → AI Settings Admin / system_ai_config)
 * 3. Server environment variable (OPENAI_API_KEY / ANTHROPIC_API_KEY)
 */
export async function resolveUserAiApiKey(
  input: ResolveUserAiApiKeyInput,
): Promise<{ apiKey: string; normalizedService: AiServiceName; source: 'user' | 'system' | 'env' | null }> {
  const { userId, service, supabase } = input
  const normalizedService = normalizeAiService(service)
  const keyColumn = getKeyColumn(normalizedService)

  const adminClient =
    process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } },
        )
      : null

  const clients = [supabase, adminClient].filter(Boolean) as SupabaseClient[]

  for (const client of clients) {
    const { data } = await client
      .from('users')
      .select('openai_api_key, anthropic_api_key')
      .eq('id', userId)
      .maybeSingle()

    const userKey = readKeyFromRow(data, keyColumn)
    if (userKey) {
      return { apiKey: userKey, normalizedService, source: 'user' }
    }
  }

  for (const client of clients) {
    const systemKey = await getSystemApiKey(client, keyColumn)
    if (systemKey) {
      return { apiKey: systemKey, normalizedService, source: 'system' }
    }
  }

  const envKey =
    normalizedService === 'openai'
      ? process.env.OPENAI_API_KEY || ''
      : process.env.ANTHROPIC_API_KEY || ''

  const trimmedEnv = envKey.trim()
  if (trimmedEnv) {
    return { apiKey: trimmedEnv, normalizedService, source: 'env' }
  }

  return { apiKey: '', normalizedService, source: null }
}
