"use client"

import { useAuth } from '@/lib/auth-context-fixed'
import { AuthDebug } from '@/components/auth-debug'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestAuthPage() {
  const { user, isLoading, isInitialized, signIn, logout } = useAuth()

  const handleTestSignIn = async () => {
    try {
      console.log('Testing sign in...')
      const result = await signIn('vidaxci@gmail.com', 'testpassword')
      if (result.error) {
        console.error('Test sign in failed:', result.error)
      } else {
        console.log('Test sign in successful')
      }
    } catch (error) {
      console.error('Test sign in error:', error)
    }
  }

  const handleTestSignOut = async () => {
    try {
      console.log('Testing sign out...')
      await logout()
      console.log('Test sign out completed')
    } catch (error) {
      console.error('Test sign out error:', error)
    }
  }

  return (
    <div className="container mx-auto p-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Auth Context Test Page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Current State:</h3>
              <div className="text-sm space-y-1">
                <div>Loading: {isLoading.toString()}</div>
                <div>Initialized: {isInitialized.toString()}</div>
                <div>User: {user ? 'Yes' : 'No'}</div>
                {user && (
                  <>
                    <div>Email: {user.email}</div>
                    <div>Name: {user.name}</div>
                  </>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">Test Actions:</h3>
              <div className="flex flex-col space-y-2">
                <Button onClick={handleTestSignIn} variant="outline" size="sm">
                  Test Sign In
                </Button>
                <Button onClick={handleTestSignOut} variant="destructive" size="sm">
                  Test Sign Out
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AuthDebug />
    </div>
  )
}
