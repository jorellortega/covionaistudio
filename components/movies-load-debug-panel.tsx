"use client"

import { useMemo } from "react"
import { PageLoadDebugPanel } from "@/components/page-load-debug-panel"
import type { LoadDebugSnapshot } from "@/lib/load-debug"
import type { MoviesLoadAuthDebug } from "@/lib/movies-load-debug-report"
import type { MoviesFetchMeta } from "@/lib/movie-service"

type MoviesLoadDebugPanelProps = {
  snapshot: LoadDebugSnapshot | null
  auth: MoviesLoadAuthDebug
  moviesLoading: boolean
  moviesCount: number
  sharedLoading: boolean
  loadCompleteMs: number | null
  localCacheCount?: number
  apiMeta?: MoviesFetchMeta | null
  coversPendingCount?: number
  onRetry?: () => void
  defaultOpen?: boolean
  defaultVisible?: boolean
}

export function MoviesLoadDebugPanel({
  snapshot,
  auth,
  moviesLoading,
  moviesCount,
  sharedLoading,
  loadCompleteMs,
  localCacheCount = 0,
  apiMeta = null,
  coversPendingCount = 0,
  onRetry,
  defaultOpen = false,
  defaultVisible = false,
}: MoviesLoadDebugPanelProps) {
  const coversLoading =
    coversPendingCount > 0 ||
    (snapshot?.phases.some(
      (phase) => phase.name === "Cover images" && phase.status === "running",
    ) ??
      false)

  const badges = useMemo(() => {
    const items = [
      {
        label: moviesLoading ? "movies loading" : `movies ${moviesCount} shown`,
        loading: moviesLoading,
      },
    ]
    if (sharedLoading) {
      items.push({ label: "shared loading", loading: true })
    }
    if (coversLoading) {
      items.push({
        label:
          coversPendingCount > 0
            ? `covers ${coversPendingCount} pending`
            : "covers loading",
        loading: true,
      })
    }
    return items
  }, [moviesLoading, moviesCount, sharedLoading, coversLoading, coversPendingCount])

  const stateLines = useMemo(
    () => [
      { label: "movies loading", value: String(moviesLoading) },
      { label: "movies shown", value: String(moviesCount) },
      { label: "shared loading", value: String(sharedLoading) },
      { label: "covers loading", value: String(coversLoading) },
      {
        label: "local cache on load",
        value: localCacheCount > 0 ? `${localCacheCount} movies` : "none",
      },
    ],
    [moviesLoading, moviesCount, sharedLoading, coversLoading, localCacheCount],
  )

  return (
    <PageLoadDebugPanel
      title="Movies load debug"
      pathname="/movies"
      snapshot={snapshot}
      auth={auth}
      isLoading={moviesLoading || sharedLoading || coversLoading}
      loadCompleteMs={loadCompleteMs}
      badges={badges}
      stateLines={stateLines}
      apiMeta={apiMeta}
      onRetry={onRetry}
      defaultOpen={defaultOpen}
      defaultVisible={defaultVisible}
    />
  )
}
