"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuthReady } from "@/components/auth-hooks"
import {
  createLoadDebugTracker,
  type LoadDebugSnapshot,
} from "@/lib/load-debug"
import {
  getMoviesLoadGateReason,
  type MoviesLoadAuthDebug,
} from "@/lib/movies-load-debug-report"

export function usePageLoadDebug(pageName: string) {
  const pageMountedAtRef = useRef(Date.now())
  const loadTrackerRef = useRef<ReturnType<typeof createLoadDebugTracker> | null>(null)
  const [authReadyMs, setAuthReadyMs] = useState<number | null>(null)
  const [loadDebug, setLoadDebug] = useState<LoadDebugSnapshot | null>(null)

  const { userId, ready, session, loading: authLoading } = useAuthReady()

  const getLoadTracker = useCallback(() => {
    if (!loadTrackerRef.current) {
      loadTrackerRef.current = createLoadDebugTracker(setLoadDebug)
      loadTrackerRef.current.addNote(`${pageName} page mounted`)
    }
    return loadTrackerRef.current
  }, [pageName])

  useEffect(() => {
    getLoadTracker()
  }, [getLoadTracker])

  useEffect(() => {
    if (ready && authReadyMs == null) {
      setAuthReadyMs(Date.now() - pageMountedAtRef.current)
    }
  }, [ready, authReadyMs])

  const loadCompleteMs = useMemo(() => {
    if (!loadDebug?.phases.length) return null
    const ended = loadDebug.phases
      .filter((phase) => phase.status === "done" && phase.endedAt != null)
      .map((phase) => phase.endedAt! - loadDebug.pageLoadAt)
    return ended.length > 0 ? Math.max(...ended) : null
  }, [loadDebug])

  const authDebug = useMemo((): MoviesLoadAuthDebug => {
    const base = {
      authLoading,
      authReady: ready,
      authReadyMs,
      hasSession: Boolean(session),
      hasUserId: Boolean(userId),
      hasAccessToken: Boolean(session?.access_token),
      userId: userId ?? null,
      userEmail: session?.user?.email ?? null,
      sessionExpiresAt: session?.expires_at ?? null,
    }
    const loadGateReason = getMoviesLoadGateReason(base)
    return {
      ...base,
      loadGateStatus: loadGateReason ? ("blocked" as const) : ("ok" as const),
      loadGateReason,
    }
  }, [authLoading, ready, authReadyMs, session, userId])

  return {
    getLoadTracker,
    loadDebug,
    authDebug,
    loadCompleteMs,
    authLoading,
    ready,
    userId,
    session,
  }
}
