"use client"

import { useEffect, useState } from "react"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Lightbulb, Plus, Edit, Save, X, Trash2, Zap, CheckCircle, AlertCircle } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { LightingPlotService, type LightingPlot } from "@/lib/lighting-plot-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import { useAuthReady } from "@/components/auth-hooks"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import { ImageIcon } from "lucide-react"

export default function LightingPlotPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("movie") || ""
  const { user, userId, ready } = useAuthReady()

  const [projectId, setProjectId] = useState<string>(initialProject)
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [lightingPlots, setLightingPlots] = useState<LightingPlot[]>([])
  const [isLoadingPlots, setIsLoadingPlots] = useState(false)
  const [isCreatingPlot, setIsCreatingPlot] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null)

  // Form fields
  const [plotName, setPlotName] = useState("")
  const [plotDescription, setPlotDescription] = useState("")
  const [plotLocationId, setPlotLocationId] = useState<string>("")
  const [plotLightingType, setPlotLightingType] = useState<string>("")
  const [plotFixtureType, setPlotFixtureType] = useState("")
  const [plotPositionX, setPlotPositionX] = useState("")
  const [plotPositionY, setPlotPositionY] = useState("")
  const [plotPositionZ, setPlotPositionZ] = useState("")
  const [plotAngleHorizontal, setPlotAngleHorizontal] = useState("")
  const [plotAngleVertical, setPlotAngleVertical] = useState("")
  const [plotIntensity, setPlotIntensity] = useState("")
  const [plotColorTemperature, setPlotColorTemperature] = useState("")
  const [plotColorGel, setPlotColorGel] = useState("")
  const [plotDiffusion, setPlotDiffusion] = useState("")
  const [plotBarnDoors, setPlotBarnDoors] = useState(false)
  const [plotFlags, setPlotFlags] = useState(false)
  const [plotScrims, setPlotScrims] = useState("")
  const [plotNotes, setPlotNotes] = useState("")

  // AI Settings for image generation
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready) return
      try {
        const settings = await AISettingsService.getSystemSettings()
        
        // Ensure default settings exist for all tabs
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting('scripts'),
          AISettingsService.getOrCreateDefaultTabSetting('images'),
          AISettingsService.getOrCreateDefaultTabSetting('videos'),
          AISettingsService.getOrCreateDefaultTabSetting('audio')
        ])
        
        // Merge existing settings with default ones, preferring existing
        const mergedSettings = defaultSettings.map(defaultSetting => {
          const existingSetting = settings.find(s => s.tab_type === defaultSetting.tab_type)
          return existingSetting || defaultSetting
        })
        
        setAiSettings(mergedSettings)
        setAiSettingsLoaded(true)
      } catch (error) {
        console.error('Failed to load AI settings:', error)
        setAiSettingsLoaded(true)
      }
    }

    loadAISettings()
  }, [ready])

  // Load data for selected project
  useEffect(() => {
    const load = async () => {
      if (!projectId) return
      setLoading(true)
      try {
        // Load locations
        const locs = await LocationsService.getLocations(projectId)
        setLocations(locs)

        // Load lighting plots
        setIsLoadingPlots(true)
        const plots = await LightingPlotService.getLightingPlots(projectId)
        setLightingPlots(plots)
      } catch (err) {
        console.error("Failed to load lighting plot data:", err)
        toast({
          title: "Error",
          description: "Failed to load lighting plots. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingPlots(false)
        setLoading(false)
      }
    }
    if (ready && projectId) {
      load()
    }
  }, [projectId, ready, toast])

  // Filter plots by selected location
  const filteredPlots = selectedLocationId
    ? lightingPlots.filter(plot => plot.location_id === selectedLocationId)
    : lightingPlots

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    setSelectedLocationId(null)
    setEditingPlotId(null)
    clearForm()
    const url = new URL(window.location.href)
    if (id) {
      url.searchParams.set("movie", id)
    } else {
      url.searchParams.delete("movie")
    }
    router.replace(url.toString())
  }

  const clearForm = () => {
    setPlotName("")
    setPlotDescription("")
    setPlotLocationId("")
    setPlotLightingType("")
    setPlotFixtureType("")
    setPlotPositionX("")
    setPlotPositionY("")
    setPlotPositionZ("")
    setPlotAngleHorizontal("")
    setPlotAngleVertical("")
    setPlotIntensity("")
    setPlotColorTemperature("")
    setPlotColorGel("")
    setPlotDiffusion("")
    setPlotBarnDoors(false)
    setPlotFlags(false)
    setPlotScrims("")
    setPlotNotes("")
    setEditingPlotId(null)
  }

  const loadPlotIntoForm = (plot: LightingPlot) => {
    setEditingPlotId(plot.id)
    setPlotName(plot.name || "")
    setPlotDescription(plot.description || "")
    setPlotLocationId(plot.location_id || "")
    setPlotLightingType(plot.lighting_type || "")
    setPlotFixtureType(plot.fixture_type || "")
    setPlotPositionX(plot.position_x?.toString() || "")
    setPlotPositionY(plot.position_y?.toString() || "")
    setPlotPositionZ(plot.position_z?.toString() || "")
    setPlotAngleHorizontal(plot.angle_horizontal?.toString() || "")
    setPlotAngleVertical(plot.angle_vertical?.toString() || "")
    setPlotIntensity(plot.intensity?.toString() || "")
    setPlotColorTemperature(plot.color_temperature?.toString() || "")
    setPlotColorGel(plot.color_gel || "")
    setPlotDiffusion(plot.diffusion || "")
    setPlotBarnDoors(plot.barn_doors || false)
    setPlotFlags(plot.flags || false)
    setPlotScrims(plot.scrims || "")
    setPlotNotes(plot.notes || "")
  }

  const createOrUpdatePlot = async () => {
    if (!projectId) return
    const name = plotName.trim()
    if (!name) {
      toast({ title: "Name required", description: "Please enter a lighting plot name.", variant: "destructive" })
      return
    }

    try {
      setIsCreatingPlot(true)

      const plotData: any = {
        project_id: projectId,
        name: name,
        description: plotDescription || undefined,
        location_id: plotLocationId || undefined,
        lighting_type: plotLightingType || undefined,
        fixture_type: plotFixtureType || undefined,
        position_x: plotPositionX ? parseFloat(plotPositionX) : undefined,
        position_y: plotPositionY ? parseFloat(plotPositionY) : undefined,
        position_z: plotPositionZ ? parseFloat(plotPositionZ) : undefined,
        angle_horizontal: plotAngleHorizontal ? parseFloat(plotAngleHorizontal) : undefined,
        angle_vertical: plotAngleVertical ? parseFloat(plotAngleVertical) : undefined,
        intensity: plotIntensity ? parseInt(plotIntensity) : undefined,
        color_temperature: plotColorTemperature ? parseInt(plotColorTemperature) : undefined,
        color_gel: plotColorGel || undefined,
        diffusion: plotDiffusion || undefined,
        barn_doors: plotBarnDoors,
        flags: plotFlags,
        scrims: plotScrims || undefined,
        notes: plotNotes || undefined,
      }

      // Remove undefined values
      Object.keys(plotData).forEach(key => {
        if (plotData[key] === undefined) {
          delete plotData[key]
        }
      })

      if (editingPlotId) {
        const updated = await LightingPlotService.updateLightingPlot(editingPlotId, plotData)
        setLightingPlots(prev => prev.map(p => p.id === editingPlotId ? updated : p))
        toast({ title: "Lighting plot updated", description: `"${updated.name}" saved.` })
      } else {
        const created = await LightingPlotService.createLightingPlot(plotData)
        setLightingPlots([created, ...lightingPlots])
        toast({ title: "Lighting plot created", description: `"${created.name}" added.` })
      }

      clearForm()
    } catch (err) {
      console.error('Create/update lighting plot failed:', err)
      toast({
        title: "Error",
        description: editingPlotId ? "Failed to update lighting plot." : "Failed to create lighting plot.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingPlot(false)
    }
  }

  const deletePlot = async (id: string) => {
    if (!confirm("Delete this lighting plot? This cannot be undone.")) return
    try {
      await LightingPlotService.deleteLightingPlot(id)
      setLightingPlots(prev => prev.filter(p => p.id !== id))
      if (editingPlotId === id) {
        clearForm()
      }
      toast({ title: "Deleted", description: "Lighting plot removed." })
    } catch (e) {
      console.error('Delete lighting plot failed:', e)
      toast({ title: "Error", description: "Failed to delete lighting plot.", variant: "destructive" })
    }
  }

  const getLightingTypeColor = (type?: string | null) => {
    switch (type) {
      case 'key': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'fill': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'back': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'rim': return 'bg-pink-500/20 text-pink-400 border-pink-500/30'
      case 'practical': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'ambient': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      case 'special': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  // Get current images tab AI setting
  const getImagesTabSetting = () => {
    return aiSettings.find(setting => setting.tab_type === 'images')
  }

  // Check if images tab has a locked model
  const isImagesTabLocked = () => {
    const setting = getImagesTabSetting()
    return setting?.is_locked || false
  }

  // Get the locked model for images tab
  const getImagesTabLockedModel = () => {
    const setting = getImagesTabSetting()
    return setting?.locked_model || ""
  }

  const generateLightingImage = async () => {
    if (!aiSettingsLoaded || !user || !userId) {
      toast({
        title: "Error",
        description: "AI settings not loaded yet. Please wait a moment and try again.",
        variant: "destructive",
      })
      return
    }

    // Build prompt from lighting plot details
    const promptParts: string[] = []
    if (plotName) promptParts.push(plotName)
    if (plotDescription) promptParts.push(plotDescription)
    if (plotLocationId) {
      const location = locations.find(l => l.id === plotLocationId)
      if (location) promptParts.push(`at ${location.name}`)
    }
    if (plotLightingType) promptParts.push(`${plotLightingType} lighting`)
    if (plotFixtureType) promptParts.push(`using ${plotFixtureType}`)
    if (plotColorTemperature) promptParts.push(`${plotColorTemperature}K color temperature`)
    if (plotColorGel) promptParts.push(`${plotColorGel} gel`)
    if (plotIntensity) promptParts.push(`${plotIntensity}% intensity`)
    
    const lightingPrompt = promptParts.length > 0 
      ? `Cinematic lighting setup: ${promptParts.join(', ')}`
      : "Professional cinematic lighting setup"

    try {
      setIsGeneratingImage(true)
      setGeneratedImageUrl(null)

      // Check for locked image model
      const imagesSetting = aiSettings.find(setting => setting.tab_type === 'images')
      const isImagesTabLocked = imagesSetting?.is_locked || false
      const lockedModel = imagesSetting?.locked_model || null
      
      // Use locked model if available
      const serviceToUse = (isImagesTabLocked && lockedModel) ? lockedModel : 'DALL-E 3'
      let apiKey = 'configured'

      // Helper function to normalize model name from display name to API model identifier
      const normalizeImageModel = (displayName: string | null | undefined): string => {
        if (!displayName) return "dall-e-3"
        const model = displayName.toLowerCase()
        if (model === "gpt image" || model === "gpt image 1" || model.includes("gpt-image")) {
          return "gpt-image-1"
        } else if (model.includes("dall") || model.includes("dalle")) {
          return "dall-e-3"
        }
        // Default to DALL-E 3 for unknown models
        return "dall-e-3"
      }

      // Normalize service name for API
      let normalizedService = 'dalle' // Default
      const serviceLower = serviceToUse?.toLowerCase() || ''
      if (serviceLower === 'dalle' || serviceLower === 'dall-e 3' || serviceLower === 'dall-e-3' || 
          serviceLower === 'gpt image' || serviceLower === 'gpt image 1' || serviceLower.includes('gpt image')) {
        normalizedService = 'dalle'
      } else if (serviceLower === 'openart' || serviceLower === 'sdxl') {
        normalizedService = 'openart'
      } else {
        normalizedService = serviceLower
      }

      // Normalize model name
      const normalizedModel = normalizeImageModel(serviceToUse)

      const requestBody = {
        prompt: lightingPrompt,
        service: normalizedService, // Use normalized service (dalle, openart, etc.)
        apiKey: apiKey,
        userId: userId,
        model: normalizedModel, // Pass normalized model (gpt-image-1 or dall-e-3)
        width: 1024,
        height: 1024,
        autoSaveToBucket: true,
      }

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }

      const result = await response.json()

      if (result.success && result.imageUrl) {
        setGeneratedImageUrl(result.imageUrl)
        toast({
          title: "Image Generated",
          description: "AI has generated a lighting visualization image!",
        })
      } else {
        throw new Error('No image URL received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate lighting image:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast({
        title: "Generation Failed",
        description: `Failed to generate image: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent">
              Lighting Plot
            </h1>
            <p className="text-muted-foreground">
              Plan and document lighting setups for your cinema production.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <ProjectSelector
            selectedProject={projectId}
            onProjectChange={handleProjectChange}
            placeholder="Select a movie to manage lighting plots"
          />
        </div>

        {!projectId ? (
          <Card className="cinema-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              Select a movie to view and manage lighting plots.
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading lighting plots...
          </div>
        ) : (
          <>
            {/* Location Filter */}
            {locations.length > 0 && (
              <Card className="cinema-card mb-6">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Filter by Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedLocationId || "__all__"}
                    onValueChange={(value) => setSelectedLocationId(value === "__all__" ? null : value)}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All locations</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {/* Create/Edit Form */}
            <Card className="cinema-card mb-6">
              <CardHeader>
                <CardTitle>
                  {editingPlotId ? "Edit Lighting Plot" : "Create New Lighting Plot"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Status Indicator */}
                {aiSettingsLoaded && (
                  <>
                    {isImagesTabLocked() ? (
                      <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <p className="text-sm text-green-600 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          AI Online - Using {getImagesTabLockedModel()}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                        <p className="text-sm text-yellow-600">
                          <AlertCircle className="h-4 w-4 inline mr-2" />
                          Lock an AI model in Settings → AI Settings to enable image generation.
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plot-name">Name *</Label>
                    <Input
                      id="plot-name"
                      value={plotName}
                      onChange={(e) => setPlotName(e.target.value)}
                      className="bg-input border-border"
                      placeholder="e.g., Key Light - Main Subject"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plot-location">Location</Label>
                    <Select value={plotLocationId || "__none__"} onValueChange={(value) => setPlotLocationId(value === "__none__" ? "" : value)}>
                      <SelectTrigger id="plot-location" className="bg-input border-border">
                        <SelectValue placeholder="Select location (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plot-description">Description</Label>
                  <Textarea
                    id="plot-description"
                    value={plotDescription}
                    onChange={(e) => setPlotDescription(e.target.value)}
                    className="bg-input border-border min-h-[70px]"
                    placeholder="Brief description of the lighting setup..."
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plot-lighting-type">Lighting Type</Label>
                    <Select value={plotLightingType || "__none__"} onValueChange={(value) => setPlotLightingType(value === "__none__" ? "" : value)}>
                      <SelectTrigger id="plot-lighting-type" className="bg-input border-border">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        <SelectItem value="key">Key</SelectItem>
                        <SelectItem value="fill">Fill</SelectItem>
                        <SelectItem value="back">Back</SelectItem>
                        <SelectItem value="rim">Rim</SelectItem>
                        <SelectItem value="practical">Practical</SelectItem>
                        <SelectItem value="ambient">Ambient</SelectItem>
                        <SelectItem value="special">Special</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plot-fixture-type">Fixture Type</Label>
                    <Input
                      id="plot-fixture-type"
                      value={plotFixtureType}
                      onChange={(e) => setPlotFixtureType(e.target.value)}
                      className="bg-input border-border"
                      placeholder="e.g., ARRI 650W, LED Panel, Fresnel"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Position (Coordinates)</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="plot-x" className="text-xs">X (Horizontal)</Label>
                      <Input
                        id="plot-x"
                        type="number"
                        step="0.01"
                        value={plotPositionX}
                        onChange={(e) => setPlotPositionX(e.target.value)}
                        className="bg-input border-border"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plot-y" className="text-xs">Y (Vertical)</Label>
                      <Input
                        id="plot-y"
                        type="number"
                        step="0.01"
                        value={plotPositionY}
                        onChange={(e) => setPlotPositionY(e.target.value)}
                        className="bg-input border-border"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plot-z" className="text-xs">Z (Depth)</Label>
                      <Input
                        id="plot-z"
                        type="number"
                        step="0.01"
                        value={plotPositionZ}
                        onChange={(e) => setPlotPositionZ(e.target.value)}
                        className="bg-input border-border"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plot-angle-h">Horizontal Angle (degrees)</Label>
                    <Input
                      id="plot-angle-h"
                      type="number"
                      step="0.1"
                      value={plotAngleHorizontal}
                      onChange={(e) => setPlotAngleHorizontal(e.target.value)}
                      className="bg-input border-border"
                      placeholder="0.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plot-angle-v">Vertical Angle (degrees)</Label>
                    <Input
                      id="plot-angle-v"
                      type="number"
                      step="0.1"
                      value={plotAngleVertical}
                      onChange={(e) => setPlotAngleVertical(e.target.value)}
                      className="bg-input border-border"
                      placeholder="0.0"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plot-intensity">Intensity (0-100)</Label>
                    <Input
                      id="plot-intensity"
                      type="number"
                      min="0"
                      max="100"
                      value={plotIntensity}
                      onChange={(e) => setPlotIntensity(e.target.value)}
                      className="bg-input border-border"
                      placeholder="50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plot-color-temp">Color Temperature (K)</Label>
                    <Input
                      id="plot-color-temp"
                      type="number"
                      value={plotColorTemperature}
                      onChange={(e) => setPlotColorTemperature(e.target.value)}
                      className="bg-input border-border"
                      placeholder="3200, 5600, etc."
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plot-color-gel">Color Gel</Label>
                    <Input
                      id="plot-color-gel"
                      value={plotColorGel}
                      onChange={(e) => setPlotColorGel(e.target.value)}
                      className="bg-input border-border"
                      placeholder="e.g., CTO, CTB, 85"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plot-diffusion">Diffusion</Label>
                    <Input
                      id="plot-diffusion"
                      value={plotDiffusion}
                      onChange={(e) => setPlotDiffusion(e.target.value)}
                      className="bg-input border-border"
                      placeholder="e.g., 216, Opal, Silk"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plot-scrims">Scrims</Label>
                  <Input
                    id="plot-scrims"
                    value={plotScrims}
                    onChange={(e) => setPlotScrims(e.target.value)}
                    className="bg-input border-border"
                    placeholder="e.g., Single, Double, Half"
                  />
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="plot-barn-doors"
                      checked={plotBarnDoors}
                      onChange={(e) => setPlotBarnDoors(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="plot-barn-doors" className="cursor-pointer">
                      Barn Doors
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="plot-flags"
                      checked={plotFlags}
                      onChange={(e) => setPlotFlags(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="plot-flags" className="cursor-pointer">
                      Flags
                    </Label>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="plot-notes">Notes</Label>
                  <Textarea
                    id="plot-notes"
                    value={plotNotes}
                    onChange={(e) => setPlotNotes(e.target.value)}
                    className="bg-input border-border min-h-[80px]"
                    placeholder="Additional notes, special instructions, or observations..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={createOrUpdatePlot}
                    disabled={isCreatingPlot || !plotName.trim()}
                    className="gap-2"
                  >
                    {isCreatingPlot ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingPlotId ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editingPlotId ? "Update Plot" : "Create Plot"}
                  </Button>
                  <Button
                    onClick={generateLightingImage}
                    disabled={isGeneratingImage || !aiSettingsLoaded || !isImagesTabLocked()}
                    variant="outline"
                    className="gap-2"
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                    Generate Image
                  </Button>
                  {editingPlotId && (
                    <Button variant="outline" onClick={clearForm} disabled={isCreatingPlot} className="gap-2">
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
                
                {generatedImageUrl && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <Label className="text-sm font-medium mb-2 block">Generated Lighting Visualization</Label>
                    <img 
                      src={generatedImageUrl} 
                      alt="Generated lighting visualization" 
                      className="w-full max-w-md rounded-lg border border-border"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lighting Plots List */}
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Lighting Plots
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {isLoadingPlots
                    ? "Loading..."
                    : `${filteredPlots.length} plot${filteredPlots.length === 1 ? "" : "s"}`}
                </p>
              </CardHeader>
              <CardContent>
                {isLoadingPlots ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading lighting plots...
                  </div>
                ) : filteredPlots.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No lighting plots yet. Create your first lighting plot above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPlots.map((plot) => {
                      const location = locations.find(l => l.id === plot.location_id)
                      return (
                        <div
                          key={plot.id}
                          className="p-4 border border-border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-lg">{plot.name}</h3>
                                {plot.lighting_type && (
                                  <Badge className={getLightingTypeColor(plot.lighting_type)}>
                                    {plot.lighting_type}
                                  </Badge>
                                )}
                                {location && (
                                  <Badge variant="outline" className="text-xs">
                                    {location.name}
                                  </Badge>
                                )}
                              </div>
                              {plot.description && (
                                <p className="text-sm text-muted-foreground">{plot.description}</p>
                              )}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                {plot.fixture_type && (
                                  <div>
                                    <span className="text-muted-foreground">Fixture: </span>
                                    <span className="font-medium">{plot.fixture_type}</span>
                                  </div>
                                )}
                                {plot.intensity !== null && (
                                  <div>
                                    <span className="text-muted-foreground">Intensity: </span>
                                    <span className="font-medium">{plot.intensity}%</span>
                                  </div>
                                )}
                                {plot.color_temperature && (
                                  <div>
                                    <span className="text-muted-foreground">Color Temp: </span>
                                    <span className="font-medium">{plot.color_temperature}K</span>
                                  </div>
                                )}
                                {(plot.position_x !== null || plot.position_y !== null || plot.position_z !== null) && (
                                  <div>
                                    <span className="text-muted-foreground">Position: </span>
                                    <span className="font-medium">
                                      ({plot.position_x || 0}, {plot.position_y || 0}, {plot.position_z || 0})
                                    </span>
                                  </div>
                                )}
                              </div>
                              {plot.notes && (
                                <p className="text-sm text-muted-foreground italic mt-2">{plot.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => loadPlotIntoForm(plot)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deletePlot(plot.id)}
                                title="Delete"
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

