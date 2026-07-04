"use client"

import { useEffect, useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StoryboardsService, type Storyboard } from "@/lib/storyboards-service"
import { useToast } from "@/hooks/use-toast"
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Loader2 } from "lucide-react"

type StoryboardShotNumberPopoverProps = {
  storyboard: Storyboard
  storyboards: Storyboard[]
  sceneId: string
  onChanged: () => void | Promise<void>
}

export function StoryboardShotNumberPopover({
  storyboard,
  storyboards,
  sceneId,
  onChanged,
}: StoryboardShotNumberPopoverProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(storyboard.shot_number || 1))
  const [saving, setSaving] = useState(false)

  const current = Number(storyboard.shot_number) || 1
  const maxShot = storyboards.length || 1
  const parsed = parseInt(value, 10)
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= maxShot
  const target = valid ? parsed : current

  const shiftHint = useMemo(() => {
    if (!valid || target === current) return null
    if (current > target) {
      if (current - target === 1) {
        return `Shot ${current} moves to ${target}; former Shot ${target} becomes ${target + 1}.`
      }
      return `Shots ${target}–${current - 1} shift down to ${target + 1}–${current}.`
    }
    if (target - current === 1) {
      return `Shot ${current} moves to ${target}; former Shot ${target} becomes ${target - 1}.`
    }
    return `Shots ${current + 1}–${target} shift up to ${current}–${target - 1}.`
  }, [valid, target, current])

  useEffect(() => {
    if (open) setValue(String(storyboard.shot_number || 1))
  }, [open, storyboard.shot_number])

  const apply = async (newNum: number) => {
    const clamped = Math.max(1, Math.min(Math.round(newNum), maxShot))
    if (!Number.isFinite(clamped) || clamped < 1) {
      toast({
        title: "Invalid shot number",
        description: `Enter a number between 1 and ${maxShot}.`,
        variant: "destructive",
      })
      return
    }
    if (clamped === current) {
      setOpen(false)
      return
    }

    setSaving(true)
    try {
      await StoryboardsService.moveStoryboardToShotNumber(sceneId, storyboard.id, clamped)
      toast({
        title: "Shot order updated",
        description: `"${storyboard.title}" is now Shot ${clamped}. Other shots were renumbered.`,
      })
      setOpen(false)
      await onChanged()
    } catch (error) {
      console.error("Failed to reorder shot:", error)
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: string }).code)
          : ""
      toast({
        title: "Could not reorder shot",
        description:
          code === "23505"
            ? "Database conflict while renumbering — refresh and try again."
            : error instanceof Error
              ? error.message
              : "Try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Change shot order"
          className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-xs sm:text-sm font-bold flex-shrink-0 cursor-pointer ring-offset-background transition hover:scale-105 hover:ring-2 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {current}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div>
          <p className="font-medium text-sm">Move shot in sequence</p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {storyboard.title}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`shot-num-${storyboard.id}`} className="text-xs">
            Move to position (1–{maxShot})
          </Label>
          <Input
            id={`shot-num-${storyboard.id}`}
            type="number"
            min={1}
            max={maxShot}
            step={1}
            value={value}
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) void apply(parsed)
            }}
          />
          {shiftHint ? (
            <p className="text-[11px] text-muted-foreground">{shiftHint}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8"
            disabled={saving || current <= 1}
            onClick={() => void apply(current - 1)}
          >
            <ArrowUp className="h-3 w-3 mr-1" />
            One earlier
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8"
            disabled={saving || current >= maxShot}
            onClick={() => void apply(current + 1)}
          >
            <ArrowDown className="h-3 w-3 mr-1" />
            One later
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8"
            disabled={saving || current === 1}
            onClick={() => void apply(1)}
          >
            <ChevronsUp className="h-3 w-3 mr-1" />
            First
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8"
            disabled={saving || current === maxShot}
            onClick={() => void apply(maxShot)}
          >
            <ChevronsDown className="h-3 w-3 mr-1" />
            Last
          </Button>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || !valid}
            onClick={() => void apply(parsed)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
