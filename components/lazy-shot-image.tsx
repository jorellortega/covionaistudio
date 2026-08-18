"use client"

import { useEffect, useRef, useState } from "react"
import { ImageIcon, Loader2 } from "lucide-react"
import { getStorageImageUrl } from "@/lib/storage-image-url"

type LazyShotImageProps = {
  src: string | null | undefined
  alt: string
  className?: string
  imgClassName?: string
  /** When set, load a resized Supabase thumbnail first; fall back to full `src` on error. */
  thumbnailWidth?: number
  thumbnailQuality?: number
  onLoad?: () => void
  onError?: () => void
}

/** Defer image src until near viewport to avoid dozens of parallel Supabase downloads. */
export function LazyShotImage({
  src,
  alt,
  className = "",
  imgClassName = "w-full h-full object-cover",
  thumbnailWidth,
  thumbnailQuality = 70,
  onLoad,
  onError,
}: LazyShotImageProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)
  const [failed, setFailed] = useState(false)
  const [useFull, setUseFull] = useState(false)

  const fullSrc = src || ""
  const thumbSrc =
    thumbnailWidth && fullSrc
      ? getStorageImageUrl(fullSrc, { width: thumbnailWidth, quality: thumbnailQuality })
      : fullSrc
  const displaySrc = useFull || thumbSrc === fullSrc ? fullSrc : thumbSrc

  useEffect(() => {
    setFailed(false)
    setUseFull(false)
    setShouldLoad(false)
  }, [src, thumbnailWidth, thumbnailQuality])

  useEffect(() => {
    if (!src) return
    const node = rootRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: "300px" },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [src])

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div ref={rootRef} className={`relative bg-muted ${className}`}>
      {!shouldLoad ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : failed ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      ) : (
        <img
          src={displaySrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={imgClassName}
          onLoad={() => onLoad?.()}
          onError={() => {
            if (!useFull && displaySrc !== fullSrc) {
              setUseFull(true)
              return
            }
            setFailed(true)
            onError?.()
          }}
        />
      )}
    </div>
  )
}
