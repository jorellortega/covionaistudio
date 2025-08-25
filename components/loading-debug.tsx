"use client"

import { useAuth } from "@/lib/auth-context-fixed"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle, Clock, RefreshCw } from "lucide-react"

export function LoadingDebug() {
  const { user, loading, loadingStep, resetAuthState, forceRefresh } = useAuth()

  const getLoadingStatus = () => {
    if (loading) {
      return {
        icon: <Clock className="h-4 w-4 text-yellow-500" />,
        status: "Loading",
        color: "bg-yellow-500",
        description: loadingStep || "Authentication is currently in progress..."
      }
    } else if (user) {
      return {
        icon: <CheckCircle className="h-4 w-4 text-green-500" />,
        status: "Authenticated",
        color: "bg-green-500",
        description: "User is successfully authenticated"
      }
    } else {
      return {
        icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
        status: "Not Authenticated",
        color: "bg-red-500",
        description: "No user is currently signed in"
      }
    }
  }

  const status = getLoadingStatus()

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status.icon}
          Loading Debug Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className={status.color}>
            {status.status}
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground">
          {status.description}
        </p>

        {user && (
          <div className="text-sm space-y-1">
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Name:</strong> {user.name}</p>
            <p><strong>Role:</strong> {user.role}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={resetAuthState} 
            variant="outline" 
            size="sm"
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset State
          </Button>
          <Button 
            onClick={forceRefresh} 
            variant="outline" 
            size="sm"
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Force Refresh
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p><strong>Current State:</strong></p>
          <p>Loading: {loading.toString()}</p>
          <p>Loading Step: {loadingStep}</p>
          <p>User: {user ? 'Yes' : 'No'}</p>
          <p>Timestamp: {new Date().toLocaleTimeString()}</p>
        </div>
      </CardContent>
    </Card>
  )
}
