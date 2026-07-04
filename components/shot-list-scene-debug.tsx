"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { ShotListService } from "@/lib/shot-list-service"

type DebugSnapshot = Awaited<ReturnType<typeof ShotListService.getShotListSceneDebug>>

type ShotListSceneDebugProps = {
  sceneId: string
  uiRenderCount: number
  refreshKey?: number
}

export function ShotListSceneDebug({
  sceneId,
  uiRenderCount,
  refreshKey,
}: ShotListSceneDebugProps) {
  const [debug, setDebug] = useState<DebugSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const snapshot = await ShotListService.getShotListSceneDebug(sceneId)
      setDebug(snapshot)
      console.log("[shot-list-debug]", snapshot)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Debug load failed"
      setError(message)
      console.error("[shot-list-debug] error", e)
    } finally {
      setLoading(false)
    }
  }, [sceneId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const mismatch =
    debug &&
    (debug.displayRowCount !== uiRenderCount ||
      debug.storyboardsLinkedOnScene !== debug.storyboardCount ||
      debug.missingStoryboards.length > 0)

  return (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-amber-800 dark:text-amber-200">
            Shot list debug
          </span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {sceneId.slice(0, 8)}…
          </Badge>
          {mismatch ? (
            <Badge variant="destructive" className="text-[10px]">
              mismatch detected
            </Badge>
          ) : debug ? (
            <Badge variant="secondary" className="text-[10px]">
              ok
            </Badge>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Refresh debug
        </Button>
      </div>

      {error ? <p className="text-destructive">{error}</p> : null}

      {debug ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="DB scene rows" value={debug.sceneRowCount} />
            <Stat label="Display rows" value={debug.displayRowCount} />
            <Stat label="UI rendering" value={uiRenderCount} highlight={uiRenderCount !== debug.displayRowCount} />
            <Stat label="Storyboards" value={debug.storyboardCount} />
            <Stat
              label="Linked on scene"
              value={`${debug.storyboardsLinkedOnScene}/${debug.storyboardCount}`}
              highlight={debug.storyboardsLinkedOnScene !== debug.storyboardCount}
            />
            <Stat label="Linked orphans" value={debug.linkedOrphanCount} />
            <Stat label="Missing SB link" value={debug.missingStoryboards.length} highlight={debug.missingStoryboards.length > 0} />
            <Stat label="Unlinked rows" value={debug.unlinkedSceneRows.length} />
          </div>

          {debug.orderMismatches.length > 0 ? (
            <div className="rounded border border-orange-500/40 bg-orange-500/10 p-2 space-y-1">
              <p className="font-medium text-orange-800 dark:text-orange-200">
                sequence_order ≠ shot_number ({debug.orderMismatches.length})
              </p>
              <p className="text-muted-foreground">
                These rows were sorted by shot_number for display. Re-sync storyboards → shot list to
                fix stored order.
              </p>
              <ul className="list-disc list-inside font-mono text-[10px]">
                {debug.orderMismatches.map((r) => (
                  <li key={r.id}>
                    Shot #{r.shot_number} has sequence_order={r.sequence_order ?? "null"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {debug.shot11 ? (
            <div className="rounded border border-violet-500/30 bg-violet-500/10 p-2 space-y-1">
              <p className="font-medium text-violet-800 dark:text-violet-200">
                Shot 11 storyboard
              </p>
              <p>
                Storyboard:{" "}
                <code className="text-[10px]">{debug.shot11.storyboard?.id ?? "—"}</code> —{" "}
                {debug.shot11.storyboard?.title ?? "untitled"}
              </p>
              <p>
                Linked on scene:{" "}
                <strong>{debug.shot11.storyboard?.linkedOnScene ? "yes" : "no"}</strong> · In
                display: <strong>{debug.shot11.inUi ? "yes" : "no"}</strong>
                {debug.shot11.displayIndex != null ? (
                  <>
                    {" "}
                    · Card position:{" "}
                    <strong>
                      {debug.shot11.displayIndex} of {debug.displayRowCount}
                    </strong>
                  </>
                ) : null}
              </p>
              <p>
                Scene row:{" "}
                {debug.shot11.sceneRow
                  ? `#${debug.shot11.sceneRow.shot_number} id=${debug.shot11.sceneRow.id.slice(0, 8)}…`
                  : "none"}
              </p>
              <p>
                Off-scene linked row:{" "}
                {debug.shot11.linkedRow
                  ? `#${debug.shot11.linkedRow.shot_number} scene=${debug.shot11.linkedRow.scene_id?.slice(0, 8) ?? "null"}…`
                  : "none"}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No storyboard with shot_number 11 in this scene.</p>
          )}

          {debug.missingStoryboards.length > 0 ? (
            <div>
              <p className="font-medium mb-1 text-amber-800 dark:text-amber-200">
                Storyboards without a shot list row on this scene
              </p>
              <ul className="list-disc list-inside space-y-0.5 font-mono text-[10px]">
                {debug.missingStoryboards.map((sb) => (
                  <li key={sb.id}>
                    SB #{sb.shot_number} {sb.title} — {sb.id}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <details>
            <summary className="cursor-pointer font-medium text-muted-foreground">
              All display rows ({debug.rows.length})
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/40 p-2 text-[10px] leading-relaxed">
              {JSON.stringify(debug.rows, null, 2)}
            </pre>
          </details>

          <details>
            <summary className="cursor-pointer font-medium text-muted-foreground">
              All storyboards ({debug.storyboards.length})
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/40 p-2 text-[10px] leading-relaxed">
              {JSON.stringify(debug.storyboards, null, 2)}
            </pre>
          </details>

          <p className="text-[10px] text-muted-foreground">
            Console: filter <code>[shot-list-debug]</code> · loaded {debug.loadedAt}
          </p>
        </>
      ) : loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading debug…
        </div>
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded border px-2 py-1.5 ${
        highlight ? "border-destructive/50 bg-destructive/10" : "border-border bg-background/50"
      }`}
    >
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono font-semibold">{value}</p>
    </div>
  )
}
