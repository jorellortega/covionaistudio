"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Film, ArrowLeft, Check } from "lucide-react"
import Link from "next/link"

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // TODO: Implement actual registration
    setTimeout(() => {
      setIsLoading(false)
      window.location.href = "/dashboard"
    }, 2000)
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  className="bg-background/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
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
                className="bg-background/50 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a strong password"
                className="bg-background/50 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                className="bg-background/50 border-border/50"
              />
            </div>
            <div className="flex items-start space-x-2">
              <input
                id="terms"
                type="checkbox"
                className="mt-1 rounded border-border/50 bg-background/50"
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
            <Button className="w-full gradient-button neon-glow text-white">
              Create Account
            </Button>
            <div className="text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-500 hover:text-blue-400 font-medium">
                Sign in
              </Link>
            </div>
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
