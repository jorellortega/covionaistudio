'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { PreferencesService } from '@/lib/preferences-service'
import { useAuth } from '@/components/AuthProvider'
import Header from '@/components/header'
import { Settings, Eye, EyeOff, Shield, Palette, Bell, Globe } from 'lucide-react'

export default function PreferencesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [preferences, setPreferences] = useState({
    hidePromptText: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      setLoading(true)
      const prefs = await PreferencesService.getAllPreferences()
      setPreferences({
        hidePromptText: prefs.hidePromptText || false
      })
    } catch (error) {
      console.error('Error loading preferences:', error)
      toast({
        title: "Error",
        description: "Failed to load preferences",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const updatePreference = async (key: string, value: any) => {
    try {
      setSaving(true)
      const success = await PreferencesService.setPreference(key, value)
      
      if (success) {
        setPreferences(prev => ({ ...prev, [key]: value }))
        toast({
          title: "Preference Updated",
          description: "Your preference has been saved successfully",
        })
      } else {
        throw new Error('Failed to save preference')
      }
    } catch (error) {
      console.error('Error updating preference:', error)
      toast({
        title: "Error",
        description: "Failed to update preference",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-48 mb-8"></div>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-muted rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Preferences</h1>
            </div>
            <p className="text-muted-foreground">
              Customize your experience and control what information is visible
            </p>
          </div>

          {/* Privacy & Security Section */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-blue-500" />
                <CardTitle>Privacy & Security</CardTitle>
              </div>
              <CardDescription>
                Control what information is visible to others and manage your privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hide Prompt Text */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="hidePromptText" className="text-base font-medium">
                    Hide Prompt Text
                  </Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {preferences.hidePromptText ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    {preferences.hidePromptText 
                      ? "Prompt text is hidden from view" 
                      : "Prompt text is visible to anyone who can see your work"
                    }
                  </div>
                </div>
                <Switch
                  id="hidePromptText"
                  checked={preferences.hidePromptText}
                  onCheckedChange={(checked) => updatePreference('hidePromptText', checked)}
                  disabled={saving}
                />
              </div>
              
              <Separator />
              
              <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                <strong>Note:</strong> When prompt text is hidden, only you will be able to see the actual prompts used to generate content. 
                This helps protect your creative process and prevents others from copying your exact prompts.
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon Section */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Palette className="h-5 w-5 text-purple-500" />
                <CardTitle>Appearance & UI</CardTitle>
              </div>
              <CardDescription>
                Customize the look and feel of your workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Coming Soon</p>
                <p>More customization options will be available here in future updates</p>
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon Section */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-orange-500" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>
                Manage your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Coming Soon</p>
                <p>Notification settings will be available here in future updates</p>
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-green-500" />
                <CardTitle>Regional & Language</CardTitle>
              </div>
              <CardDescription>
                Set your preferred language and regional settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Coming Soon</p>
                <p>Language and regional settings will be available here in future updates</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
