"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Film, ArrowLeft, Check } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context-fixed"
import { useToast } from "@/hooks/use-toast"

export default function SignupPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    terms: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { signup } = useAuth()
  const { toast } = useToast()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    


    if (!formData.terms) {
      toast({
        title: "Error",
        description: "Please accept the terms and conditions",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    
    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim()
      await signup(formData.email, formData.password, fullName)
      toast({
        title: "Success",
        description: "Account created successfully! Welcome to Cinema Studio.",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error('Signup error:', error)
      
      // Handle specific error cases
      if (error.message?.includes('email confirmation')) {
        toast({
          title: "Account Created",
          description: "Account created! Please check your email to confirm your account.",
          variant: "default",
        })
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create account. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
    }
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
            Join Cinema Studio
          </h1>
          <p className="text-muted-foreground mt-2">Create your account and start producing amazing films</p>
        </div>

        {/* Signup Form */}
        <Card className="cinema-card">
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>Fill in your details to get started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="bg-background/50 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="bg-background/50 border-border/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="bg-background/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password (minimum 6 characters)"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="bg-background/50 border-border/50"
                />
              </div>
              <div className="flex items-start space-x-2">
                <input
                  id="terms"
                  type="checkbox"
                  checked={formData.terms}
                  onChange={handleInputChange}
                  className="mt-1 rounded border-border/50 bg-background/50"
                  required
                />
                <Label htmlFor="terms" className="text-sm text-muted-foreground">
                  I agree to the{" "}
                  <Link href="/terms" className="text-blue-500 hover:text-blue-400">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-blue-500 hover:text-blue-400">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
              <Button 
                type="submit" 
                className="w-full gradient-button neon-glow text-white"
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
              <div className="text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-500 hover:text-blue-400 font-medium">
                  Sign in
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4 text-center">What you'll get:</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Check className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">AI-powered script generation</span>
            </div>
            <div className="flex items-center gap-3">
              <Check className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Professional timeline management</span>
            </div>
            <div className="flex items-center gap-3">
              <Check className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Advanced asset organization</span>
            </div>
            <div className="flex items-center gap-3">
              <Check className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Collaborative team features</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
