"use client"

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context-fixed'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { LogOut, User, Key, Save, Settings } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const { user, signOut, updateServiceApiKey } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [apiKeys, setApiKeys] = useState({
    openai: user?.openaiApiKey || '',
    anthropic: user?.anthropicApiKey || '',
    openart: user?.openartApiKey || '',
    kling: user?.klingApiKey || '',
    runway: user?.runwayApiKey || '',
    elevenlabs: user?.elevenlabsApiKey || '',
    suno: user?.sunoApiKey || '',
  })

  const handleApiKeyUpdate = async (service: string, apiKey: string) => {
    setIsLoading(true)
    try {
      await updateServiceApiKey(service, apiKey)
      toast({
        title: "Success",
        description: `${service} API key updated successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update ${service} API key`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      })
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Please log in to access settings</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>
        <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your basic account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={user.name} disabled />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email} disabled />
              </div>
            </div>
            <div>
              <Label htmlFor="created">Member Since</Label>
              <Input 
                id="created" 
                value={user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'} 
                disabled 
              />
            </div>
          </CardContent>
        </Card>

        {/* API Keys Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Manage your API keys for various services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="openai">OpenAI API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="openai"
                    type="password"
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                    placeholder="sk-..."
                  />
                  <Button
                    size="sm"
                    onClick={() => handleApiKeyUpdate('openai', apiKeys.openai)}
                    disabled={isLoading}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="anthropic">Anthropic API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="anthropic"
                    type="password"
                    value={apiKeys.anthropic}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, anthropic: e.target.value }))}
                    placeholder="sk-ant-..."
                  />
                  <Button
                    size="sm"
                    onClick={() => handleApiKeyUpdate('anthropic', apiKeys.anthropic)}
                    disabled={isLoading}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openart">OpenArt API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="openart"
                    type="password"
                    value={apiKeys.openart}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, openart: e.target.value }))}
                    placeholder="Enter your OpenArt API key"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleApiKeyUpdate('openart', apiKeys.openart)}
                    disabled={isLoading}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kling">Kling API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="kling"
                    type="password"
                    value={apiKeys.kling}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, kling: e.target.value }))}
                    placeholder="Enter your Kling API key"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleApiKeyUpdate('kling', apiKeys.kling)}
                    disabled={isLoading}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="runway">Runway API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="runway"
                    type="password"
                    value={apiKeys.runway}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, runway: e.target.value }))}
                    placeholder="Enter your Runway API key"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleApiKeyUpdate('runway', apiKeys.runway)}
                    disabled={isLoading}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="elevenlabs">ElevenLabs API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="elevenlabs"
                    type="password"
                    value={apiKeys.elevenlabs}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, elevenlabs: e.target.value }))}
                    placeholder="Enter your ElevenLabs API key"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleApiKeyUpdate('elevenlabs', apiKeys.elevenlabs)}
                    disabled={isLoading}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="suno">Suno API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="suno"
                    type="password"
                    value={apiKeys.suno}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, suno: e.target.value }))}
                    placeholder="Enter your Suno API key"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleApiKeyUpdate('suno', apiKeys.suno)}
                    disabled={isLoading}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Settings Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              AI Model Preferences
            </CardTitle>
            <CardDescription>
              Configure which AI models to use for different generation tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set your preferred AI models for scripts, images, videos, and audio generation. 
                You can lock specific models to hide the selection interface in AI Studio.
              </p>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/settings-ai" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configure AI Settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
