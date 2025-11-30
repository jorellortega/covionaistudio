"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useAuthReady } from "@/components/auth-hooks"
import { AISettingsService, AISetting, AISettingUpdate } from "@/lib/ai-settings-service"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseClient } from "@/lib/supabase"
import { 
  FileText, 
  ImageIcon, 
  Video, 
  Sparkles, 
  Save, 
  RefreshCw, 
  Lock, 
  Unlock,
  Settings,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Shield
} from "lucide-react"

const aiModels = {
  scripts: ["ChatGPT", "Claude", "GPT-4", "Gemini", "Custom"],
  images: ["GPT Image", "OpenArt", "DALL-E 3", "Runway ML", "Midjourney", "Stable Diffusion", "Custom"],
  videos: ["Kling", "Runway ML", "Pika Labs", "Stable Video", "LumaAI"],
  audio: ["ElevenLabs", "Suno AI", "Udio", "MusicLM", "AudioCraft", "Custom"],
  timeline: ["GPT Image", "OpenArt", "DALL-E 3", "Runway ML", "Midjourney", "Stable Diffusion", "Custom"],
}

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

const tabIcons = {
  scripts: FileText,
  images: ImageIcon,
  videos: Video,
  audio: Sparkles,
  timeline: ImageIcon,
}

const tabNames = {
  scripts: "Scripts",
  images: "Images", 
  videos: "Videos",
  audio: "Audio",
  timeline: "Timeline",
}

