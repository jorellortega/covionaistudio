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
      </main>

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
