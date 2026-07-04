"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, RefreshCw, Undo2, Pencil, ArrowLeft, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShotListService } from "@/lib/shot-list-service"
import { StoryboardsService } from "@/lib/storyboards-service"
import {
  applySceneSync,
  loadUndoStack,
  popUndoEntry,
  previewSceneSync,
  pushUndoEntry,
  undoSceneSync,
  type SyncDirection,
  type SyncFieldChange,
  type SyncPreview,
  type SyncPreviewItem,
  type SyncUndoEntry,
} from "@/lib/scene-shot-sync"
import type { AISyncPlan } from "@/lib/scene-sync-ai"

type SceneSyncControlsProps = {
  sceneId: string
  projectId?: string
  sceneNumber?: number
  primaryDirection: SyncDirection
  onSynced?: () => void
  className?: string
}

type DialogMode = "review" | "edit"

function directionLabel(direction: SyncDirection): string {
  return direction === "storyboards-to-shotlist"
    ? "Storyboards → Shot List"
    : "Shot List → Storyboards"
}

function ChangeTable({ rows }: { rows: SyncFieldChange[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No field changes</p>
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th className="px-2 py-1.5 font-medium">Field</th>
            <th className="px-2 py-1.5 font-medium">Current</th>
            <th className="px-2 py-1.5 font-medium">After sync</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field} className="border-b last:border-0">
              <td className="px-2 py-1.5 text-muted-foreground">{row.field}</td>
              <td className="px-2 py-1.5 max-w-[120px] truncate" title={row.before}>
                {row.before}
              </td>
              <td className="px-2 py-1.5 max-w-[120px] truncate font-medium text-primary" title={row.after}>
                {row.after}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SyncChangeCard({
  item,
  editable,
  checked,
  onCheckedChange,
}: {
  item: SyncPreviewItem
  editable: boolean
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const rows = item.kind === "create" ? item.createFields ?? [] : item.changes ?? []
  const badgeVariant =
    item.kind === "create" ? "default" : item.kind === "update" ? "secondary" : "outline"

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        editable && !checked ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {editable ? (
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => onCheckedChange(value === true)}
            className="mt-0.5"
            aria-label={`Include shot ${item.shotNumber}`}
          />
        ) : null}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariant} className="text-[10px] uppercase">
              {item.kind === "create" ? "Add" : item.kind === "update" ? "Update" : "Skip"}
            </Badge>
            <span className="text-sm font-medium">
              Shot {item.shotNumber}: {item.label}
            </span>
          </div>
          {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
        </div>
      </div>
      {(item.kind === "create" || item.kind === "update") && rows.length > 0 ? (
        <ChangeTable rows={rows} />
      ) : null}
    </div>
  )
}

function OrphanList({ items }: { items: SyncPreviewItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Left unchanged</span>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      <ul className="rounded-md border bg-muted/20 p-2 text-xs space-y-1">
        {items.map((item) => (
          <li key={item.key}>
            <span className="font-medium">Shot {item.shotNumber}:</span> {item.label}
            {item.detail ? <span className="text-muted-foreground"> — {item.detail}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SceneSyncControls({
  sceneId,
  projectId,
  sceneNumber,
  primaryDirection,
  onSynced,
  className,
}: SceneSyncControlsProps) {
  const { toast } = useToast()
  const [undoCount, setUndoCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>("review")
  const [preview, setPreview] = useState<SyncPreview | null>(null)
  const [pendingDirection, setPendingDirection] = useState<SyncDirection | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [aiPlan, setAiPlan] = useState<AISyncPlan | null>(null)
  const [usedAiMatching, setUsedAiMatching] = useState(false)

  useEffect(() => {
    setUndoCount(loadUndoStack(sceneId).length)
  }, [sceneId])

  const actionableItems = useMemo(() => {
    if (!preview) return []
    return [...preview.creates, ...preview.updates]
  }, [preview])

  const selectedCount = useMemo(() => {
    return actionableItems.filter((item) => selectedKeys.has(item.key)).length
  }, [actionableItems, selectedKeys])

  const resetDialog = () => {
    setDialogMode("review")
    setPreview(null)
    setPendingDirection(null)
    setSelectedKeys(new Set())
    setAiPlan(null)
    setUsedAiMatching(false)
  }

  const runPreview = useCallback(async (direction: SyncDirection) => {
    setLoading(true)
    try {
      const [shots, storyboards] = await Promise.all([
        ShotListService.getShotListsByScene(sceneId),
        StoryboardsService.getStoryboardsByScene(sceneId),
      ])

      let plan: AISyncPlan | null = null
      let aiUsed = false

      try {
        const aiRes = await fetch("/api/scene-sync/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction, shots, storyboards }),
        })
        const aiData = await aiRes.json()
        if (aiRes.ok && aiData.plan?.operations?.length) {
          plan = aiData.plan as AISyncPlan
          aiUsed = true
        } else if (!aiRes.ok && !aiData.fallback) {
          console.warn("[sync] AI unavailable:", aiData.error)
        }
      } catch (aiError) {
        console.warn("[sync] AI request failed, using shot-number matching:", aiError)
      }

      const nextPreview = previewSceneSync(direction, shots, storyboards, plan)
      const keys = new Set([...nextPreview.creates, ...nextPreview.updates].map((item) => item.key))
      setPreview(nextPreview)
      setAiPlan(plan)
      setUsedAiMatching(aiUsed)
      setSelectedKeys(keys)
      setPendingDirection(direction)
      setDialogMode("review")
      setPreviewOpen(true)

      if (!aiUsed) {
        toast({
          title: "Using basic matching",
          description: "AI matching unavailable — matched by shot number and links. You can still review before applying.",
        })
      }
    } catch (error) {
      console.error("Sync preview failed:", error)
      toast({
        title: "Preview failed",
        description: error instanceof Error ? error.message : "Could not load sync preview.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [sceneId, toast])

  const handleApply = async () => {
    if (!pendingDirection || !preview) return
    if (selectedCount === 0) {
      toast({
        title: "Nothing selected",
        description: "Choose at least one change to apply, or cancel.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const [shots, storyboards] = await Promise.all([
        ShotListService.getShotListsByScene(sceneId),
        StoryboardsService.getStoryboardsByScene(sceneId),
      ])
      const undoEntry = await applySceneSync({
        direction: pendingDirection,
        sceneId,
        projectId,
        sceneNumber,
        shots,
        storyboards,
        includeKeys: selectedKeys,
        aiPlan,
      })
      const stack = pushUndoEntry(sceneId, undoEntry)
      setUndoCount(stack.length)
      setPreviewOpen(false)
      resetDialog()
      onSynced?.()
      toast({
        title: "Sync complete",
        description: `Applied ${selectedCount} change${selectedCount === 1 ? "" : "s"}. Nothing was deleted.`,
      })
    } catch (error) {
      console.error("Sync apply failed:", error)
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Could not apply sync.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUndo = async () => {
    const entry: SyncUndoEntry | null = popUndoEntry(sceneId)
    if (!entry) {
      toast({
        title: "Nothing to undo",
        description: "No recent sync to revert.",
        variant: "destructive",
      })
      return
    }
    setUndoing(true)
    try {
      await undoSceneSync(entry)
      setUndoCount(loadUndoStack(sceneId).length)
      onSynced?.()
      toast({
        title: "Sync undone",
        description: `Reverted ${directionLabel(entry.direction)}.`,
      })
    } catch (error) {
      console.error("Sync undo failed:", error)
      pushUndoEntry(sceneId, entry)
      setUndoCount(loadUndoStack(sceneId).length)
      toast({
        title: "Undo failed",
        description: error instanceof Error ? error.message : "Could not undo sync.",
        variant: "destructive",
      })
    } finally {
      setUndoing(false)
    }
  }

  const toggleItem = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const secondaryDirection: SyncDirection =
    primaryDirection === "storyboards-to-shotlist"
      ? "shotlist-to-storyboards"
      : "storyboards-to-shotlist"

  const nothingToApply = !preview || (preview.creates.length === 0 && preview.updates.length === 0)

  return (
    <>
      <div className={className}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || undoing}
            onClick={() => void runPreview(primaryDirection)}
            className="text-xs sm:text-sm"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 sm:mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 sm:mr-1.5" />
            )}
            <span className="hidden sm:inline">
              Sync to {primaryDirection === "storyboards-to-shotlist" ? "Shot List" : "Storyboards"}
            </span>
            <span className="sm:hidden">Sync</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading || undoing}
            onClick={() => void runPreview(secondaryDirection)}
            className="text-xs text-muted-foreground"
          >
            Other direction
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={undoCount === 0 || loading || undoing}
            onClick={() => void handleUndo()}
            className="text-xs sm:text-sm"
          >
            {undoing ? (
              <Loader2 className="h-4 w-4 sm:mr-1.5 animate-spin" />
            ) : (
              <Undo2 className="h-4 w-4 sm:mr-1.5" />
            )}
            Undo{undoCount > 0 ? ` (${undoCount})` : ""}
          </Button>
        </div>
      </div>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open)
          if (!open) resetDialog()
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "review" ? "Review sync changes" : "Edit sync selection"}
            </DialogTitle>
            <DialogDescription>
              {pendingDirection ? directionLabel(pendingDirection) : ""}
              {preview
                ? ` — ${preview.shotListCount} shot list · ${preview.storyboardCount} storyboards`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <div className="space-y-4 text-sm">
              {usedAiMatching ? (
                <div className="flex items-start gap-2 rounded-md border border-violet-500/25 bg-violet-500/5 p-3">
                  <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">AI-assisted matching</p>
                    <p className="text-xs text-muted-foreground">
                      {preview.aiSummary ||
                        "Shots were matched by dialogue, action, and description — not just shot numbers."}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1">
                {nothingToApply ? (
                  <p className="font-medium">Already in sync — nothing would change.</p>
                ) : (
                  <>
                    <p className="font-medium">Here&apos;s what this sync would do:</p>
                    <ul className="text-muted-foreground text-xs space-y-0.5 list-disc list-inside">
                      {preview.creates.length > 0 ? (
                        <li>
                          <strong className="text-foreground">{preview.creates.length}</strong> new{" "}
                          {preview.direction === "storyboards-to-shotlist" ? "shot list entries" : "storyboards"}{" "}
                          will be added
                        </li>
                      ) : null}
                      {preview.updates.length > 0 ? (
                        <li>
                          <strong className="text-foreground">{preview.updates.length}</strong> existing items will be
                          updated
                        </li>
                      ) : null}
                      {preview.orphans.length > 0 ? (
                        <li>
                          <strong className="text-foreground">{preview.orphans.length}</strong> items left unchanged
                          (not deleted, images preserved)
                        </li>
                      ) : null}
                    </ul>
                  </>
                )}
              </div>

              {dialogMode === "edit" ? (
                <p className="text-xs text-muted-foreground">
                  Uncheck any shot you don&apos;t want included. Apply will only run checked items.
                </p>
              ) : null}

              {actionableItems.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    {dialogMode === "edit" ? "Select changes" : "Changes"}
                    {!nothingToApply ? (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        ({selectedCount} of {actionableItems.length} selected)
                      </span>
                    ) : null}
                  </p>
                  {actionableItems.map((item) => (
                    <SyncChangeCard
                      key={item.key}
                      item={item}
                      editable={dialogMode === "edit"}
                      checked={selectedKeys.has(item.key)}
                      onCheckedChange={(checked) => toggleItem(item.key, checked)}
                    />
                  ))}
                </div>
              ) : null}

              <OrphanList items={preview.orphans} />
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>

            {dialogMode === "review" ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || nothingToApply}
                  onClick={() => setDialogMode("edit")}
                >
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Edit selection
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={loading || nothingToApply || selectedCount === 0}
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Apply sync
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setDialogMode("review")}
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back to review
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={loading || selectedCount === 0}
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Apply selected ({selectedCount})
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
