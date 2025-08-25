"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Film, ArrowLeft, AlertCircle, Bug, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context-fixed"
import { useToast } from "@/hooks/use-toast"
import { AuthDebug } from "@/components/auth-debug"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const router = useRouter()
  const { signIn, user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  // Redirect if already authenticated - simplified to reduce re-renders
  useEffect(() => {
    console.log('🔐 LOGIN PAGE - Redirect useEffect triggered:', { user: !!user, authLoading, userDetails: user })
    
    if (user && !authLoading) {
      console.log('🔐 LOGIN PAGE - Redirecting to dashboard')
      // Reset submission state before redirecting
      setIsSubmitting(false)
      
      // Use a small delay to ensure state is properly updated
      const redirectTimer = setTimeout(() => {
        console.log('🔐 LOGIN PAGE - Executing redirect to dashboard')
        try {
          router.push("/dashboard")
        } catch (error) {
          console.log('🔐 LOGIN PAGE - Router redirect failed, using window.location')
          window.location.href = "/dashboard"
        }
      }, 100)
      
      return () => clearTimeout(redirectTimer)
    }
  }, [user, authLoading, router])

  // Reset error when user starts typing
  useEffect(() => {
    if (error) {
      setError(null)
    }
  }, [email, password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isSubmitting) return // Prevent double submission
    
    console.log('🔐 LOGIN PAGE - Form submission started')
    
    setError(null)
    setIsSubmitting(true)
    
    try {
      const { error: signInError } = await signIn(email, password)
      
      if (signInError) {
        console.error('🔐 LOGIN PAGE - SignIn error:', signInError)
        throw signInError
      }
      
      console.log('🔐 LOGIN PAGE - SignIn successful, waiting for redirect')
      
      // Success - show toast and redirect will happen via useEffect
      toast({
        title: "Success",
        description: "Welcome back! You've been successfully signed in.",
      })
      
      // Reset submission state after successful sign-in
      setIsSubmitting(false)
      
      // Fallback redirect in case useEffect doesn't trigger
      setTimeout(() => {
        if (user) {
          console.log('🔐 LOGIN PAGE - Fallback redirect to dashboard')
          try {
            router.push("/dashboard")
          } catch (error) {
            console.log('🔐 LOGIN PAGE - Router redirect failed, using window.location')
            window.location.href = "/dashboard"
          }
        }
      }, 500)
      
    } catch (error: any) {
      console.error('🔐 LOGIN PAGE - SignIn exception:', error)
      setIsSubmitting(false)
      
      const errorMessage = error.message || "Failed to sign in. Please check your credentials."
      setError(errorMessage)
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleRetry = () => {
    console.log('🔐 LOGIN PAGE - Retry button clicked')
    setError(null)
    setIsSubmitting(false)
  }

  // Show debug component if in debug mode
  if (showDebug) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mb-4">
          <Button onClick={() => setShowDebug(false)} variant="outline">
            ← Back to Login
          </Button>
        </div>
        <AuthDebug />
      </div>
    )
  }

  // Show loading state while auth is initializing
  if (authLoading && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-muted-foreground">Initializing authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Home */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 mb-4">
            <Film className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className="text-muted-foreground mt-2">Sign in to your Cinema Studio account</p>
        </div>

        {/* Login Form */}
        <Card className="cinema-card">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="bg-background/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="bg-background/50 border-border/50"
                />
              </div>
              <div className="flex items-center justify-between">
                <Link href="/forgot-password" className="text-sm text-blue-500 hover:text-blue-400">
                  Forgot password?
                </Link>
              </div>
              
              {error ? (
                <div className="space-y-2">
                  <Button 
                    type="button" 
                    onClick={handleRetry}
                    className="w-full gradient-button neon-glow text-white"
                  >
                    Try Again
                  </Button>
                  <Button 
                    type="submit" 
                    className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              ) : (
                <Button 
                  type="submit" 
                  className="w-full gradient-button neon-glow text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              )}
              
              <div className="text-center text-sm">
                Don't have an account?{" "}
                <Link href="/signup" className="text-blue-500 hover:text-blue-400 font-medium">
                  Sign up
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Debug Button */}
        <div className="mt-4 text-center">
          <Button
            onClick={() => setShowDebug(true)}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Bug className="h-4 w-4 mr-2" />
            Debug Auth Issues
          </Button>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>By signing in, you agree to our Terms of Service and Privacy Policy.</p>
        </div>
      </div>
    </div>
  )
}
