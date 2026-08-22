"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2 } from "lucide-react"
import type { ShotCountMode, ShotListGenerateOptions } from "@/lib/shot-list-generate-options"

interface GenerateShotListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceLabel: string
  isGenerating?: boolean
  onGenerate: (options: ShotListGenerateOptions) => void
}

export function GenerateShotListDialog({
  open,
  onOpenChange,
  sourceLabel,
  isGenerating = false,
  onGenerate,
}: GenerateShotListDialogProps) {
  const [mode, setMode] = useState<ShotCountMode>("needed")
  const [minShots, setMinShots] = useState("6")
  const [maxShots, setMaxShots] = useState("12")

  useEffect(() => {
    if (open) {
      setMode("needed")
      setMinShots("6")
      setMaxShots("12")
    }
  }, [open])

  const handleGenerate = () => {
    if (mode === "range") {
      const min = parseInt(minShots, 10)
      const max = parseInt(maxShots, 10)
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max < 1) {
        return
      }
      onGenerate({
        shotCountMode: "range",
        minShots: min,
        maxShots: max,
      })
      return
    }

    onGenerate({ shotCountMode: "needed" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Shot List</DialogTitle>
          <DialogDescription>
            Choose how many shots to create from {sourceLabel}. Default is only the shots the scene actually needs.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as ShotCountMode)}
          className="gap-3"
        >
          <label
            htmlFor="shots-needed"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              mode === "needed"
                ? "border-purple-500/50 bg-purple-500/10"
                : "border-border hover:bg-muted/40"
            }`}
          >
            <RadioGroupItem value="needed" id="shots-needed" className="mt-0.5" />
            <div>
              <div className="text-sm font-medium">Only shots needed</div>
              <p className="mt-1 text-xs text-muted-foreground">
                One setup per story beat, action, or line. No extra coverage. Recommended.
              </p>
            </div>
          </label>

          <label
            htmlFor="shots-range"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              mode === "range"
                ? "border-purple-500/50 bg-purple-500/10"
                : "border-border hover:bg-muted/40"
            }`}
          >
            <RadioGroupItem value="range" id="shots-range" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Shot range</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Set a minimum and maximum so the list stays inside a count you choose.
              </p>
              {mode === "range" && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="shot-min" className="text-xs text-muted-foreground">
                      Min
                    </Label>
                    <Input
                      id="shot-min"
                      type="number"
                      min={1}
                      max={40}
                      value={minShots}
                      onChange={(e) => setMinShots(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="shot-max" className="text-xs text-muted-foreground">
                      Max
                    </Label>
                    <Input
                      id="shot-max"
                      type="number"
                      min={1}
                      max={40}
                      value={maxShots}
                      onChange={(e) => setMaxShots(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}
            </div>
          </label>
        </RadioGroup>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button type="button" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
