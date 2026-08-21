import Link from "next/link"
import { Bot, Lightbulb, Film, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function HomeWhatIsCard() {
  return (
    <section className="container mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
      <div className="max-w-4xl mx-auto">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-cyan-500/5 to-purple-500/5">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
                <Film className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl sm:text-2xl mb-2 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                  What is Ai Cinema Studio?
                </CardTitle>
                <CardDescription className="text-sm sm:text-base leading-relaxed">
                  A new generation AI film studio—built to make cinema with artificial intelligence.
                  Take a story from script and development through preproduction all the way to picture and video.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <Button variant="outline" className="group w-full sm:w-auto" asChild>
              <Link href="/features">
                Learn more
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

/**
 * Shared homepage content below the "Choose Your Plan" card.
 * Kept in one place so logged-in and guest home views stay in sync.
 */
export function HomeBelowFold() {
  return (
    <section className="container mx-auto px-4 sm:px-6 pb-16 sm:pb-20 md:pb-24">
      <div className="max-w-6xl mx-auto">
        <div className="mt-4 sm:mt-6 overflow-hidden rounded-lg sm:rounded-xl border border-border/50 bg-background/50">
          <div className="whitespace-nowrap will-change-transform home-marquee-track">
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

        <div className="mt-6 sm:mt-8 md:mt-10 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-3">
          <Link
            href="/new"
            className="group rounded-lg sm:rounded-xl border border-border/60 bg-background/60 p-4 sm:p-6 backdrop-blur transition-colors hover:border-primary/40 hover:bg-background/80"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <Bot className="h-5 w-5" aria-hidden />
            </div>
            <h4 className="mb-2 text-base font-semibold sm:text-lg">Workspace</h4>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Build screenplays, characters, and assets in your creative workspace.
            </p>
          </Link>
          <Link
            href="/treatments"
            className="group rounded-lg sm:rounded-xl border border-border/60 bg-background/60 p-4 sm:p-6 backdrop-blur transition-colors hover:border-primary/40 hover:bg-background/80"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <Lightbulb className="h-5 w-5" aria-hidden />
            </div>
            <h4 className="mb-2 text-base font-semibold sm:text-lg">Preproduction</h4>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Projects, Treatments, Characters, and Locations—scene-level prep and breakdowns before you hit the schedule.
            </p>
          </Link>
          <Link
            href="/movies"
            className="group rounded-lg sm:rounded-xl border border-border/60 bg-background/60 p-4 sm:p-6 backdrop-blur transition-colors hover:border-primary/40 hover:bg-background/80"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <Film className="h-5 w-5" aria-hidden />
            </div>
            <h4 className="mb-2 text-base font-semibold sm:text-lg">Production</h4>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Per film in Movies: Timeline, Storyboards, Lighting Plot, Call Sheet, Crew Sheet, Equipment List, Props List, and the shared Assets library.
            </p>
          </Link>
        </div>
      </div>
    </section>
  )
}
