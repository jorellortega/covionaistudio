import { AssetService } from "@/lib/asset-service"
import { IdeaImagesService } from "@/lib/idea-images-service"
import type { Movie } from "@/lib/movie-service"
import { MovieIdeasService } from "@/lib/movie-ideas-service"
import { TreatmentsService } from "@/lib/treatments-service"

export const PLACEHOLDER_THUMBNAIL = "/placeholder.svg?height=300&width=200"

export type MovieCoverResolveStats = {
  /** Covers found from treatment / assets / ideas (not already on movie.thumbnail) */
  resolved: number
  /** Movies that already had a usable thumbnail on the row */
  fromThumbnail: number
  /** Movies with no cover source found */
  missing: number
  total: number
}

export type MovieCoverResolveResult = {
  covers: Record<string, string>
  stats: MovieCoverResolveStats
}

export function hasUsableThumbnail(thumbnail: string | null | undefined) {
  return Boolean(
    thumbnail && thumbnail.trim() && thumbnail !== PLACEHOLDER_THUMBNAIL,
  )
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

/** Resolve cover URLs for the movies grid with batched DB calls instead of per-movie waterfalls. */
export async function resolveMovieCoverImages(
  movies: Movie[],
  userId: string,
): Promise<MovieCoverResolveResult> {
  const coverImageMap: Record<string, string> = {}
  let fromThumbnail = 0
  const needsCover: Movie[] = []

  for (const movie of movies) {
    if (hasUsableThumbnail(movie.thumbnail)) {
      coverImageMap[movie.id] = movie.thumbnail!
      fromThumbnail++
      continue
    }
    needsCover.push(movie)
  }

  if (needsCover.length > 0) {
    const treatmentIds = [
      ...new Set(
        needsCover.map((m) => m.treatment_id).filter((id): id is string => Boolean(id)),
      ),
    ]

    const treatmentCoverById = await TreatmentsService.getTreatmentCoverUrlsByIds(treatmentIds)
    const stillNeedsCover: Movie[] = []

    for (const movie of needsCover) {
      if (movie.treatment_id) {
        const cover = treatmentCoverById.get(movie.treatment_id)
        if (cover) {
          coverImageMap[movie.id] = cover
          continue
        }
      }
      stillNeedsCover.push(movie)
    }

    if (stillNeedsCover.length > 0) {
      const projectIds = stillNeedsCover.map((m) => m.id)
      const assetsByProject = await AssetService.getCoverImageAssetsForProjects(projectIds)

      const needsIdeaMatch: Movie[] = []
      for (const movie of stillNeedsCover) {
        const assets = assetsByProject.get(movie.id) || []
        if (assets.length > 0) {
          const defaultCover = assets.find((a) => a.is_default_cover)
          coverImageMap[movie.id] = (defaultCover || assets[0]).content_url!
          continue
        }
        needsIdeaMatch.push(movie)
      }

      if (needsIdeaMatch.length > 0) {
        const ideas = await MovieIdeasService.getUserIdeas(userId)
        const ideasByTitle = new Map(
          ideas.map((idea) => [idea.title.toLowerCase().trim(), idea]),
        )

        await Promise.all(
          needsIdeaMatch.map(async (movie) => {
            const matchingIdea = ideasByTitle.get(movie.name.toLowerCase().trim())
            if (!matchingIdea) return
            try {
              const ideaImages = await IdeaImagesService.getIdeaImages(matchingIdea.id)
              const imageFiles = ideaImages.filter((img) =>
                img.image_url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i),
              )
              if (imageFiles.length > 0) {
                coverImageMap[movie.id] = imageFiles[0].image_url
              }
            } catch {
              /* optional fallback */
            }
          }),
        )
      }
    }
  }

  const resolved = Object.keys(coverImageMap).length - fromThumbnail
  const missing = movies.length - Object.keys(coverImageMap).length

  return {
    covers: coverImageMap,
    stats: {
      resolved,
      fromThumbnail,
      missing,
      total: movies.length,
    },
  }
}

/**
 * Apply resolved covers top-to-bottom after the movie list is visible.
 * Movies that already have thumbnails are skipped (already painted).
 */
export async function streamMovieCoversInOrder(
  moviesInDisplayOrder: Movie[],
  userId: string,
  options: {
    onCover: (movieId: string, url: string) => void
    onCoverStart?: (movieId: string) => void
    isCancelled?: () => boolean
    staggerMs?: number
  },
): Promise<MovieCoverResolveResult> {
  const { onCover, onCoverStart, isCancelled, staggerMs = 60 } = options
  const { covers, stats } = await resolveMovieCoverImages(moviesInDisplayOrder, userId)

  for (const movie of moviesInDisplayOrder) {
    if (isCancelled?.()) break

    const url = covers[movie.id]
    if (!url || hasUsableThumbnail(movie.thumbnail)) continue

    onCoverStart?.(movie.id)
    await preloadImage(url)
    if (isCancelled?.()) break

    onCover(movie.id, url)

    if (staggerMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, staggerMs))
    }
  }

  return { covers, stats }
}
