import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Film,
  FileText,
  Video,
  Play,
  Image as ImageIcon,
  Zap,
  Users,
  Package,
  Box,
  Lightbulb,
  Palette,
  PenTool,
  UserCircle,
  MapPin,
  FolderOpen,
  Bot,
  Sparkles,
  ArrowRight,
  Check,
  LayoutDashboard,
  Camera,
  BookOpen,
  Clock,
  Wand2,
  MessageSquare,
} from "lucide-react"

export const metadata: Metadata = {
  title: "AI-Powered Cinema Features – Ai Cinema Studio",
  description:
    "Discover AI-powered filmmaking tools and cinema features. AI film production software with writing, storyboarding, visual development, and production management. Complete AI cinema platform for modern filmmakers.",
  keywords: [
    "AI filmmaking tools",
    "AI cinema features",
    "AI-powered film production",
    "AI filmmaking software",
    "AI cinema tools",
    "AI film production platform",
    "AI-powered cinema",
    "AI filmmaking features",
    "cinema AI tools",
    "filmmaking AI software",
  ],
  openGraph: {
    title: "AI-Powered Cinema Features – Ai Cinema Studio",
    description:
      "Complete suite of AI-powered filmmaking tools and cinema features. AI film production software for writing, storyboarding, visual development, and production management.",
  },
}

const featureCategories = [
  {
    name: "AI Project Management",
    description: "AI-powered tools to organize and manage your cinematic projects from start to finish",
    icon: LayoutDashboard,
    color: "from-blue-500 to-cyan-400",
    features: [
      {
        name: "Movies",
        description: "AI-enhanced project management for film projects with intelligent organization and tracking",
        icon: Film,
        href: "/movies",
      },
      {
        name: "Treatments",
        description: "AI-powered writing assistant to develop detailed treatments with intelligent suggestions and enhancements",
        icon: FileText,
        href: "/treatments",
      },
      {
        name: "Videos",
        description: "AI-assisted video content management and production organization",
        icon: Video,
        href: "/videos",
      },
    ],
  },
  {
    name: "AI Production Tools",
    description: "AI-enhanced production management tools for every aspect of filmmaking",
    icon: Play,
    color: "from-purple-500 to-pink-500",
    features: [
      {
        name: "Timeline",
        description: "AI-powered visual timeline to intelligently arrange scenes, track progress, and optimize production flow",
        icon: Play,
        href: "/timeline",
      },
      {
        name: "Storyboards",
        description: "AI-generated storyboards with intelligent scene composition and visual suggestions for your shots",
        icon: ImageIcon,
        href: "/storyboards",
      },
      {
        name: "Lighting Plot",
        description: "AI-assisted lighting design with intelligent suggestions for optimal scene lighting setups",
        icon: Zap,
        href: "/lighting-plot",
      },
      {
        name: "Call Sheet",
        description: "AI-powered call sheet generation and management with smart scheduling for production days",
        icon: FileText,
        href: "/call-sheet",
      },
      {
        name: "Crew Sheet",
        description: "AI-enhanced crew management with intelligent organization and role optimization",
        icon: Users,
        href: "/crew-sheet",
      },
      {
        name: "Equipment List",
        description: "AI-powered equipment tracking with smart suggestions and inventory management",
        icon: Package,
        href: "/equipment-list",
      },
      {
        name: "Props List",
        description: "AI-assisted props cataloging with intelligent organization and tracking for your production",
        icon: Box,
        href: "/props-list",
      },
    ],
  },
  {
    name: "AI Creative Development",
    description: "AI-powered visualization and creative tools to bring your cinematic vision to life",
    icon: Palette,
    color: "from-green-500 to-emerald-400",
    features: [
      {
        name: "Ideas",
        description: "AI-powered idea development studio with intelligent prompt generation and creative suggestions",
        icon: Lightbulb,
        href: "/ideas",
      },
      {
        name: "Visual Development",
        description: "AI-generated character designs, environments, props, and color scripts with intelligent visual creation",
        icon: Palette,
        href: "/visdev",
      },
      {
        name: "Mood Boards",
        description: "AI-enhanced mood board creation with intelligent visual suggestions at film, scene, and shot levels",
        icon: Palette,
        href: "/mood-boards",
      },
      {
        name: "Writers",
        description: "Advanced AI-powered writing tools for scripts, scenes, and dialogue with context-aware assistance",
        icon: PenTool,
        href: "/writers-page",
      },
      {
        name: "Characters",
        description: "AI-assisted character development with intelligent profile generation and design suggestions",
        icon: UserCircle,
        href: "/characters",
      },
      {
        name: "Locations",
        description: "AI-powered location scouting and management with intelligent cataloging and suggestions",
        icon: MapPin,
        href: "/locations",
      },
    ],
  },
  {
    name: "AI-Powered Tools",
    description: "Leverage artificial intelligence to enhance your creative workflow",
    icon: Bot,
    color: "from-orange-500 to-red-500",
    features: [
      {
        name: "AI Studio",
        description: "Comprehensive AI workspace for generating content, images, and videos",
        icon: Bot,
        href: "/ai-studio",
      },
      {
        name: "AI Chat",
        description: "Interactive AI assistant powered by Infinito AI for creative collaboration",
        icon: MessageSquare,
        href: "/",
      },
      {
        name: "AI Text Editor",
        description: "Context-aware text editing with AI-powered rewriting and enhancement",
        icon: Wand2,
        href: null,
      },
      {
        name: "Saved Prompts",
        description: "Build a library of effective AI prompts for consistent creative output",
        icon: Sparkles,
        href: "/prompts-list",
      },
    ],
  },
  {
    name: "AI Asset Management",
    description: "AI-powered centralized storage and intelligent organization for all your creative assets",
    icon: FolderOpen,
    color: "from-indigo-500 to-purple-500",
    features: [
      {
        name: "Asset Library",
        description: "AI-enhanced asset management with intelligent tagging, organization, and search for images, videos, and creative assets",
        icon: FolderOpen,
        href: "/assets",
      },
    ],
  },
]

