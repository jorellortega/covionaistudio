import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Film, Sparkles, TimerIcon as Timeline, FolderOpen, Play, ArrowRight, Check } from "lucide-react"
import Link from "next/link"

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
              Cinema Studio
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="hover:bg-muted">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
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
              The Future of Cinema Production
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Create, manage, and produce films with cutting-edge AI tools. From script generation to visual effects,
              streamline your entire production workflow in one powerful platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/signup">
                <Button className="gradient-button neon-glow text-white px-6 sm:px-8 py-3 text-lg w-full sm:w-auto">
                  Start Creating
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="border-blue-500/20 hover:border-blue-500 hover:bg-blue-500/10 bg-transparent px-6 sm:px-8 py-3 text-lg w-full sm:w-auto"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* AI Prompt Studio Section */}
        <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 flex items-center justify-center gap-3">
              <Sparkles className="h-8 w-8 text-blue-500" />
              Try Our AI Prompt Studio
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the power of AI-driven creativity. Generate scripts and images instantly with our advanced models.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card className="cinema-card border-2 border-blue-200/50 dark:border-blue-800/50">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">AI Prompt Studio</CardTitle>
                <CardDescription className="text-lg">
                  Transform your ideas into cinematic content with cutting-edge AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* AI Status Display */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    AI Status
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Script Generation:</span>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs rounded-full">
                          Available
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Image Generation:</span>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs rounded-full">
                          Available
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Video Generation:</span>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs rounded-full">
                          Available
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Audio Generation:</span>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs rounded-full">
                          Available
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prompt Input */}
                <div>
                  <label htmlFor="demo-prompt" className="block text-sm font-medium mb-2">
                    Describe your movie idea or scene
                  </label>
                  <textarea
                    id="demo-prompt"
                    placeholder="e.g., 'A young filmmaker discovers an AI that can bring their wildest cinematic visions to life, but at what cost?'"
                    rows={4}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Button className="gradient-button neon-glow text-white px-4 py-3 text-sm">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Script
                  </Button>
                  <Button variant="outline" className="border-blue-500/20 hover:border-blue-500 hover:bg-blue-500/10 px-4 py-3 text-sm">
                    <Film className="mr-2 h-4 w-4" />
                    Image
                  </Button>
                  <Button variant="outline" className="border-purple-500/20 hover:border-purple-500 hover:bg-purple-500/10 px-4 py-3 text-sm">
                    <Play className="mr-2 h-4 w-4" />
                    Video
                  </Button>
                  <Button variant="outline" className="border-green-500/20 hover:border-green-500 hover:bg-green-500/10 px-4 py-3 text-sm">
                    <span className="mr-2 h-4 w-4">🎵</span>
                    Audio
                  </Button>
                </div>

                {/* AI Capabilities Showcase */}
                <div className="pt-6 border-t border-border/50">
                  <h4 className="font-medium mb-4 text-center">AI-Powered Capabilities</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Script & Story</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Generate compelling scripts, dialogue, treatments, and story concepts
                      </p>
                    </div>
                    <div className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 rounded-lg border border-cyan-200/50 dark:border-cyan-800/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Film className="h-4 w-4 text-cyan-500" />
                        <span className="text-sm font-medium">Visual Content</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Create concept art, storyboards, and cinematic images
                      </p>
                    </div>
                    <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-200/50 dark:border-purple-800/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Play className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium">Video Generation</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Generate short video clips, trailers, and motion content
                      </p>
                    </div>
                    <div className="p-3 bg-green-50/50 dark:bg-green-950/20 rounded-lg border border-green-200/50 dark:border-green-800/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="h-4 w-4">🎵</span>
                        <span className="text-sm font-medium">Audio & Music</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Create soundtracks, voice-overs, and ambient audio
                      </p>
                    </div>
                  </div>
                </div>

                {/* Call to Action */}
                <div className="text-center pt-6">
                  <p className="text-sm text-muted-foreground mb-3">
                    Ready to start creating? Sign up to unlock unlimited AI generation and save your ideas.
                  </p>
                  <Link href="/signup">
                    <Button className="gradient-button neon-glow text-white">
                      Get Started with AI Studio
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Everything You Need for Film Production</h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful AI-driven tools designed for modern filmmakers and content creators
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 max-w-7xl mx-auto">
            <Card className="cinema-card hover:neon-glow transition-all duration-300 h-full">
              <CardHeader className="pb-4">
                <div className="p-3 rounded-lg bg-blue-500/10 w-fit mx-auto md:mx-0">
                  <Sparkles className="h-8 w-8 text-blue-500" />
                </div>
                <CardTitle className="text-xl text-center md:text-left">AI Script Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed text-center md:text-left">
                  Generate compelling scripts, dialogue, and treatments with advanced AI models tailored for
                  storytelling.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="cinema-card hover:neon-glow transition-all duration-300 h-full">
              <CardHeader className="pb-4">
                <div className="p-3 rounded-lg bg-cyan-500/10 w-fit mx-auto md:mx-0">
                  <Timeline className="h-8 w-8 text-cyan-500" />
                </div>
                <CardTitle className="text-xl text-center md:text-left">Visual Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed text-center md:text-left">
                  Organize scenes with intuitive vertical timelines. Track progress and manage complex productions
                  effortlessly.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="cinema-card hover:neon-glow transition-all duration-300 h-full">
              <CardHeader className="pb-4">
                <div className="p-3 rounded-lg bg-blue-600/10 w-fit mx-auto md:mx-0">
                  <Film className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl text-center md:text-left">AI Video & Images</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed text-center md:text-left">
                  Create stunning visuals, concept art, and video content using state-of-the-art AI generation models.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="cinema-card hover:neon-glow transition-all duration-300 h-full">
              <CardHeader className="pb-4">
                <div className="p-3 rounded-lg bg-cyan-600/10 w-fit mx-auto md:mx-0">
                  <FolderOpen className="h-8 w-8 text-cyan-600" />
                </div>
                <CardTitle className="text-xl text-center md:text-left">Asset Management</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed text-center md:text-left">
                  Store, version, and organize all your AI-generated content in one centralized library system.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Choose Your Plan</h2>
            <p className="text-lg sm:text-xl text-muted-foreground">Start free, scale as you grow</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            <Card className="cinema-card h-full flex flex-col">
              <CardHeader className="text-center pb-6 sm:pb-8">
                <CardTitle className="text-xl sm:text-2xl">Starter</CardTitle>
                <div className="text-3xl sm:text-4xl font-bold text-blue-500">Free</div>
                <CardDescription>Perfect for getting started</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>3 Projects</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>Basic AI Generation</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>Timeline Management</span>
                  </div>
                </div>
                <Link href="/signup" className="block pt-4 mt-auto">
                  <Button className="w-full bg-transparent" variant="outline">
                    Get Started
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="cinema-card border-blue-500/50 relative h-full flex flex-col">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
              <CardHeader className="text-center pb-6 sm:pb-8">
                <CardTitle className="text-xl sm:text-2xl">Pro</CardTitle>
                <div className="text-3xl sm:text-4xl font-bold text-blue-500">
                  $29<span className="text-base sm:text-lg text-muted-foreground">/mo</span>
                </div>
                <CardDescription>For serious filmmakers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>Unlimited Projects</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>Advanced AI Models</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>Priority Support</span>
                  </div>
                </div>
                <Link href="/signup" className="block pt-4 mt-auto">
                  <Button className="w-full gradient-button neon-glow text-white">Start Pro Trial</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="cinema-card h-full flex flex-col">
              <CardHeader className="text-center pb-6 sm:pb-8">
                <CardTitle className="text-xl sm:text-2xl">Studio</CardTitle>
                <div className="text-3xl sm:text-4xl font-bold text-blue-500">
                  $99<span className="text-base sm:text-lg text-muted-foreground">/mo</span>
                </div>
                <CardDescription>For production teams</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>Team Collaboration</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>Custom AI Training</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>White-label Options</span>
                  </div>
                </div>
                <Link href="/signup" className="block pt-4 mt-auto">
                  <Button className="w-full bg-transparent" variant="outline">
                    Contact Sales
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Transform Your Film Production?</h2>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8">
              Join thousands of creators already using AI Cinema Studio to bring their visions to life.
            </p>
            <Link href="/signup">
              <Button className="gradient-button neon-glow text-white px-6 sm:px-8 py-3 text-lg">
                Start Your Journey
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
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
                Cinema Studio
              </span>
            </div>
            <div className="text-sm text-muted-foreground text-center md:text-right">© 2024 AI Cinema Studio. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
