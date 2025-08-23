"use client"

import { useAuth } from "@/lib/auth-context-fixed"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function AuthDebug() {
  const { user, loading, signOut, resetLoadingState } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleResetLoading = () => {
    resetLoadingState()
  }

  const clearLocalStorage = () => {
    localStorage.clear()
    sessionStorage.clear()
    window.location.reload()
  }

  const clearSupabaseStorage = () => {
    // Clear Supabase-specific storage
    localStorage.removeItem('sb-auth-token')
    localStorage.removeItem('supabase.auth.token')
    sessionStorage.removeItem('sb-auth-token')
    sessionStorage.removeItem('supabase.auth.token')
    window.location.reload()
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔐 Authentication Debug
          <Badge variant={loading ? "secondary" : user ? "default" : "destructive"}>
            {loading ? "Loading..." : user ? "Authenticated" : "Not Authenticated"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-semibold">Current State:</h3>
          <div className="text-sm space-y-1">
            <div>Loading: {loading.toString()}</div>
            <div>User: {user ? "Yes" : "No"}</div>
            {user && (
              <>
                <div>User ID: {user.id}</div>
                <div>Email: {user.email}</div>
                <div>Name: {user.name}</div>
                <div>Role: {user.role}</div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Debug Actions:</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSignOut} variant="outline" size="sm">
              Sign Out
            </Button>
            <Button onClick={handleResetLoading} variant="outline" size="sm">
              Reset Loading State
            </Button>
            <Button onClick={clearLocalStorage} variant="outline" size="sm">
              Clear Local Storage
            </Button>
            <Button onClick={clearSupabaseStorage} variant="outline" size="sm">
              Clear Supabase Storage
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Reload Page
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Storage Check:</h3>
          <div className="text-sm space-y-1">
            <div>Local Storage Keys: {Object.keys(localStorage).length}</div>
            <div>Session Storage Keys: {Object.keys(sessionStorage).length}</div>
            <div>Cookies: {document.cookie ? document.cookie.split(';').length : 0}</div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Environment Check:</h3>
          <div className="text-sm space-y-1">
            <div>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing"}</div>
            <div>Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing"}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
