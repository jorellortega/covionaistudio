"use client"

import { useAuth } from "@/lib/auth-context-fixed"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, User, Shield, LogOut, RefreshCw } from "lucide-react"
import Link from "next/link"
import { LoadingDebug } from "@/components/loading-debug"

export default function TestAuthPage() {
  const { user, loading, signOut, refreshUser, resetAuthState } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  const handleRefresh = async () => {
    await refreshUser()
  }

  const handleReset = () => {
    resetAuthState()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-blue-500 hover:text-blue-400">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold mt-4">Authentication Test Page</h1>
          <p className="text-muted-foreground mt-2">
            This page helps debug authentication issues and test cross-tab functionality.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Auth Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Authentication Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-500">
                      Authenticated
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p><strong>User ID:</strong> {user.id}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                    <p><strong>Name:</strong> {user.name}</p>
                    <p><strong>Role:</strong> {user.role}</p>
                    <p><strong>Created:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">Not Authenticated</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    You are not currently signed in.
                  </p>
                  <Link href="/login">
                    <Button>Go to Login</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {user && (
                  <>
                    <Button 
                      onClick={handleRefresh} 
                      variant="outline" 
                      className="w-full"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh User Data
                    </Button>
                    <Button 
                      onClick={handleSignOut} 
                      variant="destructive" 
                      className="w-full"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </>
                )}
                <Button 
                  onClick={handleReset} 
                  variant="outline" 
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset Auth State
                </Button>
                <Link href="/dashboard" className="block">
                  <Button variant="outline" className="w-full">
                    Go to Dashboard
                  </Button>
                </Link>
                <Link href="/login" className="block">
                  <Button variant="outline" className="w-full">
                    Go to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loading Debug Panel */}
        <div className="mt-6">
          <LoadingDebug />
        </div>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p><strong>1. Cross-Tab Testing:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Open this page in multiple tabs</li>
                <li>Sign in/out in one tab</li>
                <li>Verify other tabs update automatically</li>
              </ul>
              
              <p><strong>2. Session Persistence:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Sign in and refresh the page</li>
                <li>Close and reopen the browser</li>
                <li>Check if you remain signed in</li>
              </ul>
              
              <p><strong>3. Error Handling:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Try accessing protected routes when not signed in</li>
                <li>Check browser console for any errors</li>
                <li>Verify redirects work properly</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