export default function AISettingsPage() {
  const { user, userId, ready } = useAuthReady()
  const router = useRouter()
  const { toast } = useToast()
  const [settings, setSettings] = useState<AISetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [userApiKeys, setUserApiKeys] = useState<any>({})

  // CEO role check state
  const [userRole, setUserRole] = useState<string>('user')
  const [isCheckingRole, setIsCheckingRole] = useState(true)
  const [isCEO, setIsCEO] = useState(false)

  // Password protection state
  const [isPasswordProtected, setIsPasswordProtected] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Check if user is CEO - REQUIRED for access
  useEffect(() => {
    if (!ready || !userId || !user) return

    const checkCEORole = async () => {
      try {
        setIsCheckingRole(true)
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
              if (role === 'ceo') {
                setIsCEO(true)
              } else {
                console.log('❌ Access denied - user role:', role, '(required: ceo)')
                toast({
                  title: "Access Denied",
                  description: "This page is restricted to CEO users only.",
                  variant: "destructive",
                })
                router.push('/')
              }
              return
            }
          }
          toast({
            title: "Error",
            description: "Failed to verify user permissions.",
            variant: "destructive",
          })
          router.push('/')
          return
        }

        const role = data?.role || 'user'
        console.log('🔍 AI Settings Page - User role:', role)
        setUserRole(role)

        if (role === 'ceo') {
          setIsCEO(true)
        } else {
          // Redirect non-CEO users
          console.log('❌ Access denied - user role:', role, '(required: ceo)')
          toast({
            title: "Access Denied",
            description: "This page is restricted to CEO users only.",
            variant: "destructive",
          })
          router.push('/')
        }
      } catch (error) {
        console.error('Error checking CEO role:', error)
        toast({
          title: "Error",
          description: "Failed to verify user permissions.",
          variant: "destructive",
        })
        router.push('/')
      } finally {
        setIsCheckingRole(false)
      }
    }

    checkCEORole()
  }, [ready, userId, user, router, toast])

  // Check if settings are password protected (only if CEO)
  // Always clear sessionStorage on page load to force password prompt every time
  useEffect(() => {
    if (!ready || !userId || !isCEO) return;
    
    // Clear any existing session storage to force password prompt every time
    sessionStorage.removeItem('ai-settings-access')
    
    const checkPasswordProtection = async () => {
      try {
        console.log('🔒 Checking password protection for user:', userId)
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('users')
          .select('settings_password_enabled')
          .eq('id', userId)
          .single()

        if (error) throw error
        
        const isProtected = data?.settings_password_enabled || false
        console.log('🔒 Password protection status:', isProtected)
        setIsPasswordProtected(isProtected)
        
        // If no password protection, grant access
        if (!isProtected) {
          console.log('🔒 No password protection - granting access')
          setHasAccess(true)
        } else {
          // Password protection enabled - require password every time (no sessionStorage check)
          console.log('🔒 Password protected - access will require password')
          setHasAccess(false)
        }
      } catch (error) {
        console.error('Error checking password protection:', error)
        // Default to no protection on error
        setIsPasswordProtected(false)
        setHasAccess(true)
      }
    }
    
    checkPasswordProtection()
  }, [ready, userId, isCEO])

  // Password verification - check against stored password
  const verifyPassword = async (password: string) => {
    try {
      console.log('🔐 Verifying password for user:', userId)
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('users')
        .select('settings_password_hash')
        .eq('id', userId)
        .single()

      if (error) throw error
      
      console.log('🔐 Stored password hash:', data?.settings_password_hash ? 'exists' : 'none')
      console.log('🔐 Entered password:', password)
      
      // Check if password matches
      if (data?.settings_password_hash === password) {
        console.log('🔐 Password correct - granting access')
        setHasAccess(true)
        // Don't store in sessionStorage - require password every time
        setShowPasswordModal(false)
        setPasswordInput('')
        setPasswordError('')
        toast({
          title: "Access Granted",
          description: "You can now access the AI settings page",
        })
      } else {
        console.log('🔐 Password incorrect')
        setPasswordError('Incorrect password')
      }
    } catch (error) {
      console.error('Error verifying password:', error)
      setPasswordError('Error verifying password')
    }
  }

  // Function to fetch user API keys and system-wide keys
  const fetchUserApiKeys = async () => {
    try {
      const supabase = getSupabaseClient()
      
      // Fetch user-specific API keys
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('openai_api_key, anthropic_api_key, openart_api_key, kling_api_key, runway_api_key, elevenlabs_api_key, suno_api_key')
        .eq('id', userId)
        .maybeSingle()

      const userKeys = userData || {}
      
      // Fetch system-wide API keys from system_ai_config
      const systemKeys: Record<string, string> = {}
      try {
        const { data: systemData, error: systemError } = await supabase
          .from('system_ai_config')
          .select('setting_key, setting_value')
          .in('setting_key', ['openai_api_key', 'anthropic_api_key', 'openart_api_key', 'kling_api_key', 'runway_api_key', 'elevenlabs_api_key', 'suno_api_key'])

        if (!systemError && systemData) {
          systemData.forEach((item: any) => {
            if (item.setting_value?.trim()) {
              // Map setting_key to userApiKeys format
              const keyMap: Record<string, string> = {
                'openai_api_key': 'openai_api_key',
                'anthropic_api_key': 'anthropic_api_key',
                'openart_api_key': 'openart_api_key',
                'kling_api_key': 'kling_api_key',
                'runway_api_key': 'runway_api_key',
                'elevenlabs_api_key': 'elevenlabs_api_key',
                'suno_api_key': 'suno_api_key',
              }
              const keyName = keyMap[item.setting_key]
              if (keyName) {
                systemKeys[keyName] = item.setting_value.trim()
              }
            }
          })
        }
      } catch (systemError) {
        console.error('Error fetching system-wide API keys:', systemError)
      }
      
      // Merge: user keys take precedence, but system keys fill in gaps
      const mergedKeys = {
        ...systemKeys,
        ...userKeys, // User keys override system keys
      }
      
      setUserApiKeys(mergedKeys)
    } catch (error) {
      console.error('Error fetching API keys:', error)
    }
  }

  // Load system-wide AI settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!ready) return
      
      try {
        setLoading(true)
        
        // Fetch API keys and settings in parallel
        await Promise.all([
          fetchUserApiKeys(),
          AISettingsService.getSystemSettings()
        ])
        
        let systemSettings = await AISettingsService.getSystemSettings()
        
        // If no settings exist, initialize with defaults
        if (systemSettings.length === 0) {
          console.log('No settings found, initializing system-wide defaults...')
          try {
            systemSettings = await AISettingsService.initializeSystemSettings()
            console.log('Default system settings initialized:', systemSettings)
          } catch (initError) {
            console.error('Failed to initialize default settings:', initError)
            // Show error message to user
            toast({
              title: "Database Setup Required",
              description: "The AI settings table needs to be created. Please run the migration script in your Supabase dashboard.",
              variant: "destructive",
            })
            return
          }
        }
        
        // Ensure selected_model is set for scripts tab with ChatGPT/GPT-4/Claude
        systemSettings = systemSettings.map(setting => {
          if (setting.tab_type === 'scripts' && !setting.selected_model) {
            if (setting.locked_model === 'ChatGPT' || setting.locked_model === 'GPT-4') {
              setting.selected_model = 'gpt-4o-mini'
            } else if (setting.locked_model === 'Claude') {
              setting.selected_model = 'claude-3-5-sonnet-20241022'
            }
          }
          return setting
        })
        
        // Ensure timeline setting exists
        try {
          const hasTimelineSetting = systemSettings.some(s => s.tab_type === 'timeline')
          if (!hasTimelineSetting) {
            const timelineSetting = await AISettingsService.getTimelineSetting()
            if (timelineSetting) {
              systemSettings.push(timelineSetting)
            }
          }
        } catch (error) {
          console.log('Timeline setting not available yet')
        }
        
        setSettings(systemSettings)
      } catch (error) {
        console.error('Error loading AI settings:', error)
        
        // Check if it's a table not found error
        if (error instanceof Error && error.message.includes('table')) {
          toast({
            title: "Database Setup Required",
            description: "Please run the migration script in your Supabase dashboard to create the required table.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error",
            description: "Failed to load AI settings. Please try again.",
            variant: "destructive",
          })
        }
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [ready, toast])

  // Check if user has required API keys for selected models (checks both user and system-wide keys)
  const checkModelAvailability = (tabType: string, model: string) => {
    if (!ready) return { isReady: false, statusText: "Not logged in" }
    
    // Check specific API key requirements (user keys take precedence, but system keys are checked too)
    if (model === "DALL-E 3" || model === "ChatGPT" || model === "GPT-4" || model === "GPT Image") {
      const hasKey = !!userApiKeys.openai_api_key
      return { 
        isReady: hasKey, 
        statusText: hasKey ? "Ready" : "OpenAI API Key Required (User or System)" 
      }
    } else if (model === "Claude") {
      const hasKey = !!userApiKeys.anthropic_api_key
      return { 
        isReady: hasKey, 
        statusText: hasKey ? "Ready" : "Anthropic API Key Required (User or System)" 
      }
    } else if (model === "OpenArt") {
      const hasKey = !!userApiKeys.openart_api_key
      return { 
        isReady: hasKey, 
        statusText: hasKey ? "Ready" : "OpenArt API Key Required (User or System)" 
      }
    } else if (model === "Runway ML") {
      const hasKey = !!userApiKeys.runway_api_key
      return { 
        isReady: hasKey, 
        statusText: hasKey ? "Ready" : "Runway ML API Key Required (User or System)" 
      }
    } else if (model === "Kling") {
      const hasKey = !!userApiKeys.kling_api_key
      return { 
        isReady: hasKey, 
        statusText: hasKey ? "Ready" : "Kling API Key Required (User or System)" 
      }
    } else if (model === "ElevenLabs") {
      const hasKey = !!userApiKeys.elevenlabs_api_key
      return { 
        isReady: hasKey, 
        statusText: hasKey ? "Ready" : "ElevenLabs API Key Required (User or System)" 
      }
    } else if (model === "Suno AI") {
      const hasKey = !!userApiKeys.suno_api_key
      return { 
        isReady: hasKey, 
        statusText: hasKey ? "Ready" : "Suno AI API Key Required (User or System)" 
      }
    }
    
    // Default for other models
    return { isReady: true, statusText: "Ready" }
  }

  // Handle setting changes
  const handleSettingChange = (tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline', field: 'locked_model' | 'is_locked' | 'selected_model', value: string | boolean) => {
    console.log(`Setting change: ${tabType}.${field} = ${value}`)
    
    setSettings(prev => {
      let newSettings = prev.map(setting => {
        if (setting.tab_type === tabType) {
          const updated = { ...setting, [field]: value }
          
          // When changing locked_model, update selected_model if needed
          if (field === 'locked_model' && tabType === 'scripts') {
            const model = value as string
            if (model === 'ChatGPT' || model === 'GPT-4') {
              // Set default OpenAI model if not already set
              if (!updated.selected_model) {
                updated.selected_model = 'gpt-4o-mini'
              }
            } else if (model === 'Claude') {
              // Set default Anthropic model if not already set
              if (!updated.selected_model) {
                updated.selected_model = 'claude-3-5-sonnet-20241022'
              }
            } else {
              // Clear selected_model for other providers
              updated.selected_model = null
            }
          }
          
          return updated
        }
        
        return setting
      })
      
      // After updating the primary setting, sync timeline and images
      // Since timeline uses images as backend, they should always be in sync
      if (tabType === 'timeline') {
        // Find the updated timeline setting
        const timelineSetting = newSettings.find(s => s.tab_type === 'timeline')
        const imagesSetting = newSettings.find(s => s.tab_type === 'images')
        
        if (timelineSetting && imagesSetting) {
          // Update images to match timeline (since timeline saves to images)
          newSettings = newSettings.map(s => 
            s.tab_type === 'images' 
              ? { 
                  ...s, 
                  [field]: value,
                  locked_model: timelineSetting.locked_model,
                  selected_model: timelineSetting.selected_model,
                }
              : s
          )
        }
      } else if (tabType === 'images') {
        // Find the updated images setting
        const imagesSetting = newSettings.find(s => s.tab_type === 'images')
        const timelineSetting = newSettings.find(s => s.tab_type === 'timeline' && s.id.includes('-timeline'))
        
        if (imagesSetting && timelineSetting) {
          // Update timeline to match images (since timeline reads from images)
          newSettings = newSettings.map(s => 
            s.tab_type === 'timeline' && s.id.includes('-timeline')
              ? { 
                  ...s, 
                  [field]: value,
                  locked_model: imagesSetting.locked_model,
                  selected_model: imagesSetting.selected_model,
                }
              : s
          )
        }
      }
      
      // Log the updated settings for debugging
      console.log('Updated settings state:', newSettings)
      
      return newSettings
    })
    setHasChanges(true)
    
    // Show immediate feedback
    if (field === 'is_locked') {
      const action = value ? 'locked' : 'unlocked'
      toast({
        title: `${tabNames[tabType]} ${action}`,
        description: `Model selection is now ${action}.`,
        variant: "default",
      })
      
      // Auto-save immediately for toggle changes
      if (ready) {
        // Get current setting BEFORE state update to build the save data
        const currentSetting = settings.find(s => s.tab_type === tabType)
        if (!currentSetting) return
        
        // Build update data - use the new value for the changed field
        const updateData: AISettingUpdate = {
          tab_type: tabType,
          locked_model: field === 'locked_model' ? value as string : currentSetting.locked_model,
          selected_model: field === 'selected_model' ? (value as string) : (currentSetting.selected_model || null),
          is_locked: field === 'is_locked' ? value as boolean : currentSetting.is_locked,
        }
        
        console.log(`Auto-saving system-wide ${tabType}:`, updateData)
        
        // Save to database (system-wide)
        AISettingsService.upsertTabSetting(updateData)
          .then(result => {
            console.log(`Auto-save successful for ${tabType}:`, result)
            
            // Update state with the saved result to keep it in sync
            setSettings(prevState => 
              prevState.map(s => 
                s.tab_type === tabType ? { ...result } : s
              )
            )
            
            setHasChanges(false)
          })
          .catch(error => {
            console.error(`Auto-save failed for ${tabType}:`, error)
            toast({
              title: "Auto-save Failed",
              description: `Failed to save ${tabType} settings. Please try again.`,
              variant: "destructive",
            })
          })
      }
    }
  }

  // Save all settings (system-wide)
  const handleSaveSettings = async () => {
    if (!ready) return
    
    try {
      setSaving(true)
      console.log('=== SAVE DEBUG ===')
      console.log('Current settings state:', settings)
      console.log('Settings that will be saved:')
      
      // Save all settings (system-wide, including timeline)
      for (const setting of settings) {
        // Ensure selected_model is set for scripts with ChatGPT/GPT-4/Claude
        let selectedModel = setting.selected_model
        if (setting.tab_type === 'scripts' && !selectedModel) {
          if (setting.locked_model === 'ChatGPT' || setting.locked_model === 'GPT-4') {
            selectedModel = 'gpt-4o-mini'
          } else if (setting.locked_model === 'Claude') {
            selectedModel = 'claude-3-5-sonnet-20241022'
          }
        }
        
        const updateData: AISettingUpdate = {
          tab_type: setting.tab_type,
          locked_model: setting.locked_model,
          selected_model: selectedModel,
          is_locked: setting.is_locked,
        }
        
        console.log(`Saving ${setting.tab_type}:`, {
          tab_type: updateData.tab_type,
          locked_model: updateData.locked_model,
          selected_model: updateData.selected_model,
          is_locked: updateData.is_locked,
        })
        
        const result = await AISettingsService.upsertTabSetting(updateData)
        console.log(`Database result for ${setting.tab_type}:`, result)
      }
      
      console.log('=== SAVE COMPLETE ===')
      setHasChanges(false)
      toast({
        title: "Settings Saved",
        description: "Your AI preferences have been updated successfully.",
        variant: "default",
      })
    } catch (error) {
      console.error('Error saving AI settings:', error)
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save AI settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Reset to defaults (system-wide)
  const handleResetDefaults = async () => {
    if (!ready) return
    
    try {
      setLoading(true)
      const defaultSettings = await AISettingsService.initializeSystemSettings()
      setSettings(defaultSettings)
      setHasChanges(false)
      
      toast({
        title: "Settings Reset",
        description: "AI settings have been reset to defaults.",
        variant: "default",
      })
    } catch (error) {
      console.error('Error resetting AI settings:', error)
      toast({
        title: "Reset Failed",
        description: "Failed to reset AI settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Test database connection
  const testDatabase = async () => {
    if (!userId) return
    
    try {
      console.log('Testing database connection...')
      
      // Try to fetch current settings
      const currentSettings = await AISettingsService.getSystemSettings()
      console.log('Current settings from DB:', currentSettings)
      
      // Try to update one setting
      const testSetting: AISettingUpdate = {
        tab_type: 'scripts',
        locked_model: 'ChatGPT',
        is_locked: true,
      }
      
      console.log('Testing update with:', testSetting)
              const result = await AISettingsService.upsertTabSetting(testSetting)
      console.log('Test update result:', result)
      
      toast({
        title: "Database Test",
        description: "Database connection test completed. Check console for details.",
        variant: "default",
      })
    } catch (error) {
      console.error('Database test failed:', error)
      toast({
        title: "Database Test Failed",
        description: error instanceof Error ? error.message : "Database connection test failed.",
        variant: "destructive",
      })
    }
  }

  // Debug current state
  console.log('🔍 Settings-ai page state:', {
    isCheckingRole,
    isCEO,
    userRole,
    isPasswordProtected,
    hasAccess,
    ready,
    userId
  })

  // Show loading state while checking CEO role
  if (!ready || isCheckingRole) {
    console.log('🔍 Still loading - checking CEO role')
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-4xl px-6 py-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-blue-500 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Verifying Access...</h1>
            <p className="text-muted-foreground mb-6">
              Checking user permissions
            </p>
          </div>
        </main>
      </div>
    )
  }

  // If not CEO, don't render (redirect happens in useEffect)
  if (!isCEO) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-4xl px-6 py-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">
              This page is restricted to CEO users only.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // Show loading state while checking password protection (only if CEO)
  if (isPasswordProtected === undefined) {
    console.log('🔍 Still loading - checking password protection status')
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-4xl px-6 py-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Loading...</h1>
            <p className="text-muted-foreground mb-6">
              Checking password protection status
            </p>
          </div>
        </main>
      </div>
    )
  }

  // Show password prompt if protected and no access (only shown to CEOs)
  if (isPasswordProtected && !hasAccess) {
    console.log('🔒 Showing password prompt - page is protected and user has no access')
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-4xl px-6 py-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">AI Settings Protected</h1>
            <p className="text-muted-foreground mb-6">
              Enter the settings password to access AI configuration
            </p>
            
            <div className="max-w-md mx-auto space-y-4">
              <div>
                <Label htmlFor="ai-settings-password">Settings Password</Label>
                <Input
                  id="ai-settings-password"
                  type="password"
                  value={passwordInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordInput(e.target.value)}
                  placeholder="Enter password"
                  className="mt-1"
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      verifyPassword(passwordInput)
                    }
                  }}
                />
                {passwordError && (
                  <p className="text-red-500 text-sm mt-1">{passwordError}</p>
                )}
              </div>
              
              <Button 
                onClick={() => verifyPassword(passwordInput)}
                disabled={!passwordInput.trim()}
                className="w-full"
              >
                <Unlock className="h-4 w-4 mr-2" />
                Access AI Settings
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-4xl px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading AI settings...</span>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-4xl px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              AI Studio Settings
            </h1>
            <Badge variant="outline" className="text-xs">
              CEO Only
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Configure system-wide AI models and lock them for each generation tab (applies to all users)
          </p>
        </div>

        {/* Settings Cards */}
        <div className="space-y-6">
          {settings.map((setting) => {
            const IconComponent = tabIcons[setting.tab_type]
            const modelAvailability = checkModelAvailability(setting.tab_type, setting.locked_model)
            
            return (
              <Card key={`${setting.tab_type}-${setting.id}`} className="cinema-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{tabNames[setting.tab_type]}</CardTitle>
                        <CardDescription>
                          Configure AI model preferences for {setting.tab_type} generation
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {setting.is_locked ? (
                        <Badge variant="default" className="bg-green-500">
                          <Lock className="h-3 w-3 mr-1" />
                          Locked
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Unlock className="h-3 w-3 mr-1" />
                          Unlocked
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Model Selection */}
                  <div className="grid gap-2">
                    <Label>Preferred AI Model</Label>
                    <Select 
                      value={setting.locked_model} 
                      onValueChange={(value) => handleSettingChange(setting.tab_type, 'locked_model', value)}
                      disabled={setting.is_locked}
                    >
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        {aiModels[setting.tab_type].map((model) => {
                          const availability = checkModelAvailability(setting.tab_type, model)
                          return (
                            <SelectItem key={model} value={model} disabled={!availability.isReady}>
                              <div className="flex items-center justify-between w-full">
                                <span>{model}</span>
                                <Badge 
                                  variant={availability.isReady ? "default" : "secondary"} 
                                  className="text-xs ml-2"
                                >
                                  {availability.statusText}
                                </Badge>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    
                    {/* API Key Warning */}
                    {!modelAvailability.isReady && (
                      <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                        <p className="text-sm text-orange-600 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          {modelAvailability.statusText}. 
                          <a href="/setup-ai" className="underline">Configure API key</a>
                        </p>
                      </div>
                    )}

                    {/* LLM Model Selection for Scripts */}
                    {setting.tab_type === 'scripts' && (setting.locked_model === 'ChatGPT' || setting.locked_model === 'GPT-4' || setting.locked_model === 'Claude') && (
                      <div className="grid gap-2 mt-4">
                        <Label>LLM Model</Label>
                        <Select 
                          value={setting.selected_model || ''} 
                          onValueChange={(value) => handleSettingChange(setting.tab_type, 'selected_model', value)}
                          disabled={setting.is_locked}
                        >
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue placeholder="Select LLM model" />
                          </SelectTrigger>
                          <SelectContent className="cinema-card border-border">
                            {(setting.locked_model === 'ChatGPT' || setting.locked_model === 'GPT-4' ? OPENAI_MODELS : ANTHROPIC_MODELS).map((model) => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Select the specific {setting.locked_model === 'ChatGPT' || setting.locked_model === 'GPT-4' ? 'OpenAI' : 'Anthropic'} model to use for script generation
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Lock Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor={`lock-${setting.tab_type}`}>Lock Model Selection</Label>
                      <p className="text-sm text-muted-foreground">
                        When locked, the AI model dropdown will be hidden in the {setting.tab_type} tab
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {setting.is_locked ? 'Locked' : 'Unlocked'}
                      </span>
                      <Switch
                        id={`lock-${setting.tab_type}`}
                        checked={setting.is_locked}
                        onCheckedChange={(checked) => {
                          console.log(`Switch toggled for ${setting.tab_type}: ${checked}`)
                          console.log(`Switch checked value type: ${typeof checked}, value: ${checked}`)
                          handleSettingChange(setting.tab_type, 'is_locked', checked)
                        }}
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <p className="text-sm font-medium mb-2">Preview:</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">AI Model:</span>
                        {setting.is_locked ? (
                          <Badge variant="outline" className="bg-green-500/20 text-green-600 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {setting.locked_model}
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            {setting.locked_model}
                          </Badge>
                        )}
                      </div>
                      {setting.tab_type === 'scripts' && setting.selected_model && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">LLM Model:</span>
                          <Badge variant="outline" className="text-xs">
                            {setting.selected_model}
                          </Badge>
                        </div>
                      )}
                      {/* Debug info */}
                      <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded border">
                        <div>Current State: is_locked = {setting.is_locked.toString()}</div>
                        <div>Model: {setting.locked_model}</div>
                        {setting.selected_model && (
                          <div>Selected Model: {setting.selected_model}</div>
                        )}
                        <div>Tab: {setting.tab_type}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="flex items-center gap-4">
            {hasChanges && (
              <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">You have unsaved changes</span>
              </div>
            )}
            <Button onClick={testDatabase} variant="outline" size="sm" className="text-xs">Test DB</Button>
          </div>
          
          <div className="flex items-center gap-3">
            <Button onClick={handleResetDefaults} disabled={loading} variant="outline">
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Reset to Defaults
            </Button>
            
            <Button onClick={handleSaveSettings} disabled={!hasChanges || saving} className={`gradient-button text-white ${hasChanges ? 'ring-2 ring-orange-500 ring-offset-2' : ''}`}>
              {saving ? (<RefreshCw className="mr-2 h-4 w-4 animate-spin" />) : (<Save className="mr-2 h-4 w-4" />)}
              {saving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
            </Button>
          </div>
        </div>

        {/* Info Section */}
        <Card className="mt-8 cinema-card">
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <p>
                <strong>Locked Models:</strong> When you lock a model for a tab, the AI model selection dropdown 
                will be hidden in that tab, and the system will automatically use your preferred model.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <p>
                <strong>Unlocked Models:</strong> When unlocked, you can still see and change the AI model 
                selection in the respective tab.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <p>
                <strong>API Key Requirements:</strong> Make sure you have the necessary API keys configured 
                for your preferred models in the <a href="/setup-ai" className="text-primary underline">AI Setup</a> page.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Setup Instructions */}
        <Card className="mt-4 cinema-card border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="text-lg text-orange-800">Database Setup Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-orange-700">
            <p>
              If you're seeing errors or the settings aren't saving, you may need to create the database table first.
            </p>
            <div className="space-y-2">
              <p className="font-medium">To set up the database:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">Supabase Dashboard</a></li>
                <li>Navigate to your project</li>
                <li>Go to <strong>SQL Editor</strong></li>
                <li>Copy and paste the contents of <code className="bg-orange-100 px-1 rounded">supabase/run-ai-settings-migration.sql</code></li>
                <li>Click <strong>Run</strong> to execute the script</li>
                <li>Refresh this page</li>
              </ol>
            </div>
            <div className="mt-4 p-3 bg-orange-100 rounded border border-orange-200">
              <p className="font-medium">Quick Test:</p>
              <p>Click the "Test DB" button above to check if the database is properly configured.</p>
            </div>
          </CardContent>
        </Card>

        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <div className="text-center mb-6">
                <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-blue-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">Enter Password</h2>
                <p className="text-muted-foreground">
                  Enter your settings password to continue
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="modal-password">Password</Label>
                  <Input
                    id="modal-password"
                    type="password"
                    value={passwordInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordInput(e.target.value)}
                    placeholder="Enter password"
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        verifyPassword(passwordInput)
                      }
                    }}
                  />
                  {passwordError && (
                    <p className="text-red-500 text-sm mt-1">{passwordError}</p>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => verifyPassword(passwordInput)}
                    disabled={!passwordInput.trim()}
                    className="flex-1"
                  >
                    <Unlock className="h-4 w-4 mr-2" />
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
