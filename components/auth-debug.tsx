"use client"

import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AuthDebug() {
  const { session, loading } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
      console.log('Sign out successful')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handleRefreshSession = async () => {
    try {
      const { data: { session } } = await fetch('/api/auth/refresh', {
        method: 'POST',
      }).then(res => res.json())
      
      console.log('Session refresh result:', session)
    } catch (error) {
      console.error('Session refresh error:', error)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Auth Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="font-medium">Loading:</span>
            <span className={loading ? 'text-yellow-500' : 'text-green-500'}>
              {loading ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">User:</span>
            <span className={session?.user ? 'text-green-500' : 'text-gray-500'}>
              {session?.user ? session.user.email : 'None'}
            </span>
          </div>
        </div>

        {session?.user && (
          <div className="space-y-2 p-3 bg-gray-50 rounded">
            <div className="text-sm">
              <strong>User ID:</strong> {session.user.id}
            </div>
            <div className="text-sm">
              <strong>Name:</strong> {session.user.user_metadata?.name || 'N/A'}
            </div>
            <div className="text-sm">
              <strong>Email:</strong> {session.user.email}
            </div>
          </div>
        )}

        <div className="flex space-x-2">
          <Button 
            onClick={handleRefreshSession}
            variant="outline"
            size="sm"
          >
            Refresh Session
          </Button>
          {session?.user && (
            <Button 
              onClick={() => window.location.href = '/login'}
              variant="destructive"
              size="sm"
            >
              Sign Out
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500">
          <p>Use this panel to debug authentication issues.</p>
          <p>Check the console for detailed logs.</p>
        </div>
      </CardContent>
    </Card>
  )
}
