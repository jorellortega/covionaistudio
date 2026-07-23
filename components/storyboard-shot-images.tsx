"use client"

import { Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StoryboardImage {
  id: string
  storyboard_id: string
  user_id: string
  image_url: string
  image_name?: string | null
  is_default: boolean
  generation_model?: string | null
  generation_prompt?: string | null
  created_at: string
}

interface StoryboardShotImagesProps {
  images: StoryboardImage[]
  activeImageUrl?: string | null
  onSelect: (image: StoryboardImage) => void
  onDelete: (image: StoryboardImage) => void
  deletingImageId?: string | null
}

export function StoryboardShotImages({
  images,
  activeImageUrl,
  onSelect,
  onDelete,
  deletingImageId,
}: StoryboardShotImagesProps) {
  if (images.length === 0) return null

  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {images.length > 1 ? "Select image" : "Generated images"}
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {images.map((image) => {
          const isActive = activeImageUrl === image.image_url
          const isDeleting = deletingImageId === image.id

          return (
            <div key={image.id} className="relative flex-shrink-0">
              <button
                type="button"
                title={image.image_name || "Select image"}
                onClick={() => onSelect(image)}
                className={cn(
                  "block h-12 w-16 overflow-hidden rounded-md border-2 transition-colors",
                  isActive
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-border hover:border-primary/50",
                )}
              >
                <img
                  src={image.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
              <button
                type="button"
                title="Delete image"
                disabled={isDeleting}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(image)
                }}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <X className="h-2.5 w-2.5" />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
