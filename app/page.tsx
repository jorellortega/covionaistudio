"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AIChat } from "@/components/ai-chat"
import { Bot } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Landing Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Covion AI
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="hover:bg-muted">
                Sign In
              </Button>
            </Link>
            <Link href="/login">
              <Button className="gradient-button neon-glow text-white">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent leading-tight">
              COVION AI
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-4 max-w-2xl mx-auto leading-relaxed">
              The Future of Cinema Production
            </p>
          </div>
        </section>

        {/* AI Chat Section */}
        <section className="container mx-auto px-4 sm:px-6 pt-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col items-center justify-center gap-3 mb-4">
              <div 
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 p-1.5 flex items-center justify-center"
                style={{
                  background: 'linear-gradient(to right, #3b82f6, #a855f7)'
                }}
              >
                <Bot className="h-full w-full text-white" strokeWidth={2.5} />
              </div>
              <div className="flex items-center justify-center gap-3">
                <svg className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                  <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                    Infinito AI
                  </h2>
                </Link>
              </div>
            </div>
            <AIChat />
          </div>
        </section>

        {/* Promo Section (refined, fewer buttons, stronger narrative) */}
        <section className="container mx-auto px-4 sm:px-6 pb-24">
          <div className="max-w-6xl mx-auto">
            {/* Visual banner */}
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-cyan-600/10">
              <div className="absolute inset-0 opacity-[0.15] pointer-events-none"
                   style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.35) 0, transparent 40%), radial-gradient(circle at 80% 30%, rgba(168,85,247,0.35) 0, transparent 45%), radial-gradient(circle at 50% 80%, rgba(34,211,238,0.35) 0, transparent 50%)' }} />
              <div className="relative p-8 sm:p-12 lg:p-16">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-4">
                  From Idea to Screen — in One Workspace
                </h3>
                <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-3xl mb-6">
                  Draft stories with AI, shape the look with mood boards, organize scenes on a cinematic timeline, and keep assets in sync. Purpose-built for filmmakers.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/signup">
                    <Button className="gradient-button neon-glow text-white">Start Free</Button>
                  </Link>
                  <Link href="/timeline">
                    <Button variant="secondary">Explore Timeline</Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Cinematic strip (auto-scroll) */}
            <div className="mt-6 overflow-hidden rounded-xl border border-border/50 bg-background/50">
              <div className="whitespace-nowrap will-change-transform marquee-track">
                <div className="inline-flex gap-4 px-4 py-3">
                  <img src="/quantum-heist-movie-poster.png" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                  <img src="/cyberpunk-movie-poster.png" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                  <img src="/classical-music-movie-poster.png" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                  <img src="/digital-horror-poster.png" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                  <img src="/abstract-geometric-scene.png" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                  <img src="/placeholder.jpg" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                </div>
                <div className="inline-flex gap-4 px-4 py-3">
                  <img src="/quantum-heist-movie-poster.png" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                  <img src="/cyberpunk-movie-poster.png" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                  <img src="/classical-music-movie-poster.png" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                  <img src="/digital-horror-poster.png" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                  <img src="/abstract-geometric-scene.png" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                  <img src="/placeholder.jpg" alt="Frame" className="h-20 w-auto rounded-md border border-border/40" />
                </div>
              </div>
            </div>

            {/* Three pillars */}
            <div className="grid gap-6 mt-10 sm:grid-cols-3 relative">
              {/* connector line */}
              <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-8 w-[80%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              <div className="rounded-xl border border-border/60 p-6 bg-background/60 backdrop-blur">
                <div className="text-sm uppercase tracking-wide text-muted-foreground mb-2">01</div>
                <h4 className="text-lg font-semibold mb-2">Write & Plan</h4>
                <p className="text-sm text-muted-foreground">
                  Turn ideas into polished treatments and scenes. Keep everything structured, trackable, and ready for production.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 p-6 bg-background/60 backdrop-blur">
                <div className="text-sm uppercase tracking-wide text-muted-foreground mb-2">02</div>
                <h4 className="text-lg font-semibold mb-2">Visualize the Mood</h4>
                <p className="text-sm text-muted-foreground">
                  Explore cohesive looks with context-aware prompts from your treatment, scene, or shot. Collect references and keep them tied to the work.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 p-6 bg-background/60 backdrop-blur">
                <div className="text-sm uppercase tracking-wide text-muted-foreground mb-2">03</div>
                <h4 className="text-lg font-semibold mb-2">Build the Timeline</h4>
                <p className="text-sm text-muted-foreground">
                  Arrange scenes, iterate quickly, and keep production moving with a clean cinematic view that’s easy to share.
                </p>
              </div>
            </div>

            {/* Sub-features as inline list instead of buttons */}
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm text-muted-foreground">
              <div className="rounded-lg border border-border/50 px-4 py-3 bg-background/60">From concept to scenes—one continuous flow</div>
              <div className="rounded-lg border border-border/50 px-4 py-3 bg-background/60">Mood boards at film, scene, and shot level</div>
              <div className="rounded-lg border border-border/50 px-4 py-3 bg-background/60">All visuals organized in a single library</div>
              <div className="rounded-lg border border-border/50 px-4 py-3 bg-background/60">One‑click look exploration from your script</div>
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
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                Covion AI
              </span>
            </div>
            <div className="text-sm text-muted-foreground text-center md:text-right">© 2025 Covion AI. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
