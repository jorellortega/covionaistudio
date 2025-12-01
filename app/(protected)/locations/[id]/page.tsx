"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, MapPin, ExternalLink, Star } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { LocationsService, type Location } from "@/lib/locations-service"
import { AssetService, type Asset } from "@/lib/asset-service"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuthReady } from "@/components/auth-hooks"

export default function LocationDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { ready, userId } = useAuthReady()
  
  const [location, setLocation] = useState<Location | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [viewImageDialogOpen, setViewImageDialogOpen] = useState(false)
  const [viewingImage, setViewingImage] = useState<Asset | null>(null)

  useEffect(() => {
    if (id && ready && userId) {
      loadLocation()
    }
  }, [id, ready, userId])

  const loadLocation = async () => {
    if (!id || !userId) return
    
    setLoading(true)
    try {
      // Query location directly by ID
      const { getSupabaseClient } = await import("@/lib/supabase")
      const supabase = getSupabaseClient()
      
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()
      
      if (error || !data) {
        toast({
          title: "Location Not Found",
          description: "The location you're looking for doesn't exist or you don't have access to it.",
          variant: "destructive",
        })
        router.push("/locations")
        return
      }

      setLocation(data as Location)

      // Load assets for this location
      try {
        const locationAssets = await AssetService.getAssetsForLocation(id as string)
        setAssets(locationAssets)
      } catch (assetError) {
        console.error("Error loading assets:", assetError)
        // Non-critical, continue without assets
      }
    } catch (error) {
      console.error("Error loading location:", error)
      toast({
        title: "Error",
        description: "Failed to load location. Please try again.",
        variant: "destructive",
      })
      router.push("/locations")
    } finally {
      setLoading(false)
    }
  }

  const handleSetThumbnail = async (asset: Asset) => {
    if (!id || !asset.content_url) return
    
    try {
      await LocationsService.updateLocation(id as string, {
        image_url: asset.content_url
      })
      
      // Update local location state
      setLocation(prev => prev ? { ...prev, image_url: asset.content_url || null } : null)
      
      toast({
        title: "Thumbnail Set",
        description: "This image is now the location's main thumbnail.",
      })
    } catch (error) {
      console.error('Error setting thumbnail:', error)
      toast({
        title: "Error",
        description: "Failed to set thumbnail.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading location...
          </div>
        </div>
      </>
    )
  }

  if (!location) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="cinema-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              Location not found.
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
            onClick={() => router.push(`/locations?movie=${location.project_id}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Locations
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{location.name}</h1>
              {location.type && (
                <p className="text-muted-foreground mt-1">Type: {location.type}</p>
              )}
              {location.address && (
                <p className="text-sm text-muted-foreground mt-1">
                  {location.address}
                  {location.city && `, ${location.city}`}
                  {location.state && `, ${location.state}`}
                  {location.country && `, ${location.country}`}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Location Image */}
          {location.image_url && (
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Location Image</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img
                    src={location.image_url}
                    alt={location.name}
                    className="w-full h-full object-cover object-center"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (location.image_url) {
                      window.open(location.image_url, '_blank')
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

          {/* Location Details */}
          <Card className="cinema-card">
            <CardHeader>
              <CardTitle>Location Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {location.description ? (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Description</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{location.description}</p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No description available for this location.
                </div>
              )}

              {location.visual_description && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Visual Description</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{location.visual_description}</p>
                </div>
              )}

              {location.atmosphere && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Atmosphere</Label>
                  <p className="text-sm text-muted-foreground">{location.atmosphere}</p>
                </div>
              )}

              {location.mood && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Mood</Label>
                  <p className="text-sm text-muted-foreground">{location.mood}</p>
                </div>
              )}

              {location.lighting_notes && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Lighting Notes</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{location.lighting_notes}</p>
                </div>
              )}

              {location.sound_notes && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Sound Notes</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{location.sound_notes}</p>
                </div>
              )}

              {location.time_of_day && Array.isArray(location.time_of_day) && location.time_of_day.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Time of Day</Label>
                  <div className="flex flex-wrap gap-2">
                    {location.time_of_day.map((time, idx) => (
                      <Badge key={idx} variant="outline">{time}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {location.key_features && Array.isArray(location.key_features) && location.key_features.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Key Features</Label>
                  <div className="flex flex-wrap gap-2">
                    {location.key_features.map((feature, idx) => (
                      <Badge key={idx} variant="outline">{feature}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {location.props && Array.isArray(location.props) && location.props.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Props</Label>
                  <div className="flex flex-wrap gap-2">
                    {location.props.map((prop, idx) => (
                      <Badge key={idx} variant="outline">{prop}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {location.restrictions && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Restrictions</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{location.restrictions}</p>
                </div>
              )}

              {location.access_notes && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Access Notes</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{location.access_notes}</p>
                </div>
              )}

              {location.shooting_notes && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Shooting Notes</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{location.shooting_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Location Assets */}
        {imageAssets.length > 0 && (
          <Card className="cinema-card mt-6">
            <CardHeader>
              <CardTitle>Location Images ({imageAssets.length})</CardTitle>
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
                          className="w-full h-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
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
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSetThumbnail(asset)
                            }}
                            className="h-8 bg-blue-500 hover:bg-blue-600 pointer-events-auto"
                            title="Set as main thumbnail"
                          >
                            <Star className="h-3 w-3 mr-1" />
                            Set Thumbnail
                          </Button>
                        </div>
                        <div className="absolute top-2 left-2 flex items-center gap-2">
                          {location.image_url === asset.content_url && (
                            <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs backdrop-blur-sm flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              Thumbnail
                            </div>
                          )}
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
              <DialogTitle>{viewingImage.title.replace(/ - AI Generated Image.*$/, '')}</DialogTitle>
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
                onClick={() => {
                  if (viewingImage) {
                    handleSetThumbnail(viewingImage)
                  }
                }}
              >
                <Star className="h-4 w-4 mr-2" />
                Set as Thumbnail
              </Button>
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

