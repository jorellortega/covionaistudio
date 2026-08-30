import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import {
  ArrowRight,
  Bot,
  Box,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Lightbulb,
  List,
  MapPin,
  Package,
  Play,
  ScanFace,
  Sparkles,
  Type,
  UserCircle,
  Users,
  Video,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type PromoPageId = "workspace" | "preproduction" | "production"

type PromoFeature = {
  name: string
  description: string
}

type PromoPage = {
  id: PromoPageId
  href: string
  title: string
  hero: string
  description: string
  color: string
  icon: LucideIcon
  ctaLabel: string
  ctaHref: string
  steps: { title: string; description: string }[]
  features: (PromoFeature & { icon: LucideIcon })[]
}

export const PROMO_PAGES: Record<PromoPageId, PromoPage> = {
  workspace: {
    id: "workspace",
    href: "/Workspace-promo",
    title: "Workspace",
    hero: "Write the film in one creative space",
    description:
      "Chat with AI to build screenplays, characters, and assets, then attach the work to a movie project.",
    color: "from-blue-500 to-cyan-400",
    icon: Bot,
    ctaLabel: "Open Workspace",
    ctaHref: "/new",
    steps: [
      {
        title: "Start a conversation",
        description: "Describe the story, tone, or a character and let the workspace draft with you.",
      },
      {
        title: "Save what you make",
        description: "Keep screenplays, treatments, characters, locations, and generated assets in the same project.",
      },
      {
        title: "Hand off to the film",
        description: "Link the workspace to a movie so preproduction and production pick up where you left off.",
      },
    ],
    features: [
      {
        name: "AI Workspace",
        description: "One chat that writes, revises, and organizes the creative work for a film.",
        icon: Sparkles,
      },
      {
        name: "Screenplays & treatments",
        description: "Develop the story, acts, and scene language before you schedule a shoot.",
        icon: FileText,
      },
      {
        name: "Characters & assets",
        description: "Create people, looks, and visual references from the same workspace session.",
        icon: UserCircle,
      },
      {
        name: "Movie projects",
        description: "Attach the workspace to a film so timeline, boards, and production tools stay in sync.",
        icon: Film,
      },
    ],
  },
  preproduction: {
    id: "preproduction",
    href: "/Preproduction-promo",
    title: "Preproduction",
    hero: "Prep people, places, and looks before the schedule",
    description:
      "Projects, treatments, characters, and locations — scene-level prep and breakdowns before you hit production.",
    color: "from-green-500 to-emerald-400",
    icon: Lightbulb,
    ctaLabel: "Open Treatments",
    ctaHref: "/treatments",
    steps: [
      {
        title: "Lock the story",
        description: "Use treatments and projects to set acts, tone, and what each scene needs.",
      },
      {
        title: "Build the world",
        description: "Create characters, avatars, locations, and objects so every shot has a consistent reference.",
      },
      {
        title: "Finish the package",
        description: "Generate covers, voices, and titles so the film is ready to board and schedule.",
      },
    ],
    features: [
      {
        name: "Treatments",
        description: "Shape the story, acts, and tone before scenes hit the timeline.",
        icon: FileText,
      },
      {
        name: "Characters",
        description: "Build profiles, references, and casting-ready roles for each project.",
        icon: UserCircle,
      },
      {
        name: "Avatars",
        description: "Generate multi-angle character looks for visualization and boards.",
        icon: ScanFace,
      },
      {
        name: "Locations",
        description: "Catalog places with references so shots stay consistent from board to set.",
        icon: MapPin,
      },
      {
        name: "Objects",
        description: "Track story objects and props as reusable production references.",
        icon: Box,
      },
      {
        name: "Covers, voices & titles",
        description: "Create poster art, character voices, and on-screen type before cameras roll.",
        icon: Type,
      },
    ],
  },
  production: {
    id: "production",
    href: "/Production-promo",
    title: "Production",
    hero: "Board the film and run the shoot from one movie",
    description:
      "Per film in Movies: Timeline, Storyboards, Lighting Plot, Call Sheet, Crew Sheet, Equipment List, Props List, and the shared Assets library.",
    color: "from-purple-500 to-pink-500",
    icon: Film,
    ctaLabel: "Open Movies",
    ctaHref: "/movies",
    steps: [
      {
        title: "Schedule the scenes",
        description: "Arrange the movie on the timeline, then jump into boards or shot lists from each scene.",
      },
      {
        title: "Board and generate",
        description: "Storyboard shots, assign camera and entities, and generate stills or video on the film itself.",
      },
      {
        title: "Paper the day",
        description: "Call sheets, crew, equipment, props, lighting, and assets sit next to the boards.",
      },
    ],
    features: [
      {
        name: "Timeline",
        description: "Order scenes for the movie and open storyboards or shot lists from any scene.",
        icon: Play,
      },
      {
        name: "Storyboards",
        description: "Board every shot, generate or insert images, and jump between shot numbers.",
        icon: ImageIcon,
      },
      {
        name: "Shot List",
        description: "Break scenes into shots with camera, action, and entity assignments.",
        icon: List,
      },
      {
        name: "Cinema Production",
        description: "Generate stills and video — image-to-video, lip sync, and motion tools in one view.",
        icon: Video,
      },
      {
        name: "Lighting Plot",
        description: "Plan lighting setups per scene before you walk on set.",
        icon: Zap,
      },
      {
        name: "Call Sheet",
        description: "Build call sheets for production days.",
        icon: FileText,
      },
      {
        name: "Crew Sheet",
        description: "Organize crew roles and contacts for the shoot.",
        icon: Users,
      },
      {
        name: "Equipment List",
        description: "Track cameras, lights, and kit for the production.",
        icon: Package,
      },
      {
        name: "Props List",
        description: "Keep the props inventory tied to the film.",
        icon: Box,
      },
      {
        name: "Assets",
        description: "Shared library of images, video, and files used across boards and cinema production.",
        icon: FolderOpen,
      },
    ],
  },
}

const PROMO_ORDER: PromoPageId[] = ["workspace", "preproduction", "production"]

function PromoHeader() {
  return (
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
        <div className="flex items-center gap-2 sm:gap-4">
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
  )
}

function PromoFooter() {
  return (
    <footer className="border-t border-border bg-background/50">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Ai Cinema Studio
            </span>
          </Link>
          <div className="text-sm text-muted-foreground text-center md:text-right">
            © 2026 Ai Cinema Studio. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}

export function PromoLanding({ pageId }: { pageId: PromoPageId }) {
  const page = PROMO_PAGES[pageId]
  const Icon = page.icon
  const others = PROMO_ORDER.filter((id) => id !== pageId).map((id) => PROMO_PAGES[id])

  return (
    <div className="min-h-screen bg-background">
      <PromoHeader />
      <main>
        <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-4xl mx-auto text-center">
            <div
              className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${page.color}`}
            >
              <Icon className="h-7 w-7 text-white" aria-hidden />
            </div>
            <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {page.title}
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent leading-tight">
              {page.hero}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              {page.description}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" className="gradient-button neon-glow text-white" asChild>
                <Link href={page.ctaHref}>
                  {page.ctaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/subscriptions">View Plans</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-3 max-w-5xl mx-auto">
            {page.steps.map((step, index) => (
              <Card key={step.title} className="border-border/60 bg-background/60">
                <CardHeader>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Step {index + 1}
                  </p>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{step.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">What you can do</h2>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {page.features.map((feature) => {
                const FeatureIcon = feature.icon
                return (
                  <Card key={feature.name} className="h-full border-border/60 bg-background/60">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${page.color}`}
                        >
                          <FeatureIcon className="h-5 w-5 text-white" aria-hidden />
                        </div>
                        <div>
                          <CardTitle className="text-lg mb-2">{feature.name}</CardTitle>
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
        </section>

        <section className="container mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4">Explore the rest of the studio</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {others.map((other) => {
                const OtherIcon = other.icon
                return (
                  <Link
                    key={other.id}
                    href={other.href}
                    className="group rounded-xl border border-border/60 bg-background/60 p-5 transition-colors hover:border-primary/40 hover:bg-background/80"
                  >
                    <div
                      className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${other.color}`}
                    >
                      <OtherIcon className="h-5 w-5 text-white" aria-hidden />
                    </div>
                    <h3 className="mb-1 text-lg font-semibold">{other.title}</h3>
                    <p className="text-sm text-muted-foreground">{other.description}</p>
                    <span className="mt-3 inline-flex items-center text-sm text-primary">
                      Learn more
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      </main>
      <PromoFooter />
    </div>
  )
}
