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

// OpenAI models
const OPENAI_MODELS = [
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
      setSettings(data || [])
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

      // Update each setting
      for (const setting of settings) {
        const { error } = await supabase
          .from('system_ai_config')
          .update({ setting_value: setting.setting_value })
          .eq('setting_key', setting.setting_key)

        if (error) throw error
      }

      toast({
        title: "Success",
        description: "Settings saved successfully",
      })

      // Reload settings to get updated timestamps
      await loadSettings()
    } catch (error) {
      console.error('Error saving settings:', error)
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
            Only users with CEO role can access and modify these settings. API keys are masked by default for security.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Provider Configuration</CardTitle>
            <CardDescription>
              Manage API keys and model selections for AI providers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {settings.map((setting) => {
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
      </div>
    </div>
  )
}

