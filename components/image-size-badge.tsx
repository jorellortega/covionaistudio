"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

type ImageSizeBadgeProps = {
  src?: string | null
  className?: string
}

/** Tiny WxH label from the image's natural pixel dimensions. */
export function ImageSizeBadge({ src, className }: ImageSizeBadgeProps) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!src) {
      setLabel(null)
      return
    }

    let cancelled = false
    const img = new window.Image()
    img.onload = () => {
      if (cancelled) return
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setLabel(`${img.naturalWidth}×${img.naturalHeight}`)
      } else {
        setLabel(null)
      }
    }
    img.onerror = () => {
      if (!cancelled) setLabel(null)
    }
    img.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  if (!label) return null

  return (
    <span
      className={cn(
        "absolute bottom-1.5 left-1.5 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-mono leading-none text-white/95 pointer-events-none",
        className,
      )}
      title={`Image size: ${label}`}
    >
      {label}
    </span>
  )
}
