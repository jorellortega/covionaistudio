"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ProjectSelector } from "@/components/project-selector"
import { Navigation } from "@/components/navigation"
import { MobileNav } from "@/components/mobile-nav"
import { ThemeToggle } from "@/components/theme-provider"
import { useAuth } from "@/components/AuthProvider"
import { useAuthReady } from "@/components/auth-hooks"
import { LogOut, Settings, Menu, Zap } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { STUDIO_CREDITS_CHANGED_EVENT } from "@/lib/studio-credits-client"

export default function Header() {
  const { session } = useAuth()
  const { userId, ready } = useAuthReady()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userName, setUserName] = useState<string>('User')
  const [credits, setCredits] = useState<number | null>(null)

  // Fetch user name and credits from public.users table
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!ready || !userId) {
        setUserName('User')
        setCredits(null)
        return
      }
      
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('users')
          .select('name, credits')
          .eq('id', userId)
          .maybeSingle()

        if (error) {
          console.error('Error fetching user profile:', error)
          setUserName(session?.user?.email?.split('@')[0] || 'User')
          setCredits(null)
        } else {
          if (data?.name) {
            setUserName(data.name)
          } else {
            setUserName(session?.user?.email?.split('@')[0] || 'User')
          }
          setCredits(typeof data?.credits === 'number' ? data.credits : 0)
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
        setUserName(session?.user?.email?.split('@')[0] || 'User')
        setCredits(null)
      }
    }

    if (ready && userId) {
      fetchUserProfile()
    }
  }, [ready, userId, session?.user?.email])

  useEffect(() => {
    const onCreditsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ balance?: number | null }>).detail
      if (typeof detail?.balance === 'number') {
        setCredits(detail.balance)
        return
      }
      if (!ready || !userId) return
      const supabase = getSupabaseClient()
      supabase
        .from('users')
        .select('credits')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data }) => {
          if (typeof data?.credits === 'number') setCredits(data.credits)
        })
        .catch(() => {})
    }

    window.addEventListener(STUDIO_CREDITS_CHANGED_EVENT, onCreditsChanged)
    return () => window.removeEventListener(STUDIO_CREDITS_CHANGED_EVENT, onCreditsChanged)
  }, [ready, userId])

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseClient()
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">ACS</span>
            </div>
            <h1 className="hidden xl:block text-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent whitespace-nowrap">
              Ai Cinema Studio
            </h1>
          </Link>

        </div>
        <div className="flex items-center gap-4">
          {/* Desktop Navigation */}
          <div className="hidden md:block">
          <Navigation />
          </div>
          
          {/* Mobile Hamburger Menu */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
            <MobileNav open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
          </div>
          
          <ThemeToggle />
          
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder-user.jpg" alt={userName || session?.user?.email || 'User'} />
                    <AvatarFallback>{(userName || session?.user?.email || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{userName}</p>
                    {credits !== null ? (
                      <p className="text-xs text-muted-foreground">
                        {credits.toLocaleString()} credits
                      </p>
                    ) : null}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/plans-credits" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Plans & credits
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/login">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
