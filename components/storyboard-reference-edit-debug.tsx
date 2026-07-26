"use client"

import { useEffect, useState } from "react"
import { Bug, Check, Copy, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  formatStoryboardImageTrace,
  getStoryboardImageTrace,
  subscribeStoryboardImageTrace,
  type StoryboardImageTraceLine,
} from "@/lib/storyboard-image-debug"
import { useToast } from "@/hooks/use-toast"

type StoryboardReferenceEditDebugProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isRunning: boolean
  currentStep?: string
}

function levelClass(level: StoryboardImageTraceLine["level"]): string {
  switch (level) {
    case "ok":
      return "text-green-600 dark:text-green-400"
    case "warn":
      return "text-amber-600 dark:text-amber-400"
    case "error":
      return "text-red-600 dark:text-red-400"
    default:
      return "text-foreground"
  }
}

export function StoryboardReferenceEditDebug({
  open,
  onOpenChange,
  isRunning,
  currentStep,
}: StoryboardReferenceEditDebugProps) {
  const { toast } = useToast()
  const [lines, setLines] = useState<StoryboardImageTraceLine[]>(() => getStoryboardImageTrace())

  useEffect(() => {
    setLines(getStoryboardImageTrace())
    return subscribeStoryboardImageTrace(() => {
      setLines(getStoryboardImageTrace())
    })
  }, [])

  const hasError = lines.some((line) => line.level === "error")
  const lastLine = lines[lines.length - 1]

  const copyLog = async () => {
    const text = formatStoryboardImageTrace(lines)
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Debug log copied", description: "Paste it in chat or email for support." })
    } catch {
      toast({
        title: "Could not copy",
        description: text.slice(0, 500),
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[85vh] flex flex-col gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Bug className="h-5 w-5 text-amber-500" />
            Edit Image Debug
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Step-by-step trace for this edit. If it stops, the last line shows where it failed.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            ) : hasError ? (
              <X className="h-4 w-4 text-red-500" />
            ) : lines.length > 0 ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Bug className="h-4 w-4 text-muted-foreground" />
            )}
            <span>{currentStep || (isRunning ? "Working…" : hasError ? "Stopped with error" : "Ready")}</span>
          </div>
          {lastLine?.level === "error" && lastLine.detail ? (
            <p className="text-xs text-red-600 dark:text-red-400 break-words">{lastLine.detail}</p>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border/70 bg-background p-2 space-y-1 font-mono text-[11px] sm:text-xs">
          {lines.length === 0 ? (
            <p className="text-muted-foreground p-2">Waiting for edit to start…</p>
          ) : (
            lines.map((line) => (
              <div key={line.id} className={`break-words ${levelClass(line.level)}`}>
                <span className="text-muted-foreground">
                  {new Date(line.ts).toLocaleTimeString()}
                </span>{" "}
                {line.message}
                {line.detail ? <span className="text-muted-foreground"> — {line.detail}</span> : null}
              </div>
            ))
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void copyLog()} className="gap-2">
            <Copy className="h-4 w-4" />
            Copy log
          </Button>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
