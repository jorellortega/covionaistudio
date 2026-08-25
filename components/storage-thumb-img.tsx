"use client"

import { useEffect, useState } from "react"
import { ImageIcon } from "lucide-react"
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

const missingOriginals = new Set<string>()
const probedUrls = new Set<string>()

function filenameOf(url: string) {
  try {
    return new URL(url).pathname.split("/").pop() || url
  } catch {
    return url.slice(0, 120)
  }
}

function parseErrorBody(body: string) {
  try {
    return JSON.parse(body) as {
      statusCode?: string
      error?: string
      message?: string
      code?: string
    }
  } catch {
    return null
  }
}

async function probeOriginalOnce(url: string) {
  if (!url || probedUrls.has(url)) return
  probedUrls.add(url)
  try {
    const response = await fetch(url, { method: "GET", cache: "no-store" })
    const body = await response.text()
    const supabase = parseErrorBody(body)
    console.warn("[storage-thumb] original missing", {
      httpStatus: response.status,
      file: filenameOf(url),
      code: supabase?.code,
      message: supabase?.message,
      url,
    })
  } catch (error) {
    console.warn("[storage-thumb] original missing", {
      file: filenameOf(url),
      error: error instanceof Error ? error.message : error,
      url,
    })
  }
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
  const [useOriginal, setUseOriginal] = useState(() => missingOriginals.has(src))
  const [missing, setMissing] = useState(() => missingOriginals.has(src))

  useEffect(() => {
    if (missingOriginals.has(src)) {
      setMissing(true)
      setUseOriginal(true)
      return
    }
    setUseOriginal(false)
    setMissing(false)
  }, [src, width, quality, resize])

  const displaySrc = useOriginal || thumb === src ? src : thumb

  if (missing) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
        title={title || "Image file is missing from storage"}
      >
        <ImageIcon className="h-8 w-8 opacity-50" />
      </div>
    )
  }

  return (
    <img
      key={displaySrc}
      src={displaySrc}
      alt={alt}
      title={title}
      loading="lazy"
      decoding="async"
      className={cn(className)}
      onError={() => {
        const canFallback = !useOriginal && displaySrc !== src
        if (canFallback) {
          setUseOriginal(true)
          return
        }
        missingOriginals.add(src)
        setMissing(true)
        void probeOriginalOnce(src)
      }}
    />
  )
}
