"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { AIChat } from "@/components/ai-chat"
import { Bot, Sparkles, ArrowRight, Menu } from "lucide-react"
import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Landing Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Ai Cinema Studio
            </h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/features">
              <Button variant="ghost" className="hover:bg-muted">
                Features
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="hover:bg-muted">
                Sign In
              </Button>
            </Link>
            <Link href="/login">
              <Button className="gradient-button neon-glow text-white">Get Started</Button>
            </Link>
          </div>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-8">
                <Link href="/features" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    Features
                  </Button>
                </Link>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    Sign In
                  </Button>
                </Link>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="gradient-button neon-glow text-white w-full">
                    Get Started
                  </Button>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent leading-tight px-2">
              Ai Cinema Studio
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-4 max-w-2xl mx-auto leading-relaxed px-2">
              The Future of Cinema Production
            </p>
          </div>
        </section>

        {/* AI Chat Section */}
        <section className="container mx-auto px-4 sm:px-6 pt-4 pb-12 sm:pb-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 mb-4">
              <div 
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 p-1.5 flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(to right, #3b82f6, #a855f7)'
                }}
              >
                <Bot className="h-full w-full text-white" strokeWidth={2.5} />
              </div>
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <svg className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="infinityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  <path 
                    d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4z" 
                    stroke="url(#infinityGradient)" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
                <Link 
                  href="https://www.infinitoagi.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                    Infinito AI
                  </h2>
                </Link>
              </div>
            </div>
            <AIChat />
          </div>
        </section>

        {/* Subscription Plans Card */}
        <section className="container mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
          <div className="max-w-4xl mx-auto">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-purple-500/5 to-cyan-500/5 hover:shadow-lg transition-all duration-300">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-xl sm:text-2xl mb-2 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                      Choose Your Plan
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                      From professional creators to Production Houses — find the perfect plan for your needs. Starting at $60/month with flexible credit options.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Plans for every creator</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Creator • Studio • Production House
                    </p>
                  </div>
                  <Button className="gradient-button neon-glow text-white group w-full sm:w-auto" asChild>
                    <Link href="/subscriptions">
                      View Plans
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Promo Section (refined, fewer buttons, stronger narrative) */}
        <section className="container mx-auto px-4 sm:px-6 pb-16 sm:pb-20 md:pb-24">
          <div className="max-w-6xl mx-auto">
            {/* Cinematic strip (auto-scroll) */}
            <div className="mt-4 sm:mt-6 overflow-hidden rounded-lg sm:rounded-xl border border-border/50 bg-background/50">
              <div className="whitespace-nowrap will-change-transform marquee-track">
                <div className="inline-flex gap-3 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3">
                  <img src="/quantum-heist-movie-poster.png" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                  <img src="/cyberpunk-movie-poster.png" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                  <img src="/classical-music-movie-poster.png" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                  <img src="/digital-horror-poster.png" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                  <img src="/abstract-geometric-scene.png" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                  <img src="/placeholder.jpg" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                </div>
                <div className="inline-flex gap-3 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3">
                  <img src="/quantum-heist-movie-poster.png" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                  <img src="/cyberpunk-movie-poster.png" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                  <img src="/classical-music-movie-poster.png" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                  <img src="/digital-horror-poster.png" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                  <img src="/abstract-geometric-scene.png" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                  <img src="/placeholder.jpg" alt="Frame" className="h-16 sm:h-20 w-auto rounded-md border border-border/40" />
                </div>
              </div>
            </div>

            {/* Three pillars */}
            <div className="grid gap-4 sm:gap-6 mt-6 sm:mt-8 md:mt-10 grid-cols-1 sm:grid-cols-3 relative">
              {/* connector line */}
              <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-8 w-[80%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              <div className="rounded-lg sm:rounded-xl border border-border/60 p-4 sm:p-6 bg-background/60 backdrop-blur">
                <div className="text-xs sm:text-sm uppercase tracking-wide text-muted-foreground mb-2">01</div>
                <h4 className="text-base sm:text-lg font-semibold mb-2">Write & Plan</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Turn ideas into polished treatments and scenes. Keep everything structured, trackable, and ready for production.
                </p>
              </div>
              <div className="rounded-lg sm:rounded-xl border border-border/60 p-4 sm:p-6 bg-background/60 backdrop-blur">
                <div className="text-xs sm:text-sm uppercase tracking-wide text-muted-foreground mb-2">02</div>
                <h4 className="text-base sm:text-lg font-semibold mb-2">Visualize the Mood</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Explore cohesive looks with context-aware prompts from your treatment, scene, or shot. Collect references and keep them tied to the work.
                </p>
              </div>
              <div className="rounded-lg sm:rounded-xl border border-border/60 p-4 sm:p-6 bg-background/60 backdrop-blur">
                <div className="text-xs sm:text-sm uppercase tracking-wide text-muted-foreground mb-2">03</div>
                <h4 className="text-base sm:text-lg font-semibold mb-2">Build the Timeline</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Arrange scenes, iterate quickly, and keep production moving with a clean cinematic view that's easy to share.
                </p>
              </div>
            </div>

            {/* Sub-features as inline list instead of buttons */}
            <div className="mt-6 sm:mt-8 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-xs sm:text-sm text-muted-foreground">
              <div className="rounded-lg border border-border/50 px-3 sm:px-4 py-2 sm:py-3 bg-background/60">From concept to scenes—one continuous flow</div>
              <div className="rounded-lg border border-border/50 px-3 sm:px-4 py-2 sm:py-3 bg-background/60">Mood boards at film, scene, and shot level</div>
              <div className="rounded-lg border border-border/50 px-3 sm:px-4 py-2 sm:py-3 bg-background/60">All visuals organized in a single library</div>
              <div className="rounded-lg border border-border/50 px-3 sm:px-4 py-2 sm:py-3 bg-background/60">One‑click look exploration from your script</div>
            </div>
          </div>
        </section>
      </main>
      <style jsx>{`
        .marquee-track {
          display: inline-block;
          animation: marquee 28s linear infinite;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* Footer */}
      <footer className="border-t border-border bg-background/50">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs sm:text-sm">AI</span>
              </div>
              <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                Ai Cinema Studio
              </span>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground text-center md:text-right">© 2025 Ai Cinema Studio. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
