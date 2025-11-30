"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuthReady } from "@/components/auth-hooks"
import { getSupabaseClient } from "@/lib/supabase"
import { GlobalAISetting } from "@/lib/ai-chat-types"
import { useToast } from "@/hooks/use-toast"
import { Save, Eye, EyeOff, Loader2, AlertCircle, Settings, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"

// OpenAI models
const OPENAI_MODELS = [
  'gpt-5.1',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
]

// Anthropic models
const ANTHROPIC_MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
]

export default function AISettingsAdminPage() {
  const { user, userId, ready } = useAuthReady()
  const router = useRouter()
  const { toast } = useToast()
  const [settings, setSettings] = useState<GlobalAISetting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userRole, setUserRole] = useState<string>('user')
  const [hasAccess, setHasAccess] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [autoFilledKeys, setAutoFilledKeys] = useState<string[]>([])

  // Check if user is CEO or Admin
  useEffect(() => {
    if (!ready || !userId || !user) return

    const checkAccess = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single()

        if (error) {
          console.error('Error fetching user role:', error)
          // Try by email as fallback
          if (user.email) {
            const { data: emailData, error: emailError } = await supabase
              .from('users')
              .select('role')
              .eq('email', user.email)
              .single()
            
            if (!emailError && emailData) {
              const role = emailData?.role || 'user'
              setUserRole(role)
              if (role === 'ceo' || role === 'admin') {
                setHasAccess(true)
                loadSettings()
                return
              }
            }
          }
          router.push('/')
          return
        }

        const role = data?.role || 'user'
        console.log('🔍 AI Settings Admin Page - User role:', role)
        setUserRole(role)

        if (role === 'ceo' || role === 'admin') {
          setHasAccess(true)
          loadSettings()
        } else {
          // Redirect non-admin users
          console.log('❌ Access denied - user role:', role)
          router.push('/')
        }
      } catch (error) {
        console.error('Error checking access:', error)
        router.push('/')
      }
    }

    checkAccess()
  }, [ready, userId, user, router])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const supabase = getSupabaseClient()
      console.log('🔍 Loading AI settings for user:', userId)
      const { data, error } = await supabase
        .from('system_ai_config')
        .select('setting_key, setting_value, description, updated_at')
        .order('setting_key')

      if (error) {
        console.error('❌ Error loading AI settings:', error)
        if (error.code === '42501' || error.message?.includes('permission')) {
          toast({
            title: "Permission Denied",
            description: "You don't have permission to access this. Make sure your role is 'ceo' or 'admin' and RLS policies are updated. Run the update script: supabase/update_ai_config_policies_for_admin.sql",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error",
            description: `Failed to load AI settings: ${error.message}`,
            variant: "destructive",
          })
        }
        throw error
      }

      console.log('✅ AI settings loaded, count:', data?.length || 0)
      
      // Ensure common API keys are always present (even if empty)
      const commonApiKeys = [
        { setting_key: 'openai_api_key', description: 'OpenAI API key for text generation', userKey: 'openai_api_key' },
        { setting_key: 'anthropic_api_key', description: 'Anthropic API key for Claude models', userKey: 'anthropic_api_key' },
        { setting_key: 'openart_api_key', description: 'OpenArt API key for image generation', userKey: 'openart_api_key' },
        { setting_key: 'kling_api_key', description: 'Kling AI API key for video generation', userKey: 'kling_api_key' },
        { setting_key: 'runway_api_key', description: 'Runway API key for video generation', userKey: 'runway_api_key' },
        { setting_key: 'elevenlabs_api_key', description: 'ElevenLabs API key for text-to-speech', userKey: 'elevenlabs_api_key' },
        { setting_key: 'suno_api_key', description: 'Suno AI API key for music generation', userKey: 'suno_api_key' },
      ]
      
      const existingKeys = new Set((data || []).map((s: GlobalAISetting) => s.setting_key))
      const missingKeys = commonApiKeys
        .filter(key => !existingKeys.has(key.setting_key))
        .map(key => ({
          setting_key: key.setting_key,
          setting_value: '',
          description: key.description,
          updated_at: null
        }))
      
      let allSettings = [...(data || []), ...missingKeys]
      
      // Auto-fill empty system-wide keys from admin's user profile
      if (userId) {
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('openai_api_key, anthropic_api_key, openart_api_key, kling_api_key, runway_api_key, elevenlabs_api_key, suno_api_key')
            .eq('id', userId)
            .maybeSingle()
          
          if (userData) {
            // Map user keys to system settings
            const keyMapping: Record<string, string> = {
              'openai_api_key': userData.openai_api_key,
              'anthropic_api_key': userData.anthropic_api_key,
              'openart_api_key': userData.openart_api_key,
              'kling_api_key': userData.kling_api_key,
              'runway_api_key': userData.runway_api_key,
              'elevenlabs_api_key': userData.elevenlabs_api_key,
              'suno_api_key': userData.suno_api_key,
            }
            
            // Fill in empty system keys with admin's user keys
            allSettings = allSettings.map(setting => {
              const userKey = keyMapping[setting.setting_key]
              // Only auto-fill if system key is empty AND user has a key
              if (!setting.setting_value?.trim() && userKey?.trim()) {
                console.log(`🔄 [AUTO-FILL] Auto-filling ${setting.setting_key} from admin user profile`, {
                  hasUserKey: !!userKey?.trim(),
                  keyLength: userKey?.trim().length || 0,
                  keyPreview: userKey?.trim().substring(0, 10) + '...'
                })
                return {
                  ...setting,
                  setting_value: userKey.trim()
                }
              }
              return setting
            })
            
            // Track which keys were auto-filled
            const autoFilled = allSettings
              .filter(s => {
                const userKey = keyMapping[s.setting_key]
                return !s.setting_value?.trim() && userKey?.trim()
              })
              .map(s => s.setting_key)
            
            if (autoFilled.length > 0) {
              setAutoFilledKeys(autoFilled)
              console.log(`✅ [AUTO-FILL] Auto-filled ${autoFilled.length} keys from your user profile:`, autoFilled)
              console.log(`⚠️ [AUTO-FILL] IMPORTANT: Click "Save Changes" to copy these keys to system_ai_config so all users can use them!`)
            } else {
              setAutoFilledKeys([])
            }
          }
        } catch (userKeyError) {
          console.error('Error fetching admin user keys for auto-fill:', userKeyError)
        }
      }
      
      setSettings(allSettings.sort((a, b) => 
        a.setting_key.localeCompare(b.setting_key)
      ))
    } catch (error) {
      console.error('Error loading settings:', error)
      // Don't show toast if already shown above
    } finally {
      setIsLoading(false)
    }
  }

  const updateValue = (key: string, value: string) => {
    setSettings(settings.map(s => 
      s.setting_key === key ? { ...s, setting_value: value } : s
    ))
  }

  const toggleVisibility = (key: string) => {
    setVisibleKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const isSensitiveKey = (key: string): boolean => {
    return key.toLowerCase().includes('api_key') || key.toLowerCase().includes('key')
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const supabase = getSupabaseClient()

      console.log('💾 [SAVE] Starting to save settings...')
      console.log('💾 [SAVE] Total settings to save:', settings.length)
      
      // Update or insert each setting
      for (const setting of settings) {
        // Skip saving empty API keys (don't overwrite existing keys with empty values)
        if (isSensitiveKey(setting.setting_key) && !setting.setting_value?.trim()) {
          console.log(`⏭️ [SAVE] Skipping empty ${setting.setting_key}`)
          continue
        }
        
        console.log(`💾 [SAVE] Saving ${setting.setting_key}:`, {
          hasValue: !!setting.setting_value?.trim(),
          valueLength: setting.setting_value?.length || 0,
          description: setting.description
        })
        
        const { error } = await supabase
          .from('system_ai_config')
          .upsert({
            setting_key: setting.setting_key,
            setting_value: setting.setting_value || '',
            description: setting.description
          }, {
            onConflict: 'setting_key'
          })

        if (error) {
          console.error(`❌ [SAVE] Error saving ${setting.setting_key}:`, error)
          throw error
        } else {
          console.log(`✅ [SAVE] Successfully saved ${setting.setting_key}`)
        }
      }

      console.log('✅ [SAVE] All settings saved successfully')
      toast({
        title: "Success",
        description: "Settings saved successfully",
      })

      // Reload settings to get updated timestamps
      await loadSettings()
    } catch (error) {
      console.error('❌ [SAVE] Error saving settings:', error)
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!ready || isLoading || !hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  if (userRole !== 'ceo' && userRole !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">AI Settings</h1>
            <p className="text-muted-foreground">
              Configure API keys and models for the AI assistant.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadSettings}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Only users with CEO or Admin role can access and modify these settings. API keys are masked by default for security.
          </AlertDescription>
        </Alert>

        {autoFilledKeys.length > 0 && (
          <Alert className="mb-6 border-orange-500 bg-orange-50 dark:bg-orange-950">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <strong>Auto-filled from your profile:</strong> {autoFilledKeys.join(', ').replace(/_/g, ' ')}
              <br />
              <strong className="text-orange-900 dark:text-orange-100">⚠️ Click "Save Changes" below to copy these keys to system-wide config so all users can use them!</strong>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Provider Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle>Provider Configuration</CardTitle>
              <CardDescription>
                Manage API keys and model selections for AI providers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings
                .filter(setting => !setting.setting_key.startsWith('text_enhancer'))
                .map((setting) => {
                  const isSensitive = isSensitiveKey(setting.setting_key)
                  const isVisible = visibleKeys[setting.setting_key] || false
                  const displayValue = isSensitive && !isVisible
                    ? '•'.repeat(20)
                    : setting.setting_value

                  return (
                    <div key={setting.setting_key} className="space-y-2">
                      <Label htmlFor={setting.setting_key} className="flex items-center gap-2">
                        {setting.setting_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        {setting.description && (
                          <span className="text-xs text-muted-foreground font-normal">
                            ({setting.description})
                          </span>
                        )}
                      </Label>
                      
                      {setting.setting_key === 'openai_model' ? (
                        <Select
                          value={setting.setting_value || ''}
                          onValueChange={(value) => updateValue(setting.setting_key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {OPENAI_MODELS.map((model) => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : setting.setting_key === 'anthropic_model' ? (
                        <Select
                          value={setting.setting_value || ''}
                          onValueChange={(value) => updateValue(setting.setting_key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {ANTHROPIC_MODELS.map((model) => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="relative">
                          <Input
                            id={setting.setting_key}
                            type={isSensitive && !isVisible ? 'password' : 'text'}
                            value={displayValue}
                            onChange={(e) => updateValue(setting.setting_key, e.target.value)}
                            placeholder={`Enter ${setting.setting_key.replace(/_/g, ' ')}`}
                            className={isSensitive ? 'pr-10' : ''}
                          />
                          {isSensitive && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => toggleVisibility(setting.setting_key)}
                            >
                              {isVisible ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                      
                      {setting.updated_at && (
                        <p className="text-xs text-muted-foreground">
                          Last updated: {new Date(setting.updated_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )
                })}

              <div className="flex gap-4 pt-4 border-t">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Text Enhancer Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>Text Enhancer Settings</CardTitle>
              <CardDescription>
                Configure the AI text enhancer for grammar, spelling, and movie content enhancement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Model Selector */}
              <div className="space-y-2">
                <Label htmlFor="text_enhancer_model">
                  Model
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    (Model to use for text enhancement)
                  </span>
                </Label>
                <Select
                  value={
                    settings.find(s => s.setting_key === 'text_enhancer_model')?.setting_value || 'gpt-4o-mini'
                  }
                  onValueChange={(value) => {
                    const existing = settings.find(s => s.setting_key === 'text_enhancer_model')
                    if (existing) {
                      updateValue('text_enhancer_model', value)
                    } else {
                      // Add new setting if it doesn't exist
                      setSettings([...settings, {
                        setting_key: 'text_enhancer_model',
                        setting_value: value,
                        description: 'Model to use for text enhancement',
                        updated_at: new Date().toISOString()
                      }])
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_MODELS.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                    {ANTHROPIC_MODELS.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {settings.find(s => s.setting_key === 'text_enhancer_model')?.updated_at && (
                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(settings.find(s => s.setting_key === 'text_enhancer_model')!.updated_at || '').toLocaleString()}
                  </p>
                )}
              </div>

              {/* Prefix/Prompt Field */}
              <div className="space-y-2">
                <Label htmlFor="text_enhancer_prefix">
                  Enhancement Prefix
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    (The prefix/prompt used for text enhancement)
                  </span>
                </Label>
                <Textarea
                  id="text_enhancer_prefix"
                  value={
                    settings.find(s => s.setting_key === 'text_enhancer_prefix')?.setting_value || ''
                  }
                  onChange={(e) => {
                    const existing = settings.find(s => s.setting_key === 'text_enhancer_prefix')
                    if (existing) {
                      updateValue('text_enhancer_prefix', e.target.value)
                    } else {
                      // Add new setting if it doesn't exist
                      setSettings([...settings, {
                        setting_key: 'text_enhancer_prefix',
                        setting_value: e.target.value,
                        description: 'The prefix/prompt used for text enhancement',
                        updated_at: new Date().toISOString()
                      }])
                    }
                  }}
                  placeholder="Enter the prefix/prompt for text enhancement"
                  rows={10}
                  className="font-mono text-sm"
                />
                {settings.find(s => s.setting_key === 'text_enhancer_prefix')?.updated_at && (
                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(settings.find(s => s.setting_key === 'text_enhancer_prefix')!.updated_at || '').toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

