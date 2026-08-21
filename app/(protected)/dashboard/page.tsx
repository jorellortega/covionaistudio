"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Film, Plus, ArrowRight, User, LogOut, Sparkles } from "lucide-react"
import Link from "next/link"
import { useAuthReady } from "@/components/auth-hooks"
import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase"
import Header from "@/components/header"

export default function DashboardPage() {
  const { session, user, userId, ready } = useAuthReady()
  const router = useRouter()

  const [userName, setUserName] = useState<string>('User')

  // Fetch user name from public.users table
  useEffect(() => {
    const fetchUserName = async () => {
      if (!userId) return
      
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('users')
          .select('name')
          .eq('id', userId)
          .single()

        if (error) {
          console.error('Error fetching user name:', error)
          // Fallback to email or default
          setUserName(session?.user?.email?.split('@')[0] || 'User')
        } else if (data?.name) {
          setUserName(data.name)
        } else {
          // Fallback to email or default
          setUserName(session?.user?.email?.split('@')[0] || 'User')
        }
      } catch (error) {
        console.error('Error fetching user name:', error)
        setUserName(session?.user?.email?.split('@')[0] || 'User')
      }
    }

    if (ready && userId) {
      fetchUserName()
    }
  }, [ready, userId, session?.user?.email])

  const handleSignOut = useCallback(async () => {
    console.log('🏠 DASHBOARD - Sign out initiated')
    try {
      // Use Supabase auth directly for sign out
      const supabase = getSupabaseClient()
      const { error } = await getSupabaseClient().auth.signOut()
      if (error) throw error
      console.log('🏠 DASHBOARD - Sign out completed')
      // Redirect to login page after successful sign out
      router.push('/login')
    } catch (error) {
      console.error('🏠 DASHBOARD - Error signing out:', error)
      // Still redirect even on error to ensure user is logged out
      router.push('/login')
    }
  }, [router])


  if (!ready) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <Skeleton className="h-12 w-96 mb-4" />
          <Skeleton className="h-6 w-80" />
        </div>
        {/* Add more skeleton loaders as needed */}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 py-8">
        {/* Header with User Info */}
        <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                {userName}! 🎬
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild className="gradient-button neon-glow text-white">
              <Link href="/new">
                <Sparkles className="h-4 w-4 mr-2" />
                Workspace
              </Link>
            </Button>
            <Button 
              onClick={handleSignOut}
              variant="outline" 
              className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Workspace Card - Prominent at Top */}
      <div className="mb-8">
        <Link href="/new">
          <Card className="cinema-card hover:neon-glow transition-all duration-300 group cursor-pointer border-2 border-cyan-400/30 bg-gradient-to-br from-blue-500/10 via-cyan-400/5 to-transparent shadow-lg shadow-blue-500/20">
            <CardHeader className="pb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/50 group-hover:scale-110 transition-transform">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent group-hover:from-blue-400 group-hover:to-cyan-300 transition-all">
                      Workspace
                    </CardTitle>
                    <CardDescription className="text-base mt-2 text-muted-foreground">
                      Build screenplays, characters, and assets in your creative workspace
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ArrowRight className="h-6 w-6 text-cyan-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-cyan-400 font-medium">
                <Plus className="h-5 w-5" />
                <span>Open workspace</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <Card className="cinema-card hover:neon-glow transition-all duration-300 group flex h-full cursor-pointer flex-col max-w-sm">
          <Link href="/movies" className="flex flex-1 flex-col">
            <CardHeader className="pb-4">
              <div className="p-3 rounded-lg bg-blue-500/10 w-fit group-hover:bg-blue-500/20 transition-colors">
                <Film className="h-6 w-6 text-blue-500" />
              </div>
              <CardTitle className="text-lg group-hover:text-blue-500 transition-colors">Movies</CardTitle>
            </CardHeader>
            <CardContent className="mt-auto flex flex-1 flex-col">
              <CardDescription className="mb-4">Manage your film projects</CardDescription>
              <div className="mt-auto flex items-center justify-end">
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
      </div>
    </div>
  )
}
