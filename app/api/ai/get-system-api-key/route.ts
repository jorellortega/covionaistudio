import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    console.log('🔑 [DEBUG] get-system-api-key route called')
    const { searchParams } = new URL(request.url)
    const keyType = searchParams.get('type') // e.g., 'elevenlabs_api_key', 'suno_api_key', etc.

    console.log('🔑 [DEBUG] Requested key type:', keyType)

    if (!keyType) {
      console.log('❌ [DEBUG] Key type is missing')
      return NextResponse.json(
        { error: 'Key type is required' },
        { status: 400 }
      )
    }

    // Use service role to bypass RLS and get system-wide API keys
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('❌ [DEBUG] SUPABASE_SERVICE_ROLE_KEY not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    console.log('🔑 [DEBUG] Creating Supabase admin client...')
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // FIRST: Try direct query to check if key exists (bypass RPC entirely)
    console.log('🔑 [DEBUG] Trying DIRECT query first to check if key exists...')
    const { data: directCheck, error: directCheckError } = await supabaseAdmin
      .from('system_ai_config')
      .select('setting_key, setting_value')
      .eq('setting_key', keyType)
      .maybeSingle()
    
    console.log('🔑 [DEBUG] Direct query check result:', {
      hasError: !!directCheckError,
      errorMessage: directCheckError?.message,
      errorCode: directCheckError?.code,
      hasData: !!directCheck,
      settingKey: directCheck?.setting_key,
      settingValueLength: directCheck?.setting_value?.length || 0,
      settingValuePreview: directCheck?.setting_value ? '***' + directCheck.setting_value.slice(-4) : null
    })
    
    if (!directCheckError && directCheck?.setting_value?.trim()) {
      console.log('✅ [DEBUG] Found key via direct query - returning immediately')
      return NextResponse.json(
        { apiKey: directCheck.setting_value.trim(), debug: { method: 'direct_query', keyType } },
        { status: 200 }
      )
    }
    
    // List ALL keys in the table to see what's actually there
    const { data: allKeys, error: allKeysError } = await supabaseAdmin
      .from('system_ai_config')
      .select('setting_key, setting_value')
      .order('setting_key')
    
    console.log('🔑 [DEBUG] ALL keys in system_ai_config table:', {
      hasError: !!allKeysError,
      errorMessage: allKeysError?.message,
      totalKeys: allKeys?.length || 0,
      keys: allKeys?.map(k => ({ key: k.setting_key, hasValue: !!k.setting_value?.trim(), valueLength: k.setting_value?.length || 0 })) || []
    })
    
    console.log('🔑 [DEBUG] Direct query found nothing, trying RPC function...')
    console.log('🔑 [DEBUG] Using service role key (bypasses RLS):', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    // Get system-wide API keys using RPC function (bypasses RLS)
    const { data: systemConfig, error: systemError } = await supabaseAdmin.rpc('get_system_ai_config')
    
    console.log('🔑 [DEBUG] RPC function response:', {
      hasError: !!systemError,
      errorMessage: systemError?.message,
      errorCode: systemError?.code,
      errorDetails: systemError?.details,
      hasData: !!systemConfig,
      dataType: typeof systemConfig,
      isArray: Array.isArray(systemConfig),
      rawResponse: JSON.stringify({ data: systemConfig, error: systemError }, null, 2)
    })
    
    if (systemError) {
      console.error('❌ [DEBUG] Error fetching system-wide API keys:', systemError)
      return NextResponse.json(
        { error: 'Failed to fetch system API keys', details: systemError.message, code: systemError.code },
        { status: 500 }
      )
    }

    console.log('🔑 [DEBUG] RPC call result:', {
      hasData: !!systemConfig,
      isArray: Array.isArray(systemConfig),
      length: systemConfig?.length || 0,
      rawData: JSON.stringify(systemConfig, null, 2)
    })

    if (!systemConfig || !Array.isArray(systemConfig)) {
      console.log('❌ [DEBUG] No system config data or not an array, trying direct query...')
      
      // Fallback: Try direct query if RPC fails
      const { data: directData, error: directError } = await supabaseAdmin
        .from('system_ai_config')
        .select('setting_key, setting_value')
        .eq('setting_key', keyType)
        .maybeSingle()
      
      console.log('🔑 [DEBUG] Direct query result:', {
        hasError: !!directError,
        errorMessage: directError?.message,
        hasData: !!directData,
        settingValue: directData?.setting_value ? '***' + directData.setting_value.slice(-4) : null
      })
      
      if (!directError && directData?.setting_value?.trim()) {
        console.log('✅ [DEBUG] Found key via direct query')
        return NextResponse.json(
          { apiKey: directData.setting_value.trim(), debug: { method: 'direct_query', keyType } },
          { status: 200 }
        )
      }
      
      return NextResponse.json(
        { apiKey: null, debug: 'No system config found (RPC and direct query both failed)' },
        { status: 200 }
      )
    }

    // Find the requested API key
    const configMap: Record<string, string> = {}
    const allSettingKeys: string[] = []
    systemConfig.forEach((item: any) => {
      configMap[item.setting_key] = item.setting_value
      allSettingKeys.push(item.setting_key)
      const valuePreview = item.setting_value 
        ? (item.setting_value.length > 10 ? '***' + item.setting_value.slice(-4) : item.setting_value)
        : '(empty/null)'
      console.log(`🔑 [DEBUG] Found setting: ${item.setting_key} = ${valuePreview} (length: ${item.setting_value?.length || 0})`)
    })

    console.log('🔑 [DEBUG] All setting keys in system_ai_config:', allSettingKeys)
    console.log('🔑 [DEBUG] Requested key type:', keyType)
    console.log('🔑 [DEBUG] Key exists in configMap:', keyType in configMap)
    console.log('🔑 [DEBUG] Key value (raw):', configMap[keyType])
    console.log('🔑 [DEBUG] Key value (type):', typeof configMap[keyType])

    let apiKey = configMap[keyType]?.trim() || null

    // If key not found in RPC results, try direct query as fallback
    if (!apiKey) {
      console.log('🔑 [DEBUG] Key not found in RPC results, trying direct query fallback...')
      const { data: directData, error: directError } = await supabaseAdmin
        .from('system_ai_config')
        .select('setting_key, setting_value')
        .eq('setting_key', keyType)
        .maybeSingle()
      
      console.log('🔑 [DEBUG] Direct query fallback result:', {
        hasError: !!directError,
        errorMessage: directError?.message,
        hasData: !!directData,
        settingValue: directData?.setting_value ? '***' + directData.setting_value.slice(-4) : null,
        settingValueLength: directData?.setting_value?.length || 0
      })
      
      if (!directError && directData?.setting_value?.trim()) {
        apiKey = directData.setting_value.trim()
        console.log('✅ [DEBUG] Found key via direct query fallback')
      } else {
        console.log('❌ [DEBUG] Direct query also failed to find key')
      }
    }

    console.log('🔑 [DEBUG] Final API key result:', apiKey ? '***' + apiKey.slice(-4) : 'null')
    console.log('🔑 [DEBUG] API key length:', apiKey?.length || 0)

    // Return only the API key value (not the full config)
    return NextResponse.json(
      { 
        apiKey, 
        debug: { 
          keyType, 
          found: !!apiKey, 
          configKeys: allSettingKeys,
          requestedKeyExists: keyType in configMap,
          requestedKeyValue: configMap[keyType] ? '***' + configMap[keyType].slice(-4) : null,
          requestedKeyLength: configMap[keyType]?.length || 0,
          method: apiKey ? (configMap[keyType] ? 'rpc' : 'direct_query') : 'none'
        } 
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('❌ [DEBUG] Error in get-system-api-key route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

