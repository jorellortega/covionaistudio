"use client"

import { linkedAudioDebug } from "@/lib/linked-audio-debug"
import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react"

interface VideoWithLinkedAudioProps {
  videoUrl: string
  audioUrls?: string[]
  className?: string
  id?: string
  preload?: "auto" | "metadata" | "none"
  playsInline?: boolean
  muted?: boolean
  onLoadedMetadata?: (event: SyntheticEvent<HTMLVideoElement>) => void
  onEnded?: (event: SyntheticEvent<HTMLVideoElement>) => void
}

async function resolvePlayableAudioSrc(audioUrl: string): Promise<string> {
  if (audioUrl.startsWith("blob:") || audioUrl.startsWith("data:")) {
    return audioUrl
  }

  const response = await fetch("/api/ai/download-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ url: audioUrl }),
  })
  if (!response.ok) {
    return audioUrl
  }
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

function usePlayableAudioSrcs(audioUrls: string[]): string[] {
  const stableKey = useMemo(() => audioUrls.join("|"), [audioUrls])
  const [resolvedSrcs, setResolvedSrcs] = useState<string[]>([])

  useEffect(() => {
    if (!audioUrls.length) {
      setResolvedSrcs([])
      return
    }

    let cancelled = false
    const createdObjectUrls: string[] = []

    void (async () => {
      linkedAudioDebug("resolving audio srcs", { count: audioUrls.length })
      const nextSrcs = await Promise.all(
        audioUrls.map(async (url, index) => {
          const resolved = await resolvePlayableAudioSrc(url)
          if (resolved.startsWith("blob:") && !url.startsWith("blob:") && !url.startsWith("data:")) {
            createdObjectUrls.push(resolved)
          }
          linkedAudioDebug("resolved audio src", { index, from: url.slice(0, 48), to: resolved.slice(0, 48) })
          return resolved
        }),
      )
      if (!cancelled) {
        setResolvedSrcs(nextSrcs)
      } else {
        createdObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
      }
    })()

    return () => {
      cancelled = true
      createdObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
    }
  }, [stableKey, audioUrls])

  return resolvedSrcs
}

