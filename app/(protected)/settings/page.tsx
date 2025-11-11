"use client"

import { useState, useEffect } from 'react'
import { useAuthReady } from '@/components/auth-hooks'
import { getSupabaseClient } from '@/lib/supabase'
import Header from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { LogOut, User, Key, Save, Settings, Bot, Lock, Unlock, Shield, Sparkles, Cog } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

export default function SettingsPage() {
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    anthropic: '',
    openart: '',
    kling: '',
    runway: '',
    elevenlabs: '',
    suno: '',
  })

  // Password management state
  const [showPasswordManagement, setShowPasswordManagement] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordManagementError, setPasswordManagementError] = useState('')
  const [isPasswordProtected, setIsPasswordProtected] = useState(false)
  const [userRole, setUserRole] = useState<string>('user')
  const [isLoadingRole, setIsLoadingRole] = useState(true)
  
  // Password management functions
  const setSettingsPassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordManagementError('Passwords do not match')
      return
    }
    if (newPassword.length < 1 || newPassword.length > 10) {
      setPasswordManagementError('Password must be 1-10 characters')
      return
    }

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('users')
        .update({ 
          settings_password_hash: newPassword,
          settings_password_enabled: true
        })
        .eq('id', userId)

      if (error) throw error

      setShowPasswordManagement(false)
      setNewPassword('')
      setConfirmPassword('')
      setPasswordManagementError('')
      
      toast({
        title: "Password Set",
        description: "AI settings are now password protected",
      })
    } catch (error) {
      setPasswordManagementError('Failed to set password')
    }
  }

  const removePasswordProtection = async () => {
    if (!currentPassword) {
      setPasswordManagementError('Please enter current password')
      return
    }

    try {
      // Get current password hash from database to verify
      const supabase = getSupabaseClient()
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('settings_password_hash')
        .eq('id', userId)
        .single()

      if (fetchError) throw fetchError

      // Verify current password (stored as plain text in this implementation)
      if (currentPassword !== userData?.settings_password_hash) {
        setPasswordManagementError('Incorrect password')
        return
      }

      // Remove password protection
      const { error } = await supabase
        .from('users')
        .update({ 
          settings_password_enabled: false,
          settings_password_hash: null
        })
        .eq('id', userId)

      if (error) throw error

      setIsPasswordProtected(false)
      setShowPasswordManagement(false)
      setCurrentPassword('')
      setPasswordManagementError('')
      
      toast({
        title: "Protection Removed",
        description: "AI settings are no longer password protected",
      })
    } catch (error) {
      setPasswordManagementError('Failed to remove protection')
    }
  }

  // Check password protection status
  const checkPasswordProtection = async () => {
    if (!userId) return
    
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('users')
        .select('settings_password_enabled, settings_password_hash')
        .eq('id', userId)
        .single()

      if (error) throw error
      
      setIsPasswordProtected(data?.settings_password_enabled || false)
    } catch (error) {
      console.error('Error checking password protection:', error)
    }
  }

  const handleApiKeyUpdate = async (service: string, apiKey: string) => {
    setIsLoading(true)
    try {
      const supabase = getSupabaseClient()
      const serviceKeyMap: Record<string, string> = {
        openai: 'openai_api_key',
        anthropic: 'anthropic_api_key',
        openart: 'openart_api_key',
        kling: 'kling_api_key',
        runway: 'runway_api_key',
        elevenlabs: 'elevenlabs_api_key',
        suno: 'suno_api_key',
      }
      
      const keyColumn = serviceKeyMap[service]
      if (!keyColumn) {
        throw new Error(`Unknown service: ${service}`)
      }

      const { error } = await supabase
        .from('users')
        .update({ [keyColumn]: apiKey })
        .eq('id', userId)

      if (error) throw error

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
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      })
      
      // Redirect to login page
      window.location.href = '/login'
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      })
    }
  }

  // Load user role
  const loadUserRole = async () => {
    if (!userId || !user) {
      console.log('🔍 No userId or user, setting role to user')
      setIsLoadingRole(false)
      return
    }
    
    try {
      const supabase = getSupabaseClient()
      console.log('🔍 Fetching role for userId:', userId, 'user.id:', user.id)
      
      // Try with userId first, then try with user.id
      const userIdToUse = userId || user.id
      
      const { data, error } = await supabase
        .from('users')
        .select('role, id, email')
        .eq('id', userIdToUse)
        .single()

      if (error) {
        console.error('❌ Error loading user role:', error)
        // Try alternative: check by email
        if (user.email) {
          console.log('🔍 Trying to fetch role by email:', user.email)
          const { data: emailData, error: emailError } = await supabase
            .from('users')
            .select('role, id, email')
            .eq('email', user.email)
            .single()
          
          if (!emailError && emailData) {
            console.log('✅ Found user by email, role:', emailData.role)
            setUserRole(emailData.role || 'user')
            setIsLoadingRole(false)
            return
          }
        }
        setUserRole('user')
        setIsLoadingRole(false)
        return
      }

      const role = data?.role || 'user'
      console.log('✅ Loaded user role:', role, 'for userId:', userIdToUse, 'data:', data)
      setUserRole(role)
    } catch (error) {
      console.error('❌ Exception loading user role:', error)
      setUserRole('user')
    } finally {
      setIsLoadingRole(false)
    }
  }

  // Check password protection status when component mounts
  useEffect(() => {
    if (ready && userId) {
      checkPasswordProtection()
      loadUserRole()
    } else if (ready && !userId) {
      setIsLoadingRole(false)
    }
  }, [ready, userId])

  // Check for admin roles (ceo or admin)
  const isAdmin = userRole === 'ceo' || userRole === 'admin'
  
  // Debug logging
  useEffect(() => {
    if (ready && !isLoadingRole) {
      console.log('🔍 Settings page - User role:', userRole, 'isAdmin:', isAdmin, 'isLoadingRole:', isLoadingRole)
    }
  }, [userRole, isAdmin, isLoadingRole, ready])

  if (!ready) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Please log in to access settings</h1>
        </div>
      </div>
    )
  }



  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
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
                <Input id="name" value={user?.user_metadata?.name || 'N/A'} disabled />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || 'N/A'} disabled />
              </div>
            </div>
            <div>
              <Label htmlFor="created">Member Since</Label>
                              <Input 
                  id="created" 
                  value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'} 
                  disabled 
                />
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

        {/* AI Setup Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Setup & Configuration
            </CardTitle>
            <CardDescription>
              Set up and configure your AI services and API keys
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure your AI services, set up API keys, and manage your AI Studio preferences.
              </p>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/setup-ai" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Go to AI Setup
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password Protection Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              AI Settings Password Protection
            </CardTitle>
            <CardDescription>
              Secure your AI settings and setup pages with a password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">AI Settings Protection</p>
                  <p className="text-sm text-muted-foreground">
                    {isPasswordProtected 
                      ? "AI settings are currently password protected" 
                      : "AI settings are currently unprotected"
                    }
                  </p>
                </div>
                <div className="flex gap-2">
                  {!isPasswordProtected ? (
                    <Button 
                      onClick={() => setShowPasswordManagement(true)}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Lock className="h-4 w-4" />
                      Enable Protection
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => setShowPasswordManagement(true)}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Unlock className="h-4 w-4" />
                      Manage Protection
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Preferences Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              User Preferences
            </CardTitle>
            <CardDescription>
              Customize your experience and control what information is visible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Manage your privacy settings, control prompt text visibility, and customize your workspace experience.
              </p>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/preferences" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Manage Preferences
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Debug Info - Temporary - Remove after testing */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="pt-6">
            <p className="text-sm">
              <strong>Debug Info:</strong> Role: {userRole || 'loading...'}, 
              isAdmin: {isAdmin ? 'true' : 'false'}, 
              isLoadingRole: {isLoadingRole ? 'true' : 'false'},
              userId: {userId || 'none'},
              ready: {ready ? 'true' : 'false'}
            </p>
          </CardContent>
        </Card>

        {/* Admin Section - Only visible to CEOs/Admins */}
        {isAdmin && !isLoadingRole && (
          <>
            <Separator className="my-6" />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                <h2 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Admin Controls</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AI System Prompt Admin */}
                <Card className="border-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <Sparkles className="h-5 w-5" />
                      AI System Prompt
                    </CardTitle>
                    <CardDescription className="text-amber-600 dark:text-amber-300">
                      Configure the system prompt that defines how Covion Intelligence behaves
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                      <Link href="/ai-info" className="flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Manage System Prompt
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* AI Settings Admin */}
                <Card className="border-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <Cog className="h-5 w-5" />
                      AI Provider Settings
                    </CardTitle>
                    <CardDescription className="text-amber-600 dark:text-amber-300">
                      Configure API keys and models for the AI assistant system-wide
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                      <Link href="/ai-settings-admin" className="flex items-center justify-center gap-2">
                        <Cog className="h-4 w-4" />
                        Manage Provider Settings
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Password Management Modal */}
      <Dialog open={showPasswordManagement} onOpenChange={setShowPasswordManagement}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isPasswordProtected ? "Manage Password Protection" : "Set Password Protection"}
            </DialogTitle>
            <DialogDescription>
              {isPasswordProtected 
                ? "Change your AI settings password or remove protection entirely"
                : "Set a password to protect your AI settings and setup pages from unauthorized access"
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {isPasswordProtected && (
              <div>
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
            )}
            
            {!isPasswordProtected && (
              <>
                <div>
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (1-10 characters)"
                  />
                </div>
                
                <div>
                  <Label htmlFor="new-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
              </>
            )}
            
            {passwordManagementError && (
              <p className="text-red-500 text-sm">{passwordManagementError}</p>
            )}
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPasswordManagement(false)}>
              Cancel
            </Button>
            
            {isPasswordProtected ? (
              <Button 
                onClick={removePasswordProtection}
                variant="destructive"
                disabled={!currentPassword.trim()}
              >
                Remove Protection
              </Button>
            ) : (
              <Button 
                onClick={setSettingsPassword}
                disabled={!newPassword.trim() || !confirmPassword.trim()}
              >
                Set Password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </main>
    </div>
  )
}
