"use client"

import { useState } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, AlertCircle, Key, Eye, EyeOff, Bot, Sparkles, ImageIcon, FileText, Video, Music } from "lucide-react"
import { OpenAIService } from "@/lib/openai-service"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"

export default function SetupAIPage() {
  const { user, updateApiKey } = useAuth()
  const [apiKey, setApiKey] = useState(user?.openaiApiKey || "")
  const [showKey, setShowKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean
    message: string
  } | null>(null)

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setValidationResult({
        isValid: false,
        message: "Please enter your OpenAI API key"
      })
      return
    }

    setIsValidating(true)
    setValidationResult(null)

    try {
      const isValid = await OpenAIService.validateApiKey(apiKey)
      
      if (isValid) {
        await updateApiKey(apiKey)
        setValidationResult({
          isValid: true,
          message: "API key saved successfully! You can now use ChatGPT and DALL-E in the AI Studio."
        })
      } else {
        setValidationResult({
          isValid: false,
          message: "Invalid API key. Please check your key and try again."
        })
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        message: "Error validating API key. Please try again."
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleRemoveApiKey = async () => {
    await updateApiKey("")
    setApiKey("")
    setValidationResult(null)
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
            {user?.openaiApiKey ? (
              <Card className="cinema-card border-green-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="h-5 w-5" />
                    OpenAI API Key Configured
                  </CardTitle>
                  <CardDescription>
                    You can now use ChatGPT for scripts and DALL-E for images in the AI Studio
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      API Key: {showKey ? user.openaiApiKey : "••••••••••••••••"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowKey(!showKey)}
                      className="h-6 w-6 p-0"
                    >
                      {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleRemoveApiKey}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10"
                    >
                      Remove API Key
                    </Button>
                    <Link href="/ai-studio">
                      <Button className="gradient-button text-white">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Go to AI Studio
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="cinema-card border-blue-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-500">
                    <Key className="h-5 w-5" />
                    Set Up OpenAI API Key
                  </CardTitle>
                  <CardDescription>
                    Add your OpenAI API key to use ChatGPT for scripts and DALL-E for images
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-key">OpenAI API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="api-key"
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowKey(!showKey)}
                        className="px-3"
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {validationResult && (
                    <Alert className={validationResult.isValid ? "border-green-500/20" : "border-red-500/20"}>
                      {validationResult.isValid ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <AlertDescription className={validationResult.isValid ? "text-green-500" : "text-red-500"}>
                        {validationResult.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveApiKey}
                      disabled={isValidating || !apiKey.trim()}
                      className="gradient-button text-white"
                    >
                      {isValidating ? "Validating..." : "Save API Key"}
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenAI Platform</a></p>
                    <p>• Your API key is stored locally and never shared</p>
                    <p>• You'll be charged by OpenAI based on your usage</p>
                  </div>
                </CardContent>
              </Card>
            )}
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
                      {user?.openaiApiKey ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Generate scripts with ChatGPT and images with DALL-E
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={user?.openaiApiKey || ""}
                      onChange={(e) => updateApiKey(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateApiKey("")}
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
                      {user?.anthropicApiKey ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Advanced text generation and analysis with Claude
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="sk-ant-..."
                      value={user?.anthropicApiKey || ""}
                      onChange={(e) => updateServiceApiKey("anthropic", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateServiceApiKey("anthropic", "")}
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
                      {user?.openartApiKey ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    AI image generation with multiple models
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="OpenArt API Key"
                      value={user?.openartApiKey || ""}
                      onChange={(e) => updateServiceApiKey("openart", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateServiceApiKey("openart", "")}
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
                      {user?.klingApiKey ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    High-quality AI video generation
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Kling API Key"
                      value={user?.klingApiKey || ""}
                      onChange={(e) => updateServiceApiKey("kling", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateServiceApiKey("kling", "")}
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
                      {user?.runwayApiKey ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    AI-powered video generation and editing
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Runway ML API Key"
                      value={user?.runwayApiKey || ""}
                      onChange={(e) => updateServiceApiKey("runway", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateServiceApiKey("runway", "")}
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
                      {user?.elevenlabsApiKey ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    AI voice generation and text-to-speech
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="ElevenLabs API Key"
                      value={user?.elevenlabsApiKey || ""}
                      onChange={(e) => updateServiceApiKey("elevenlabs", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateServiceApiKey("elevenlabs", "")}
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
                      {user?.sunoApiKey ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    AI music generation and audio creation
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Suno AI API Key"
                      value={user?.sunoApiKey || ""}
                      onChange={(e) => updateServiceApiKey("suno", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateServiceApiKey("suno", "")}
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
