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
import {
  applySceneSync,
  loadSceneSyncData,
  loadUndoStack,
  notifySceneSyncApplied,
  popUndoEntry,
  previewSceneSync,
  pushUndoEntry,
  undoSceneSync,
  verifySceneShotListCoverage,
  type SyncDirection,
  type SyncFieldChange,
  type SyncPreview,
  type SyncPreviewItem,
  type SyncUndoEntry,
  type SceneSyncData,
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
  const [pendingSyncData, setPendingSyncData] = useState<SceneSyncData | null>(null)

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
    setPendingSyncData(null)
  }

  const runPreview = useCallback(async (direction: SyncDirection) => {
    setLoading(true)
    try {
      const syncData = await loadSceneSyncData(sceneId, projectId)
      const { shots, storyboards, sceneShots, sceneShotCount, linkedOrphanCount, characterNamesById } = syncData
      setPendingSyncData(syncData)

      let plan: AISyncPlan | null = null
      let aiUsed = false

      // Storyboards → shot list copies fields directly — AI pairing/fields not used
      if (direction === "shotlist-to-storyboards") {
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
            console.warn("[scene-sync] AI unavailable:", aiData.error)
          }
        } catch (aiError) {
          console.warn("[scene-sync] AI request failed, using deterministic matching:", aiError)
        }
      }

      const nextPreview = previewSceneSync(direction, shots, storyboards, plan, {
        sceneId,
        sceneShotCount,
        linkedOrphanCount,
        sceneShots,
        characterNamesById,
      })
      const keys = new Set([...nextPreview.creates, ...nextPreview.updates].map((item) => item.key))
      setPreview(nextPreview)
      setAiPlan(plan)
      setUsedAiMatching(aiUsed)
      setSelectedKeys(keys)
      setPendingDirection(direction)
      setDialogMode("review")
      setPreviewOpen(true)

      console.log("[scene-sync] preview ready", {
        direction,
        sceneShotCount,
        linkedOrphanCount,
        storyboards: storyboards.length,
        creates: nextPreview.creates.length,
        updates: nextPreview.updates.length,
        orphans: nextPreview.orphans.length,
        debug: nextPreview.debug,
      })

      if (linkedOrphanCount > 0) {
        toast({
          title: "Found hidden shot list rows",
          description: `${linkedOrphanCount} shot${linkedOrphanCount === 1 ? "" : "s"} linked to storyboards but not on this scene — will re-attach.`,
        })
      } else if (direction === "storyboards-to-shotlist") {
        toast({
          title: "Direct copy from storyboards",
          description:
            "Each Shot # badge copies verbatim to the same shot list row. Grid order will be aligned after apply.",
        })
      } else if (!aiUsed) {
        toast({
          title: "Using shot-number matching",
          description: "Matched by links and shot numbers. Review before applying.",
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
      if (!pendingSyncData) {
        toast({
          title: "Sync data expired",
          description: "Close the dialog and run preview again before applying.",
          variant: "destructive",
        })
        return
      }

      const { shots, storyboards, sceneShots, sceneShotCount, characterNamesById } = pendingSyncData
      console.log("[scene-sync] applying with cached data", {
        storyboards: storyboards.length,
        shots: shots.length,
        sceneShots: sceneShots.length,
        sceneShotCount,
        selected: selectedCount,
      })

      const undoEntry = await applySceneSync({
        direction: pendingDirection,
        sceneId,
        projectId,
        sceneNumber,
        shots,
        sceneShots,
        storyboards,
        includeKeys: selectedKeys,
        aiPlan,
        characterNamesById,
      })
      const stack = pushUndoEntry(sceneId, undoEntry)
      setUndoCount(stack.length)

      const verified =
        pendingDirection === "storyboards-to-shotlist"
          ? await verifySceneShotListCoverage(sceneId, storyboards)
          : null

      notifySceneSyncApplied(sceneId)
      setPreviewOpen(false)
      resetDialog()
      onSynced?.()

      const created = undoEntry.createdShotIds.length
      const updated = undoEntry.updatedShots.length
      const reattached = undoEntry.updatedShots.filter(
        (row) => row.before.scene_id !== sceneId
      ).length
      const expectedTotal =
        pendingDirection === "storyboards-to-shotlist"
          ? verified?.sceneRowCount ?? sceneShotCount
          : undefined

      console.log("[scene-sync] apply complete", {
        created,
        updated,
        reattached,
        verified,
        createdShotIds: undoEntry.createdShotIds,
      })

      toast({
        title: "Sync complete",
        description:
          expectedTotal != null && verified
            ? `Updated ${updated}${created > 0 ? `, added ${created} new` : ""}${reattached > 0 ? `, re-attached ${reattached}` : ""}. Shot list now has ${verified.sceneRowCount} rows, ${verified.storyboardsCovered}/${storyboards.length} storyboards linked.${verified.missingStoryboardIds.length > 0 ? " Some storyboards may still need another sync." : ""}`
            : `Applied ${selectedCount} change${selectedCount === 1 ? "" : "s"}. Nothing was deleted.`,
      })
    } catch (error) {
      console.error("Sync apply failed:", error)
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Could not apply sync."
      toast({
        title: "Sync failed",
        description: message.includes("network") || message.includes("connection")
          ? `${message} — try Apply again without closing the preview (data is cached).`
          : message,
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
                ? ` — ${preview.shotListCount} rows on shot list · ${preview.storyboardsLinked ?? preview.debug?.storyboardsOnScene ?? "?"} / ${preview.storyboardCount} storyboards linked`
                : ""}
              {preview?.debug?.storyboardsOnScene != null &&
              preview.debug.storyboardsOnScene !== preview.storyboardCount ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {" "}
                  · {preview.storyboardCount - preview.debug.storyboardsOnScene} storyboard
                  {preview.storyboardCount - preview.debug.storyboardsOnScene === 1 ? "" : "s"} not
                  linked on shot list
                </span>
              ) : null}
              {preview?.debug?.linkedOrphanCount
                ? ` · ${preview.debug.linkedOrphanCount} off-scene linked row${preview.debug.linkedOrphanCount === 1 ? "" : "s"}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <div className="space-y-4 text-sm">
              {usedAiMatching ? (
                <div className="flex items-start gap-2 rounded-md border border-violet-500/25 bg-violet-500/5 p-3">
                  <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">AI field suggestions</p>
                    <p className="text-xs text-muted-foreground">
                      {preview.aiSummary ||
                        "Pairing uses links, shot numbers, and scene order. AI only suggests dialogue and description text."}
                    </p>
                  </div>
                </div>
              ) : null}
              {preview.debug ? (
                <details className="rounded-md border bg-muted/30 p-2 text-xs">
                  <summary className="cursor-pointer font-medium text-muted-foreground">
                    Sync debug (console: [scene-sync])
                  </summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[10px] leading-relaxed">
                    {JSON.stringify(preview.debug, null, 2)}
                  </pre>
                </details>
              ) : null}
              {preview.direction === "storyboards-to-shotlist" &&
              preview.creates.length > 0 ? (
                <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-xs">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    {preview.creates.length} shot list{" "}
                    {preview.creates.length === 1 ? "entry" : "entries"} will be added to this scene
                  </p>
                </div>
              ) : null}
              {preview.direction === "storyboards-to-shotlist" &&
              preview.storyboardCount > preview.shotListCount &&
              preview.creates.length === 0 ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
                  <p className="font-medium">Missing shot list row</p>
                  <p className="mt-1 text-muted-foreground">
                    {(() => {
                      const n = preview.storyboardCount - preview.shotListCount
                      return `${n} storyboard${n === 1 ? "" : "s"} ${n === 1 ? "has" : "have"} no shot list entry. Apply will force-create any still missing after sync.`
                    })()}
                  </p>
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
                    {preview.direction === "storyboards-to-shotlist" &&
                    preview.storyboardCount !== preview.shotListCount ? (
                      <p className="text-xs text-muted-foreground pt-1">
                        Shot list: {preview.shotListCount} →{" "}
                        <strong className="text-foreground">
                          {preview.shotListCount +
                            preview.creates.length +
                            (preview.debug?.linkedOrphanCount ?? 0)}
                        </strong>{" "}
                        entries ({preview.storyboardCount} storyboards)
                      </p>
                    ) : null}
                    {preview.direction === "shotlist-to-storyboards" &&
                    preview.shotListCount !== preview.storyboardCount ? (
                      <p className="text-xs text-muted-foreground pt-1">
                        Storyboards: {preview.storyboardCount} →{" "}
                        <strong className="text-foreground">
                          {preview.storyboardCount + preview.creates.length}
                        </strong>{" "}
                        entries ({preview.shotListCount} shot list rows)
                      </p>
                    ) : null}
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
