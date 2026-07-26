"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StoryboardsService, type Storyboard } from "@/lib/storyboards-service"
import { displayShotNumber, shotOrderValue, sortStoryboardRows } from "@/lib/shot-list-order"
import { useToast } from "@/hooks/use-toast"
import { ArrowDown, ArrowLeftRight, ArrowUp, Loader2 } from "lucide-react"

type StoryboardShotPositionEditorProps = {
  storyboard: Storyboard
  storyboards: Storyboard[]
  sceneId: string
  onChanged: (updated?: Storyboard) => void | Promise<void>
  disabled?: boolean
}

export function StoryboardShotPositionEditor({
  storyboard,
  storyboards,
  sceneId,
  onChanged,
  disabled = false,
}: StoryboardShotPositionEditorProps) {
  const { toast } = useToast()
  const [value, setValue] = useState(String(shotOrderValue(storyboard)))
  const [saving, setSaving] = useState(false)

  const ordered = useMemo(() => sortStoryboardRows(storyboards), [storyboards])
  const currentIndex = ordered.findIndex((sb) => sb.id === storyboard.id)
  const currentLabel = displayShotNumber(storyboard)
  const parsed = parseFloat(value)
  const valid = Number.isFinite(parsed) && parsed > 0
  const hasNeighborBefore = currentIndex > 0
  const hasNeighborAfter = currentIndex >= 0 && currentIndex < ordered.length - 1
  const neighborBefore = hasNeighborBefore ? ordered[currentIndex - 1] : null
  const neighborAfter = hasNeighborAfter ? ordered[currentIndex + 1] : null

  useEffect(() => {
    setValue(String(shotOrderValue(storyboard)))
  }, [storyboard.id, storyboard.shot_number, storyboard.sequence_order])

  const runMove = async () => {
    if (!valid) {
      toast({
        title: "Invalid position",
        description: "Enter a number greater than 0, e.g. 11.5 to place between shots 11 and 12.",
        variant: "destructive",
      })
      return
    }

    if (Math.abs(parsed - shotOrderValue(storyboard)) < 0.001) {
      return
    }

    setSaving(true)
    try {
      const updated = await StoryboardsService.moveStoryboardToSequenceOrder(
        sceneId,
        storyboard.id,
        parsed,
      )
      toast({
        title: "Shot moved",
        description: `"${storyboard.title}" is now Shot ${displayShotNumber(updated)}.`,
      })
      await onChanged(updated)
    } catch (error) {
      console.error("Failed to move shot:", error)
      toast({
        title: "Could not move shot",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const runSwap = async (direction: "previous" | "next") => {
    const neighbor = direction === "previous" ? neighborBefore : neighborAfter
    if (!neighbor) return

    setSaving(true)
    try {
      await StoryboardsService.swapStoryboardWithNeighbor(sceneId, storyboard.id, direction)
      const refreshed = await StoryboardsService.getStoryboard(storyboard.id)
      toast({
        title: "Shots swapped",
        description: `Shot ${currentLabel} swapped with Shot ${displayShotNumber(neighbor)}.`,
      })
      await onChanged(refreshed ?? undefined)
    } catch (error) {
      console.error("Failed to swap shots:", error)
      toast({
        title: "Could not swap shots",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">Shot position</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Currently Shot {currentLabel} in this scene. Use decimals like 11.5 to place between shots
          11 and 12.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`shot-position-${storyboard.id}`} className="text-xs">
          Move to position
        </Label>
        <div className="flex gap-2">
          <Input
            id={`shot-position-${storyboard.id}`}
            type="number"
            min={0.1}
            step={0.1}
            value={value}
            disabled={disabled || saving}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) void runMove()
            }}
            placeholder="e.g. 11.5"
          />
          <Button
            type="button"
            size="sm"
            disabled={disabled || saving || !valid}
            onClick={() => void runMove()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-8"
          disabled={disabled || saving || !hasNeighborBefore}
          onClick={() => void runSwap("previous")}
        >
          <ArrowUp className="h-3 w-3 mr-1" />
          Swap earlier
          {neighborBefore ? ` (${displayShotNumber(neighborBefore)})` : ""}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-8"
          disabled={disabled || saving || !hasNeighborAfter}
          onClick={() => void runSwap("next")}
        >
          <ArrowDown className="h-3 w-3 mr-1" />
          Swap later
          {neighborAfter ? ` (${displayShotNumber(neighborAfter)})` : ""}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <ArrowLeftRight className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Whole-number moves renumber the scene. Decimal moves only reposition this shot without
          changing others.
        </span>
      </p>
    </div>
  )
}
