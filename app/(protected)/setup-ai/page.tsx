"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, AlertCircle, Key, Eye, EyeOff, Bot, Sparkles, ImageIcon, FileText, Video, Music, Shield, Unlock } from "lucide-react"
import { OpenAIService } from "@/lib/openai-service"
import { useAuthReady } from "@/components/auth-hooks"
import { getSupabaseClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function SetupAIPage() {
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  
  // Debug: Log what's available in the auth object
  console.log('Auth object:', { user, userId, ready })
  
  // Password protection state
  const [isPasswordProtected, setIsPasswordProtected] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    anthropic: '',
    openart: '',
    kling: '',
    runway: '',
    elevenlabs: '',
    suno: '',
  })
  const [showKeys, setShowKeys] = useState({
    openai: false,
    anthropic: false,
    openart: false,
    kling: false,
    runway: false,
    elevenlabs: false,
    suno: false,
  })


  // Load API keys from database
  const loadApiKeys = async () => {
    if (!userId) return
    
    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key, anthropic_api_key, openart_api_key, kling_api_key, runway_api_key, elevenlabs_api_key, suno_api_key')
        .eq('id', userId)
        .single()

      if (error) throw error
      
      setApiKeys({
        openai: data?.openai_api_key || '',
        anthropic: data?.anthropic_api_key || '',
        openart: data?.openart_api_key || '',
        kling: data?.kling_api_key || '',
        runway: data?.runway_api_key || '',
        elevenlabs: data?.elevenlabs_api_key || '',
        suno: data?.suno_api_key || '',
      })
    } catch (error) {
      console.error('Error loading API keys:', error)
    }
  }

  // Save API key to database
  const saveApiKey = async (service: string, apiKey: string) => {
    if (!userId) return
    
    try {
      const serviceMapping: { [key: string]: string } = {
        'openai': 'openai_api_key',
        'anthropic': 'anthropic_api_key',
        'openart': 'openart_api_key',
        'kling': 'kling_api_key',
        'runway': 'runway_api_key',
        'elevenlabs': 'elevenlabs_api_key',
        'suno': 'suno_api_key',
      }
      
      const dbColumn = serviceMapping[service]
      if (!dbColumn) {
        throw new Error(`Unsupported service: ${service}`)
      }
      
      const updateData: any = {}
      updateData[dbColumn] = apiKey

      const { error } = await getSupabaseClient()
        .from('users')
        .update(updateData)
        .eq('id', userId)

      if (error) throw error
      
      // Update local state
      setApiKeys(prev => ({ ...prev, [service]: apiKey }))
      
      return true
    } catch (error) {
      console.error('Error saving API key:', error)
      throw error
    }
  }



  // Check if settings are password protected
  useEffect(() => {
    if (!ready || !userId) return;
    
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
          // Check if user already has access from session storage
          const hasAccess = sessionStorage.getItem('ai-setup-access') === 'true'
          console.log('🔒 Password protected - checking session storage access:', hasAccess)
          setHasAccess(hasAccess)
        }
      } catch (error) {
        console.error('Error checking password protection:', error)
        // Default to no protection on error
        setIsPasswordProtected(false)
        setHasAccess(true)
      }
    }
    
    checkPasswordProtection()
  }, [ready, userId])

  // Load API keys when component mounts
  useEffect(() => {
    if (ready && userId) {
      loadApiKeys()
    }
  }, [ready, userId])

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
        sessionStorage.setItem('ai-setup-access', 'true')
        setShowPasswordModal(false)
        setPasswordInput('')
        setPasswordError('')
      } else {
        console.log('🔐 Password incorrect')
        setPasswordError('Incorrect password')
      }
    } catch (error) {
      console.error('Error verifying password:', error)
      setPasswordError('Error verifying password')
    }
  }



  // Debug current state
  console.log('🔍 Setup-ai page state:', {
    isPasswordProtected,
    hasAccess,
    ready,
    userId
  })

  // Show loading state while checking password protection
  if (!ready || (isPasswordProtected === undefined)) {
    console.log('🔍 Still loading - showing loading state')
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-7xl px-6 py-8">
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

  // Show password prompt if protected and no access
  if (isPasswordProtected && !hasAccess) {
    console.log('🔒 Showing password prompt - page is protected and user has no access')
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-7xl px-6 py-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">AI Setup Protected</h1>
            <p className="text-muted-foreground mb-6">
              Enter the settings password to access AI configuration
            </p>
            
            <div className="max-w-md mx-auto space-y-4">
              <div>
                <Label htmlFor="ai-setup-password">Settings Password</Label>
                <Input
                  id="ai-setup-password"
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
                Access AI Setup
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
            AI Setup & Configuration
          </h1>
          <p className="text-muted-foreground">Configure your AI services and API keys for content generation</p>
        </div>

        {/* AI Services Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="cinema-card hover:neon-glow transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="p-3 rounded-lg bg-blue-500/10 w-fit">
                <FileText className="h-6 w-6 text-blue-500" />
              </div>
              <CardTitle className="text-lg">Script Generation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                Generate scripts with ChatGPT & Claude
              </CardDescription>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">ChatGPT Ready</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">Claude Ready</span>
              </div>
            </CardContent>
          </Card>

          <Card className="cinema-card hover:neon-glow transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="p-3 rounded-lg bg-cyan-500/10 w-fit">
                <ImageIcon className="h-6 w-6 text-cyan-500" />
              </div>
              <CardTitle className="text-lg">Image Generation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                Create visuals with OpenArt & DALL-E
              </CardDescription>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">OpenArt Ready</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">DALL-E Ready</span>
              </div>
            </CardContent>
          </Card>

          <Card className="cinema-card hover:neon-glow transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="p-3 rounded-lg bg-purple-500/10 w-fit">
                <Video className="h-6 w-6 text-purple-500" />
              </div>
              <CardTitle className="text-lg">Video Generation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                Generate videos with Kling & Runway ML
              </CardDescription>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">Kling Ready</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">Runway ML Ready</span>
              </div>
            </CardContent>
          </Card>

          <Card className="cinema-card hover:neon-glow transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="p-3 rounded-lg bg-green-500/10 w-fit">
                <Music className="h-6 w-6 text-green-500" />
              </div>
              <CardTitle className="text-lg">Audio Generation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                Create music, voice, and sound effects with AI
              </CardDescription>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">ElevenLabs Ready</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">Suno AI Ready</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Setup Tabs */}
        <Tabs defaultValue="openai" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 bg-muted/50">
            <TabsTrigger value="openai" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              OpenAI Setup
            </TabsTrigger>
            <TabsTrigger value="other" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Other AI Services
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              All API Keys
            </TabsTrigger>
          </TabsList>

          {/* OpenAI Setup */}
          <TabsContent value="openai" className="space-y-6">
            <Card className="cinema-card border-blue-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-500">
                  <Key className="h-5 w-5" />
                  OpenAI API Key
                </CardTitle>
                <CardDescription>
                  Add your OpenAI API key to use ChatGPT for scripts and DALL-E for images
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-api-key">OpenAI API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="openai-api-key"
                      type={showKeys.openai ? "text" : "password"}
                      value={apiKeys.openai}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                      placeholder="sk-..."
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, openai: !prev.openai }))}
                      className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10"
                    >
                      {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await saveApiKey('openai', apiKeys.openai)
                          toast({
                            title: "Success",
                            description: "OpenAI API key saved successfully",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to save OpenAI API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-green-500/20 text-green-500 hover:bg-green-500/10"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setApiKeys(prev => ({ ...prev, openai: '' }))
                        try {
                          await saveApiKey('openai', '')
                          toast({
                            title: "Cleared",
                            description: "OpenAI API key cleared",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to clear OpenAI API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenAI Platform</a></p>
                  <p>• Your API key is stored locally and never shared</p>
                  <p>• You'll be charged by OpenAI based on your usage</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Other AI Services */}
          <TabsContent value="other" className="space-y-6">
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Additional AI Services
                </CardTitle>
                <CardDescription>
                  Configure other AI services for enhanced content generation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Claude</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Advanced text generation and analysis by Anthropic
                    </p>
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Kling</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      High-quality AI video generation
                    </p>
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">OpenArt</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      AI image generation with multiple models
                    </p>
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Runway ML</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      AI-powered video generation and editing
                    </p>
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">ElevenLabs</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      AI voice generation and text-to-speech
                    </p>
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Suno AI</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      AI music generation and audio creation
                    </p>
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Udio</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      AI music composition and generation
                    </p>
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Midjourney</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      High-quality image generation with artistic styles
                    </p>
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* All API Keys Setup */}
          <TabsContent value="all" className="space-y-6">
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-blue-500" />
                  Configure All AI Services
                </CardTitle>
                <CardDescription>
                  Set up API keys for all AI services to unlock full functionality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* OpenAI */}
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">OpenAI (ChatGPT & DALL-E)</h4>
                    <Badge variant="outline" className="text-xs">
                      {apiKeys.openai ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Generate scripts with ChatGPT and images with DALL-E
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={apiKeys.openai}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setApiKeys(prev => ({ ...prev, openai: '' }))
                        try {
                          await saveApiKey('openai', '')
                          toast({
                            title: "Cleared",
                            description: "OpenAI API key cleared",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to clear OpenAI API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Anthropic */}
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Anthropic (Claude)</h4>
                    <Badge variant="outline" className="text-xs">
                      {apiKeys.anthropic ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Advanced text generation and analysis with Claude
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.anthropic ? "text" : "password"}
                      placeholder="sk-ant-..."
                      value={apiKeys.anthropic}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, anthropic: e.target.value }))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, anthropic: !prev.anthropic }))}
                      className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10"
                    >
                      {showKeys.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await saveApiKey('anthropic', apiKeys.anthropic)
                          toast({
                            title: "Success",
                            description: "Anthropic API key saved successfully",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to save Anthropic API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-green-500/20 text-green-500 hover:bg-blue-500/10"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setApiKeys(prev => ({ ...prev, anthropic: '' }))
                        try {
                          await saveApiKey('anthropic', '')
                          toast({
                            title: "Cleared",
                            description: "Anthropic API key cleared",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to clear Anthropic API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* OpenArt */}
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">OpenArt</h4>
                    <Badge variant="outline" className="text-xs">
                      {apiKeys.openart ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    AI image generation with multiple models
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.openart ? "text" : "password"}
                      placeholder="OpenArt API Key"
                      value={apiKeys.openart}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, openart: e.target.value }))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, openart: !prev.openart }))}
                      className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10"
                    >
                      {showKeys.openart ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await saveApiKey('openart', apiKeys.openart)
                          toast({
                            title: "Success",
                            description: "OpenArt API key saved successfully",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to save OpenArt API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-green-500/20 text-green-500 hover:bg-blue-500/10"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setApiKeys(prev => ({ ...prev, openart: '' }))
                        try {
                          await saveApiKey('openart', '')
                          toast({
                            title: "Cleared",
                            description: "OpenArt API key cleared",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to clear OpenArt API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Kling */}
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Kling</h4>
                    <Badge variant="outline" className="text-xs">
                      {apiKeys.kling ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    High-quality AI video generation
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.kling ? "text" : "password"}
                      placeholder="Kling API Key"
                      value={apiKeys.kling}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, kling: e.target.value }))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, kling: !prev.kling }))}
                      className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10"
                    >
                      {showKeys.kling ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await saveApiKey('kling', apiKeys.kling)
                          toast({
                            title: "Success",
                            description: "Kling API key saved successfully",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to save Kling API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-green-500/20 text-green-500 hover:bg-blue-500/10"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setApiKeys(prev => ({ ...prev, kling: '' }))
                        try {
                          await saveApiKey('kling', '')
                          toast({
                            title: "Cleared",
                            description: "Kling API key cleared",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to clear Kling API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Runway ML */}
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Runway ML</h4>
                    <Badge variant="outline" className="text-xs">
                      {apiKeys.runway ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    AI-powered video generation and editing
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.runway ? "text" : "password"}
                      placeholder="Runway ML API Key"
                      value={apiKeys.runway}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, runway: e.target.value }))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, runway: !prev.runway }))}
                      className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10"
                    >
                      {showKeys.runway ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await saveApiKey('runway', apiKeys.runway)
                          toast({
                            title: "Success",
                            description: "Runway ML API key saved successfully",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to save Runway ML API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-green-500/20 text-green-500 hover:bg-blue-500/10"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setApiKeys(prev => ({ ...prev, runway: '' }))
                        try {
                          await saveApiKey('runway', '')
                          toast({
                            title: "Cleared",
                            description: "Runway ML API key cleared",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to clear Runway ML API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* ElevenLabs */}
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">ElevenLabs</h4>
                    <Badge variant="outline" className="text-xs">
                      {apiKeys.elevenlabs ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    AI voice generation and text-to-speech
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.elevenlabs ? "text" : "password"}
                      placeholder="ElevenLabs API Key"
                      value={apiKeys.elevenlabs}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, elevenlabs: e.target.value }))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, elevenlabs: !prev.elevenlabs }))}
                      className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10"
                    >
                      {showKeys.elevenlabs ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await saveApiKey('elevenlabs', apiKeys.elevenlabs)
                          toast({
                            title: "Success",
                            description: "ElevenLabs API key saved successfully",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to save ElevenLabs API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-green-500/20 text-green-500 hover:bg-green-500/10"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setApiKeys(prev => ({ ...prev, elevenlabs: '' }))
                        try {
                          await saveApiKey('elevenlabs', '')
                          toast({
                            title: "Cleared",
                            description: "ElevenLabs API key cleared",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to clear ElevenLabs API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Suno AI */}
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Suno AI</h4>
                    <Badge variant="outline" className="text-xs">
                      {apiKeys.suno ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    AI music generation and audio creation
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.suno ? "text" : "password"}
                      placeholder="Suno AI API Key"
                      value={apiKeys.suno}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, suno: e.target.value }))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, suno: !prev.suno }))}
                      className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10"
                    >
                      {showKeys.suno ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await saveApiKey('suno', apiKeys.suno)
                          toast({
                            title: "Success",
                            description: "Suno AI API key saved successfully",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to save Suno AI API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-green-500/20 text-green-500 hover:bg-blue-500/10"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setApiKeys(prev => ({ ...prev, suno: '' }))
                        try {
                          await saveApiKey('suno', '')
                          toast({
                            title: "Cleared",
                            description: "Suno AI API key cleared",
                          })
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to clear Suno AI API key",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• All API keys are stored locally and never shared</p>
                  <p>• You'll be charged by each service based on your usage</p>
                  <p>• Configure the services you want to use - you don't need all of them</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
