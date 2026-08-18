"use client"

import {
  useEffect,
  useRef,
  type MouseEvent,
  type SyntheticEvent,
  type VideoHTMLAttributes,
} from "react"
import { Film, Play } from "lucide-react"
import { getStorageImageUrl } from "@/lib/storage-image-url"
import { cn } from "@/lib/utils"

type LazyShotVideoProps = Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "src" | "poster" | "preload"
> & {
  src: string
  /** Shot still shown instead of downloading the video file */
  posterSrc?: string | null
  posterWidth?: number
  className?: string
  videoClassName?: string
  /**
   * When false, the video URL is not attached (poster only).
   * Set true when the user plays, or when a sequence needs the clip.
   */
  loadVideo?: boolean
  /** Click-to-load play button when video is not loaded yet */
  showPlayOverlay?: boolean
  onRequestLoad?: () => void
}

/**
 * Show a light still poster first. Only attach the video `src` when `loadVideo`
 * is true so scrolling a long shot list doesn't download every clip.
 */
export function LazyShotVideo({
  src,
  posterSrc,
  posterWidth = 720,
  className,
  videoClassName,
  loadVideo = false,
  showPlayOverlay = true,
  onRequestLoad,
  muted = true,
  playsInline = true,
  controls,
  onEnded,
  onLoadedMetadata,
  id,
  ...rest
}: LazyShotVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pendingPlayRef = useRef(false)

  const poster = posterSrc
    ? getStorageImageUrl(posterSrc, {
        width: posterWidth,
        quality: 70,
        resize: "contain",
      })
    : undefined

  useEffect(() => {
    if (!loadVideo) return
    const video = videoRef.current
    if (!video) return
    video.load()
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false
      void video.play().catch(() => {})
    }
  }, [loadVideo, src])

  const handleOverlayPlay = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    pendingPlayRef.current = true
    onRequestLoad?.()
    if (loadVideo) {
      const video = videoRef.current
      if (video) void video.play().catch(() => {})
    }
  }

  return (
    <div className={cn("relative bg-muted overflow-hidden", className)}>
      <video
        ref={videoRef}
        id={id}
        src={loadVideo ? src : undefined}
        poster={poster}
        className={cn("w-full h-full object-contain", videoClassName)}
        muted={muted}
        playsInline={playsInline}
        controls={Boolean(controls && loadVideo)}
        preload="none"
        onEnded={onEnded}
        onLoadedMetadata={
          onLoadedMetadata as ((e: SyntheticEvent<HTMLVideoElement>) => void) | undefined
        }
        {...rest}
      />
      {!poster && !loadVideo ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Film className="h-8 w-8 text-muted-foreground" />
        </div>
      ) : null}
      {showPlayOverlay && !loadVideo ? (
        <button
          type="button"
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
          onClick={handleOverlayPlay}
          title="Play video"
        >
          <span className="rounded-full bg-black/70 text-white p-3">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </button>
      ) : null}
    </div>
  )
}
