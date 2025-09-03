'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { PreferencesService } from '@/lib/preferences-service'
import { useAuthReady } from '@/components/auth-hooks'
import Header from '@/components/header'
import { Settings, Eye, EyeOff, Shield, Palette, Bell, Globe } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function PreferencesPage() {
  const { session, user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  const [preferences, setPreferences] = useState({
    hidePromptText: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [isPasswordProtected, setIsPasswordProtected] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    checkAccess()
  }, [user])

  const loadUserRole = async () => {
    if (!user) return
    
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setUserRole(data?.role || 'user')
    } catch (error) {
      console.error('Error loading user role:', error)
      setUserRole('user') // Default to user role on error
    }
  }

  const checkAccess = async () => {
    if (!user) return
    
    await loadUserRole()
    
    // Check if user has admin privileges (CEO or Cinema subscription)
    if (userRole === 'ceo' || userRole === 'cinema') {
      setHasAccess(true)
      loadPreferences()
      return
    }
    
    // For regular users, check password protection
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('users')
        .select('settings_password_enabled')
        .eq('id', user.id)
        .single()

      if (error) throw error
      
      const isProtected = data?.settings_password_enabled || false
      setIsPasswordProtected(isProtected)
      
      if (!isProtected) {
        setHasAccess(true)
        loadPreferences()
      } else {
        // Check if user already has access from session storage
        const hasAccess = sessionStorage.getItem('preferences-access') === 'true'
        setHasAccess(hasAccess)
        if (hasAccess) {
          loadPreferences()
        }
      }
    } catch (error) {
      console.error('Error checking access:', error)
      setHasAccess(true) // Default to allowing access on error
      loadPreferences()
    }
  }

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

  const verifyPassword = async (password: string) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('users')
        .select('settings_password_hash')
        .eq('id', user?.id)
        .single()

      if (error) throw error
      
      // Simple password comparison (in production, you'd want proper hashing)
      if (password === data?.settings_password_hash) {
        sessionStorage.setItem('preferences-access', 'true')
        setHasAccess(true)
        setPasswordError('')
        loadPreferences()
        return true
      } else {
        setPasswordError('Incorrect password')
        return false
      }
    } catch (error) {
      console.error('Error verifying password:', error)
      setPasswordError('Failed to verify password')
      return false
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await verifyPassword(password)
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

  // Show loading state
  if (loading && !hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Loading...</h1>
          </div>
        </main>
      </div>
    )
  }

  // Show access denied for non-admin users when password protected
  if (!hasAccess && isPasswordProtected && !(userRole === 'ceo' || userRole === 'cinema')) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">User Preferences</h1>
            <p className="text-muted-foreground">This page is password protected</p>
          </div>

          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Password Required
              </CardTitle>
              <CardDescription>
                Enter the password to access your preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                </div>
                {passwordError && (
                  <p className="text-red-500 text-sm">{passwordError}</p>
                )}
                <Button type="submit" className="w-full">
                  Access Preferences
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
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
