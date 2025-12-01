"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/AuthProvider"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Film, Loader2, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthReady } from "@/components/auth-hooks"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import { MovieService, type Movie } from "@/lib/movie-service"

export default function StoryboardsPage() {
  const { session } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const movieId = searchParams.get("movie")
  const { ready, userId } = useAuthReady()
  
  const [movie, setMovie] = useState<Movie | null>(null)
  const [scenes, setScenes] = useState<SceneWithMetadata[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user) {
      router.push('/movies')
      return
    }

    if (!movieId) {
      // No movie ID provided, redirect to movies
      router.push('/movies')
      return
    }

    if (ready && userId) {
      loadMovieAndScenes()
    }
  }, [session?.user, movieId, ready, userId, router])

  const loadMovieAndScenes = async () => {
    if (!movieId || !ready || !userId) return

    setLoading(true)
    try {
      // Load movie
      const movieData = await MovieService.getMovieById(movieId)
      setMovie(movieData)

      // Get timeline for the movie
      const timeline = await TimelineService.getTimelineForMovie(movieId)
      if (timeline) {
        // Load scenes from timeline
        const scenesData = await TimelineService.getScenesForTimeline(timeline.id)
        setScenes(scenesData)
        
        // If there's only one scene, auto-select it
        if (scenesData.length === 1) {
          setSelectedSceneId(scenesData[0].id)
          router.push(`/storyboards/${scenesData[0].id}`)
        }
      }
    } catch (error) {
      console.error('Error loading movie and scenes:', error)
      toast({
        title: "Error",
        description: "Failed to load movie and scenes. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSceneSelect = (sceneId: string) => {
    if (sceneId) {
      router.push(`/storyboards/${sceneId}`)
    }
  }

  if (!movieId) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading storyboards...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push('/movies')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Movies
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <Film className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Storyboards</h1>
          </div>
          {movie && (
            <p className="text-muted-foreground">
              {movie.name}
            </p>
          )}
        </div>

        <Card className="cinema-card">
          <CardHeader>
            <CardTitle>Select a Scene</CardTitle>
            <CardDescription>
              Choose a scene to view and manage its storyboards
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scenes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  No scenes found for this movie. Create scenes in the Timeline first.
                </p>
                {movieId && (
                  <Link href={`/timeline?movie=${movieId}`}>
                    <Button variant="outline">
                      Go to Timeline
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="scene-selector">Scene</Label>
                  <Select 
                    value={selectedSceneId} 
                    onValueChange={handleSceneSelect}
                  >
                    <SelectTrigger id="scene-selector" className="mt-2">
                      <SelectValue placeholder="Select a scene..." />
                    </SelectTrigger>
                    <SelectContent>
                      {scenes.map((scene) => (
                        <SelectItem key={scene.id} value={scene.id}>
                          {scene.scene_number ? `Scene ${scene.scene_number}: ` : ''}{scene.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select a scene from the dropdown above to view and manage its storyboards.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
