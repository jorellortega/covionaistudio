"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context-fixed"
import { AISettingsService, AISetting, AISettingUpdate } from "@/lib/ai-settings-service"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
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
  images: ["OpenArt", "DALL-E 3", "Midjourney", "Stable Diffusion", "Custom"],
  videos: ["Kling", "Runway ML", "Pika Labs", "Stable Video", "LumaAI"],
  audio: ["ElevenLabs", "Suno AI", "Udio", "MusicLM", "AudioCraft", "Custom"],
}

const tabIcons = {
  scripts: FileText,
  images: ImageIcon,
  videos: Video,
  audio: Sparkles,
}

const tabNames = {
  scripts: "Scripts",
  images: "Images", 
  videos: "Videos",
  audio: "Audio",
}

export default function AISettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [settings, setSettings] = useState<AISetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Password protection state
  const [isPasswordProtected, setIsPasswordProtected] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Check if settings are password protected
  useEffect(() => {
    if (user?.settings_password_enabled) {
      setIsPasswordProtected(true)
      // Check if user already has access (from session storage)
      const hasAccessFromStorage = sessionStorage.getItem('ai-settings-access')
      if (hasAccessFromStorage === 'true') {
        setHasAccess(true)
      }
    } else {
      setIsPasswordProtected(false)
      setHasAccess(true)
    }
  }, [user])

  // Password verification
  const verifyPassword = async (password: string) => {
    try {
      if (password === user?.settings_password_hash) {
        setHasAccess(true)
        sessionStorage.setItem('ai-settings-access', 'true')
        setShowPasswordModal(false)
        setPasswordInput('')
        setPasswordError('')
        toast({
          title: "Access Granted",
          description: "You can now access the AI settings page",
        })
      } else {
        setPasswordError('Incorrect password')
      }
    } catch (error) {
      setPasswordError('Error verifying password')
    }
  }

  // Load user's AI settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return
      
      try {
        setLoading(true)
        let userSettings = await AISettingsService.getUserSettings(user.id)
        
        // If no settings exist, initialize with defaults
        if (userSettings.length === 0) {
          console.log('No settings found, initializing defaults...')
          try {
            userSettings = await AISettingsService.initializeUserSettings(user.id)
            console.log('Default settings initialized:', userSettings)
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
        
        setSettings(userSettings)
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
  }, [user, toast])

  // Check if user has required API keys for selected models
  const checkModelAvailability = (tabType: string, model: string) => {
    if (!user) return { isReady: false, statusText: "Not logged in" }
    
    switch (tabType) {
      case 'scripts':
        if (model === "ChatGPT") {
          return { 
            isReady: !!user.openaiApiKey, 
            statusText: !!user.openaiApiKey ? "Ready" : "OpenAI API Key Required" 
          }
        } else if (model === "Claude") {
          return { 
            isReady: !!user.anthropicApiKey, 
            statusText: !!user.anthropicApiKey ? "Ready" : "Anthropic API Key Required" 
          }
        }
        break
      case 'images':
        if (model === "DALL-E 3") {
          return { 
            isReady: !!user.openaiApiKey, 
            statusText: !!user.openaiApiKey ? "Ready" : "OpenAI API Key Required" 
          }
        } else if (model === "OpenArt") {
          return { 
            isReady: !!user.openartApiKey, 
            statusText: !!user.openartApiKey ? "Ready" : "OpenArt API Key Required" 
          }
        }
        break
      case 'videos':
        if (model === "Runway ML") {
          return { 
            isReady: !!user.runwayApiKey, 
            statusText: !!user.runwayApiKey ? "Ready" : "Runway ML API Key Required" 
          }
        } else if (model === "Kling") {
          return { 
            isReady: !!user.klingApiKey, 
            statusText: !!user.klingApiKey ? "Ready" : "Kling API Key Required" 
          }
        }
        break
      case 'audio':
        if (model === "ElevenLabs") {
          return { 
            isReady: !!user.elevenlabsApiKey, 
            statusText: !!user.elevenlabsApiKey ? "Ready" : "ElevenLabs API Key Required" 
          }
        } else if (model === "Suno AI") {
          return { 
            isReady: !!user.sunoApiKey, 
            statusText: !!user.sunoApiKey ? "Ready" : "Suno AI API Key Required" 
          }
        }
        break
    }
    
    return { isReady: true, statusText: "Ready" }
  }

  // Handle setting changes
  const handleSettingChange = (tabType: 'scripts' | 'images' | 'videos' | 'audio', field: 'locked_model' | 'is_locked', value: string | boolean) => {
    console.log(`Setting change: ${tabType}.${field} = ${value}`)
    
    setSettings(prev => {
      const newSettings = prev.map(setting => 
        setting.tab_type === tabType 
          ? { ...setting, [field]: value }
          : setting
      )
      
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
      if (user) {
        const updateData: AISettingUpdate = {
          tab_type: tabType,
          locked_model: field === 'is_locked' ? 
            (settings.find(s => s.tab_type === tabType)?.locked_model || 'ChatGPT') : 
            value as string,
          is_locked: field === 'is_locked' ? value as boolean : 
            settings.find(s => s.tab_type === tabType)?.is_locked || false,
        }
        
        console.log(`Auto-saving ${tabType}:`, updateData)
        AISettingsService.upsertTabSetting(user.id, updateData)
          .then(result => {
            console.log(`Auto-save successful for ${tabType}:`, result)
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

  // Save all settings
  const handleSaveSettings = async () => {
    if (!user) return
    
    try {
      setSaving(true)
      console.log('=== SAVE DEBUG ===')
      console.log('Current settings state:', settings)
      console.log('Settings that will be saved:')
      
      // Update all settings
      for (const setting of settings) {
        const updateData: AISettingUpdate = {
          tab_type: setting.tab_type,
          locked_model: setting.locked_model,
          is_locked: setting.is_locked,
        }
        
        console.log(`Saving ${setting.tab_type}:`, {
          tab_type: updateData.tab_type,
          locked_model: updateData.locked_model,
          is_locked: updateData.is_locked,
          is_locked_type: typeof updateData.is_locked,
          is_locked_value: updateData.is_locked
        })
        
        const result = await AISettingsService.upsertTabSetting(user.id, updateData)
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

  // Reset to defaults
  const handleResetDefaults = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      const defaultSettings = await AISettingsService.initializeUserSettings(user.id)
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
    if (!user) return
    
    try {
      console.log('Testing database connection...')
      
      // Try to fetch current settings
      const currentSettings = await AISettingsService.getUserSettings(user.id)
      console.log('Current settings from DB:', currentSettings)
      
      // Try to update one setting
      const testSetting: AISettingUpdate = {
        tab_type: 'scripts',
        locked_model: 'ChatGPT',
        is_locked: true,
      }
      
      console.log('Testing update with:', testSetting)
      const result = await AISettingsService.upsertTabSetting(user.id, testSetting)
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

  // Show password prompt if protected and no access
  if (isPasswordProtected && !hasAccess) {
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
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Settings className="h-8 w-8" />
            AI Studio Settings
          </h1>
          <p className="text-muted-foreground">
            Configure your preferred AI models and lock them for each generation tab
          </p>
        </div>

        {/* Settings Cards */}
        <div className="space-y-6">
          {settings.map((setting) => {
            const IconComponent = tabIcons[setting.tab_type]
            const modelAvailability = checkModelAvailability(setting.tab_type, setting.locked_model)
            
            return (
              <Card key={setting.id} className="cinema-card">
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
                            {setting.locked_model} (Hidden)
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            {setting.locked_model} (Visible)
                          </Badge>
                        )}
                      </div>
                      {/* Debug info */}
                      <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded border">
                        <div>Current State: is_locked = {setting.is_locked.toString()}</div>
                        <div>Model: {setting.locked_model}</div>
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
      </main>
    </div>
  )
}
