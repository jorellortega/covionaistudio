"use client"

import { useRouter } from "next/navigation"
import { Film, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SceneView = "shotlist" | "storyboards"

type SceneViewSwitcherProps = {
  sceneId: string
  activeView: SceneView
  className?: string
}

export function SceneViewSwitcher({ sceneId, activeView, className }: SceneViewSwitcherProps) {
  const router = useRouter()

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-primary/30 bg-muted/40 p-0.5",
        className
      )}
      role="tablist"
      aria-label="Scene view"
    >
      <Button
        type="button"
        role="tab"
        aria-selected={activeView === "shotlist"}
        variant={activeView === "shotlist" ? "default" : "ghost"}
        size="sm"
        className="h-8 px-3 text-xs sm:text-sm"
        onClick={() => {
          if (activeView !== "shotlist") router.push(`/shotlist/${sceneId}`)
        }}
      >
        <List className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">Shot List</span>
      </Button>
      <Button
        type="button"
        role="tab"
        aria-selected={activeView === "storyboards"}
        variant={activeView === "storyboards" ? "default" : "ghost"}
        size="sm"
        className="h-8 px-3 text-xs sm:text-sm"
        onClick={() => {
          if (activeView !== "storyboards") router.push(`/storyboards/${sceneId}`)
        }}
      >
        <Film className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">Storyboards</span>
      </Button>
    </div>
  )
}
