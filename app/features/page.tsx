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
  Palette,
  UserCircle,
  MapPin,
  FolderOpen,
  Bot,
  Sparkles,
  ArrowRight,
  LayoutDashboard,
  Camera,
  Wand2,
  Share2,
  List,
  Mic,
  Type,
  ScanFace,
} from "lucide-react"

export const metadata: Metadata = {
  title: "AI-Powered Cinema Features – Ai Cinema Studio",
  description:
    "Workspace, treatments, storyboards, shot lists, and cinema production in one platform. Write, visualize, and produce films with AI-powered tools.",
  keywords: [
    "AI filmmaking tools",
    "AI cinema features",
    "AI-powered film production",
    "AI filmmaking software",
    "storyboard software",
    "shot list",
    "film treatment",
    "cinema production platform",
  ],
  openGraph: {
    title: "AI-Powered Cinema Features – Ai Cinema Studio",
    description:
      "From Workspace writing to storyboards, shot lists, and cinema production—everything in one filmmaking platform.",
  },
}

const featureCategories = [
  {
    name: "Workspace",
    description: "Start in one creative space: chat with AI, draft the story, and save characters, locations, and scenes to a project.",
    icon: Sparkles,
    color: "from-blue-500 to-cyan-400",
    features: [
      {
        name: "Workspace",
        description: "AI chat that builds screenplays, treatments, characters, and assets, then links them to a movie project.",
        icon: Sparkles,
        href: "/new",
      },
      {
        name: "Treatments",
        description: "Develop the story, acts, and tone before you schedule scenes.",
        icon: FileText,
        href: "/treatments",
      },
      {
        name: "Movies",
        description: "Each film is a hub for timeline, storyboards, shot lists, production tools, and the shared asset library.",
        icon: Film,
        href: "/movies",
      },
    ],
  },
  {
    name: "Preproduction",
    description: "Scene-level prep: people, places, objects, and the covers, voices, and titles you need before cameras roll.",
    icon: Palette,
    color: "from-green-500 to-emerald-400",
    features: [
      {
        name: "Characters",
        description: "Build character profiles, references, and casting-ready roles for each project.",
        icon: UserCircle,
        href: "/characters",
      },
      {
        name: "Avatars",
        description: "Create and manage digital avatar looks for character visualization.",
        icon: ScanFace,
        href: "/avatars",
      },
      {
        name: "Locations",
        description: "Catalog locations with references so shots stay consistent across the storyboard and set.",
        icon: MapPin,
        href: "/locations",
      },
      {
        name: "Objects",
        description: "Track story objects and props as reusable production references.",
        icon: Box,
        href: "/objects",
      },
      {
        name: "Create Cover",
        description: "Generate poster and cover art for the project.",
        icon: ImageIcon,
        href: "/create-cover",
      },
      {
        name: "Create Voice",
        description: "Design and save voices for dialogue and character work.",
        icon: Mic,
        href: "/create-voice",
      },
      {
        name: "Create Titles",
        description: "Build title cards and on-screen type for the film.",
        icon: Type,
        href: "/create-titles",
      },
    ],
  },
  {
    name: "Production",
    description: "Per film: schedule scenes, board shots, generate picture and video, and run the day-of paperwork.",
    icon: Play,
    color: "from-purple-500 to-pink-500",
    features: [
      {
        name: "Timeline",
        description: "Arrange scenes for the movie and jump into storyboards or shot lists from each scene.",
        icon: Play,
        href: "/timeline",
      },
      {
        name: "Storyboards",
        description: "Board every shot, generate or insert images, set status, and jump between shot numbers.",
        icon: ImageIcon,
        href: "/storyboards",
      },
      {
        name: "Shot List",
        description: "Break scenes into shots with camera, action, and entity assignments.",
        icon: List,
        href: "/shotlist",
      },
      {
        name: "Cinema Production",
        description: "Generate stills and video for shots—image-to-video, lip sync, and motion tools in one production view.",
        icon: Video,
        href: "/cinema-production",
      },
      {
        name: "Lighting Plot",
        description: "Plan lighting setups per scene.",
        icon: Zap,
        href: "/lighting-plot",
      },
      {
        name: "Call Sheet",
        description: "Build call sheets for production days.",
        icon: FileText,
        href: "/call-sheet",
      },
      {
        name: "Crew Sheet",
        description: "Organize crew roles and contacts.",
        icon: Users,
        href: "/crew-sheet",
      },
      {
        name: "Equipment List",
        description: "Track cameras, lights, and kit for the shoot.",
        icon: Package,
        href: "/equipment-list",
      },
      {
        name: "Props List",
        description: "Keep the props inventory tied to the production.",
        icon: Box,
        href: "/props-list",
      },
      {
        name: "Assets",
        description: "Shared library of images, video, and files used across storyboards and cinema production.",
        icon: FolderOpen,
        href: "/assets",
      },
    ],
  },
  {
    name: "Collaboration & AI",
    description: "Share work, keep a prompt library, and use AI inside the tools you already opened—not a separate studio.",
    icon: Bot,
    color: "from-orange-500 to-red-500",
    features: [
      {
        name: "Live collaboration",
        description: "Invite others with a share or access code to work on scripts and scenes together.",
        icon: Share2,
        href: null,
      },
      {
        name: "Prompt Create & List",
        description: "Write reusable prompts and keep a library for consistent image, video, and writing output.",
        icon: Wand2,
        href: "/prompts-list",
      },
      {
        name: "Digital Twin",
        description: "HeyGen-powered digital twin tools for on-camera character work.",
        icon: ScanFace,
        href: "/twin",
      },
    ],
  },
]

const keyHighlights = [
  {
    title: "Workspace first",
    description: "Write and develop in Workspace, then attach the work to a movie.",
    icon: Sparkles,
  },
  {
    title: "One film, one pipeline",
    description: "Timeline, storyboards, shot lists, and cinema production all live on the movie.",
    icon: LayoutDashboard,
  },
  {
    title: "AI where you work",
    description: "Image, video, voice, and writing generation happen on the shot, scene, or workspace you're already in.",
    icon: Bot,
  },
  {
    title: "Production ready",
    description: "Call sheets, crew, equipment, props, lighting, and assets sit next to the boards so prep turns into a shoot.",
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
              <span className="text-white font-bold text-sm">ACS</span>
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
              From Workspace to the shoot
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Write in Workspace, prep characters and locations, then board shots and generate picture and video on the film itself.
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
                      const card = (
                        <Card
                          className={`h-full border-border/60 bg-background/60 backdrop-blur hover:shadow-lg transition-all duration-300 hover:border-primary/30 ${
                            feature.href ? "cursor-pointer" : ""
                          }`}
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
                      return feature.href ? (
                        <Link key={featureIndex} href={feature.href} className="block h-full">
                          {card}
                        </Link>
                      ) : (
                        <div key={featureIndex}>{card}</div>
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
                    Get Started
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
              © 2026 Ai Cinema Studio. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