const keyHighlights = [
  {
    title: "AI-Powered Workflow",
    description: "Every cinema feature is enhanced with AI capabilities to accelerate your filmmaking process",
    icon: Bot,
  },
  {
    title: "Complete AI Cinema Platform",
    description: "From initial idea to final production, AI-powered tools manage everything in one cinema platform",
    icon: LayoutDashboard,
  },
  {
    title: "AI Context-Aware Tools",
    description: "AI features understand your film project context for smarter, more relevant cinema suggestions",
    icon: Sparkles,
  },
  {
    title: "AI Production Ready",
    description: "Professional AI-powered filmmaking tools designed for real-world cinema and video production",
    icon: Camera,
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Ai Cinema Studio
            </h1>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" className="hover:bg-muted">
                Home
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
        <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent leading-tight">
              AI-Powered Cinema Features for Modern Filmmaking
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Complete suite of AI-powered filmmaking tools and cinema features. From AI writing and storyboarding to AI visual development and production management—everything enhanced with artificial intelligence.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="gradient-button neon-glow text-white">
                  Start Creating
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/subscriptions">
                <Button size="lg" variant="outline">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Key Highlights */}
        <section className="container mx-auto px-4 sm:px-6 pb-16">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {keyHighlights.map((highlight, index) => {
              const Icon = highlight.icon
              return (
                <Card key={index} className="border-border/60 bg-background/60 backdrop-blur">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">{highlight.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">{highlight.description}</CardDescription>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* Feature Categories */}
        <section className="container mx-auto px-4 sm:px-6 pb-24">
          <div className="space-y-16">
            {featureCategories.map((category, categoryIndex) => {
              const CategoryIcon = category.icon
              return (
                <div key={categoryIndex} className="space-y-6">
                  {/* Category Header */}
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center flex-shrink-0`}>
                      <CategoryIcon className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold mb-2">{category.name}</h2>
                      <p className="text-muted-foreground text-lg">{category.description}</p>
                    </div>
                  </div>

                  {/* Features Grid */}
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {category.features.map((feature, featureIndex) => {
                      const FeatureIcon = feature.icon
                      return (
                        <Card
                          key={featureIndex}
                          className="border-border/60 bg-background/60 backdrop-blur hover:shadow-lg transition-all duration-300 hover:border-primary/30"
                        >
                          <CardHeader>
                            <div className="flex items-start gap-4">
                              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center flex-shrink-0`}>
                                <FeatureIcon className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-xl mb-2">{feature.name}</CardTitle>
                                <CardDescription className="text-sm leading-relaxed">
                                  {feature.description}
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 sm:px-6 pb-24">
          <div className="max-w-4xl mx-auto">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-purple-500/5 to-cyan-500/5">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl mb-4 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                  Ready to Start Creating?
                </CardTitle>
                <CardDescription className="text-lg">
                  Join filmmakers and creators using Ai Cinema Studio to bring their visions to life.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/login">
                  <Button size="lg" className="gradient-button neon-glow text-white">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/subscriptions">
                  <Button size="lg" variant="outline">
                    View Plans
                  </Button>
                </Link>
              </CardContent>
            </Card>
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
                Ai Cinema Studio
              </span>
            </div>
            <div className="text-sm text-muted-foreground text-center md:text-right">
              © 2025 Ai Cinema Studio. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

