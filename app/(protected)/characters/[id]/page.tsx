"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, Users, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CharactersService, type Character } from "@/lib/characters-service"
import { AssetService, type Asset } from "@/lib/asset-service"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuthReady } from "@/components/auth-hooks"

export default function CharacterDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { ready, userId } = useAuthReady()
  
  const [character, setCharacter] = useState<Character | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [viewImageDialogOpen, setViewImageDialogOpen] = useState(false)
  const [viewingImage, setViewingImage] = useState<Asset | null>(null)

  useEffect(() => {
    if (id && ready && userId) {
      loadCharacter()
    }
  }, [id, ready, userId])

  const loadCharacter = async () => {
    if (!id || !userId) return
    
    setLoading(true)
    try {
      // Query character directly by ID
      const { getSupabaseClient } = await import("@/lib/supabase")
      const supabase = getSupabaseClient()
      
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()
      
      if (error || !data) {
        toast({
          title: "Character Not Found",
          description: "The character you're looking for doesn't exist or you don't have access to it.",
          variant: "destructive",
        })
        router.push("/characters")
        return
      }

      setCharacter(data as Character)

      // Load assets for this character
      try {
        const characterAssets = await AssetService.getAssetsForCharacter(id as string)
        setAssets(characterAssets)
      } catch (assetError) {
        console.error("Error loading assets:", assetError)
        // Non-critical, continue without assets
      }
    } catch (error) {
      console.error("Error loading character:", error)
      toast({
        title: "Error",
        description: "Failed to load character. Please try again.",
        variant: "destructive",
      })
      router.push("/characters")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading character...
          </div>
        </div>
      </>
    )
  }

  if (!character) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="cinema-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              Character not found.
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const imageAssets = assets.filter(a => a.content_type === 'image' && a.content_url)

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/characters?movie=${character.project_id}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Characters
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{character.name}</h1>
              {character.archetype && (
                <p className="text-muted-foreground mt-1">Archetype: {character.archetype}</p>
              )}
              {character.age && character.gender && (
                <p className="text-sm text-muted-foreground mt-1">
                  {character.age} years old, {character.gender}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Character Image */}
          {character.image_url && (
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Character Image</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img
                    src={character.image_url}
                    alt={character.name}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (character.image_url) {
                      window.open(character.image_url, '_blank')
                    }
                  }}
                  className="w-full mt-4"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Image in New Tab
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Character Details */}
          <Card className="cinema-card">
            <CardHeader>
              <CardTitle>Character Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {character.description ? (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Description</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{character.description}</p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No description available for this character.
                </div>
              )}

              {character.backstory && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Backstory</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{character.backstory}</p>
                </div>
              )}

              {character.goals && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Goals</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{character.goals}</p>
                </div>
              )}

              {character.conflicts && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Conflicts</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{character.conflicts}</p>
                </div>
              )}

              {(character.height || character.build || character.skin_tone || character.eye_color || character.hair_color_current) && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Physical Appearance</Label>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {character.height && <p>Height: {character.height}</p>}
                    {character.build && <p>Build: {character.build}</p>}
                    {character.skin_tone && <p>Skin tone: {character.skin_tone}</p>}
                    {character.eye_color && <p>Eye color: {character.eye_color}</p>}
                    {character.hair_color_current && <p>Hair: {character.hair_color_current}</p>}
                  </div>
                </div>
              )}

              {character.personality?.traits && Array.isArray(character.personality.traits) && character.personality.traits.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Personality Traits</Label>
                  <div className="flex flex-wrap gap-2">
                    {character.personality.traits.map((trait, idx) => (
                      <Badge key={idx} variant="outline">{trait}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Character Assets */}
        {imageAssets.length > 0 && (
          <Card className="cinema-card mt-6">
            <CardHeader>
              <CardTitle>Character Images ({imageAssets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Carousel className="w-full">
                <CarouselContent>
                  {imageAssets.map((asset) => (
                    <CarouselItem key={asset.id}>
                      <div 
                        className="relative group aspect-video rounded-lg overflow-hidden border border-border bg-muted/30 cursor-pointer"
                        onClick={() => {
                          setViewingImage(asset)
                          setViewImageDialogOpen(true)
                        }}
                      >
                        <img
                          src={asset.content_url!}
                          alt={asset.title}
                          className="w-full h-full object-cover object-top"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewingImage(asset)
                              setViewImageDialogOpen(true)
                            }}
                            className="h-8 pointer-events-auto"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Full Image Dialog */}
      {viewingImage && (
        <Dialog open={viewImageDialogOpen} onOpenChange={setViewImageDialogOpen}>
          <DialogContent className="cinema-card border-border max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{viewingImage.title}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {new Date(viewingImage.created_at).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
              <img
                src={viewingImage.content_url!}
                alt={viewingImage.title}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => window.open(viewingImage.content_url!, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
              <Button onClick={() => setViewImageDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

