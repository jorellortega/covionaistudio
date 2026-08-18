"use client"

import { useEffect, useState } from "react"
import { getStorageImageUrl, type StorageImageTransform } from "@/lib/storage-image-url"
import { cn } from "@/lib/utils"

type StorageThumbImgProps = {
  src: string
  alt?: string
  className?: string
  width?: number
  quality?: number
  resize?: StorageImageTransform["resize"]
  title?: string
}

/** Lightweight resized Supabase image with fallback to the original URL. */
export function StorageThumbImg({
  src,
  alt = "",
  className,
  width = 720,
  quality = 70,
  resize = "contain",
  title,
}: StorageThumbImgProps) {
  const thumb = getStorageImageUrl(src, { width, quality, resize })
  const [displaySrc, setDisplaySrc] = useState(thumb)

  useEffect(() => {
    setDisplaySrc(getStorageImageUrl(src, { width, quality, resize }))
  }, [src, width, quality, resize])

  return (
    <img
      src={displaySrc}
      alt={alt}
      title={title}
      loading="lazy"
      decoding="async"
      className={cn(className)}
      onError={() => {
        if (displaySrc !== src) setDisplaySrc(src)
      }}
    />
  )
}