export function VideoWithLinkedAudio({
  videoUrl,
  audioUrls = [],
  className,
  id,
  preload = "metadata",
  playsInline = true,
  muted = false,
  onLoadedMetadata,
  onEnded,
}: VideoWithLinkedAudioProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRefs = useRef<Array<HTMLAudioElement | null>>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const wiredAudioElementsRef = useRef<WeakSet<HTMLAudioElement>>(new WeakSet())
  const isSeekingRef = useRef(false)
  const playRequestRef = useRef(0)
  const playableAudioSrcs = usePlayableAudioSrcs(audioUrls)
  const hasLinkedAudio = playableAudioSrcs.length > 0

  const getAudioElements = useCallback(() => {
    return audioRefs.current.filter((audio): audio is HTMLAudioElement => Boolean(audio))
  }, [])

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
      linkedAudioDebug("audio-context:created", { state: audioContextRef.current.state })
    }
    const ctx = audioContextRef.current
    if (ctx.state === "suspended") {
      await ctx.resume()
      linkedAudioDebug("audio-context:resumed", { state: ctx.state })
    }
    return ctx
  }, [])

  const wireAudioElement = useCallback(
    (audio: HTMLAudioElement, index: number) => {
      if (wiredAudioElementsRef.current.has(audio)) return

      const ctx = audioContextRef.current
      if (!ctx) return

      try {
        const source = ctx.createMediaElementSource(audio)
        source.connect(ctx.destination)
        wiredAudioElementsRef.current.add(audio)
        linkedAudioDebug("audio-wired", { index })
      } catch (error) {
        linkedAudioDebug("audio-wire-failed", { index, error })
      }
    },
    [],
  )

  const syncAudioTimesToVideo = useCallback(
    (reason: string) => {
      const video = videoRef.current
      const audios = getAudioElements()
      if (!video || audios.length === 0) return

      const targetTime = video.currentTime
      for (const [index, audio] of audios.entries()) {
        if (Math.abs(audio.currentTime - targetTime) < 0.02) continue
        linkedAudioDebug("sync-time", { reason, index, targetTime: targetTime.toFixed(3) })
        audio.currentTime = targetTime
      }
    },
    [getAudioElements],
  )

  const playLinkedAudio = useCallback(
    async (reason: string) => {
      if (isSeekingRef.current) {
        linkedAudioDebug("play-skipped-seeking", { reason })
        return
      }

      const video = videoRef.current
      const audios = getAudioElements()
      if (!video || audios.length === 0 || !hasLinkedAudio) return

      const requestId = ++playRequestRef.current
      linkedAudioDebug("play:start", {
        reason,
        requestId,
        trackCount: audios.length,
        videoTime: video.currentTime.toFixed(3),
      })

      await ensureAudioContext()
      for (const [index, audio] of audios.entries()) {
        wireAudioElement(audio, index)
      }

      syncAudioTimesToVideo(reason)

      const results = await Promise.allSettled(
        audios.map(async (audio, index) => {
          if (requestId !== playRequestRef.current) {
            linkedAudioDebug("play:stale", { reason, index, requestId })
            return
          }
          if (!audio.paused) {
            linkedAudioDebug("play:already-playing", { reason, index })
            return
          }
          await audio.play()
          linkedAudioDebug("play:track-started", { reason, index })
        }),
      )

      for (const [index, result] of results.entries()) {
        if (result.status === "rejected") {
          linkedAudioDebug("play:track-blocked", { reason, index, error: result.reason })
        }
      }

      linkedAudioDebug("play:done", { reason, requestId })
    },
    [ensureAudioContext, getAudioElements, hasLinkedAudio, syncAudioTimesToVideo, wireAudioElement],
  )

  const pauseLinkedAudio = useCallback(
    (reason: string) => {
      playRequestRef.current += 1
      linkedAudioDebug("pause", { reason })
      for (const audio of getAudioElements()) {
        audio.pause()
      }
    },
    [getAudioElements],
  )

  const handleVideoPlay = useCallback(() => {
    void playLinkedAudio("video-play")
  }, [playLinkedAudio])

  const handleVideoPause = useCallback(() => {
    pauseLinkedAudio("video-pause")
  }, [pauseLinkedAudio])

  const handleVideoSeeking = useCallback(() => {
    if (isSeekingRef.current) return
    isSeekingRef.current = true
    linkedAudioDebug("video-seeking", { time: videoRef.current?.currentTime.toFixed(3) })
    pauseLinkedAudio("video-seeking")
  }, [pauseLinkedAudio])

  const handleVideoSeeked = useCallback(() => {
    const video = videoRef.current
    if (!video || !hasLinkedAudio) {
      isSeekingRef.current = false
      return
    }

    linkedAudioDebug("video-seeked", { time: video.currentTime.toFixed(3), paused: video.paused })
    isSeekingRef.current = false
    syncAudioTimesToVideo("video-seeked")

    if (!video.paused) {
      void playLinkedAudio("video-seeked")
    }
  }, [hasLinkedAudio, playLinkedAudio, syncAudioTimesToVideo])

  const handleVideoEnded = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      pauseLinkedAudio("video-ended")
      onEnded?.(event)
    },
    [onEnded, pauseLinkedAudio],
  )

  useEffect(() => {
    linkedAudioDebug("mount", { videoUrl: videoUrl.slice(0, 48), trackCount: playableAudioSrcs.length })
    return () => {
      linkedAudioDebug("unmount")
      playRequestRef.current += 1
      for (const audio of getAudioElements()) {
        audio.pause()
      }
    }
  }, [getAudioElements, playableAudioSrcs.length, videoUrl])

  return (
    <div className="relative">
      <video
        ref={videoRef}
        id={id}
        src={videoUrl}
        controls
        className={className}
        preload={preload}
        playsInline={playsInline}
        muted={hasLinkedAudio || muted}
        onPlay={handleVideoPlay}
        onPause={handleVideoPause}
        onSeeking={handleVideoSeeking}
        onSeeked={handleVideoSeeked}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={handleVideoEnded}
      />
      {playableAudioSrcs.map((src, index) => (
        <audio
          key={`${src}-${index}`}
          ref={(element) => {
            audioRefs.current[index] = element
            if (element && audioContextRef.current) {
              wireAudioElement(element, index)
            }
          }}
          src={src}
          preload="auto"
          className="sr-only"
          aria-hidden
          onError={(event) => {
            linkedAudioDebug("audio-error", { index, error: event.currentTarget.error })
          }}
          onWaiting={() => linkedAudioDebug("audio-waiting", { index })}
          onStalled={() => linkedAudioDebug("audio-stalled", { index })}
        />
      ))}
    </div>
  )
}
