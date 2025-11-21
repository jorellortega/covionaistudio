"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Loader2, MapPin, Plus, Check, RefreshCw, ListFilter, Edit, Save, ChevronDown, ChevronUp, Upload, Image as ImageIcon, Video, File, X, ExternalLink, Trash2, Wand2, Sparkles } from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { TreatmentsService } from "@/lib/treatments-service"
import { TreatmentScenesService, type TreatmentScene } from "@/lib/treatment-scenes-service"
import { ScreenplayScenesService, type ScreenplayScene } from "@/lib/screenplay-scenes-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import { getSupabaseClient } from "@/lib/supabase"
import { AssetService, type Asset } from "@/lib/asset-service"
import { AISettingsService } from "@/lib/ai-settings-service"
import { useAuthReady } from "@/components/auth-hooks"
import { OpenAIService } from "@/lib/ai-services"

export default function LocationsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("movie") || ""
  const { user, userId, ready } = useAuthReady()

  const [projectId, setProjectId] = useState<string>(initialProject)
  const [loading, setLoading] = useState(false)
  
  // AI Text Enhancer state
  const [textEnhancerSettings, setTextEnhancerSettings] = useState<{
    model: string
    prefix: string
  }>({ model: 'gpt-4o-mini', prefix: '' })
  const [isEnhancingText, setIsEnhancingText] = useState(false)
  const [userApiKeys, setUserApiKeys] = useState<{
    openai_api_key?: string
    anthropic_api_key?: string
  }>({})
  
  // AI Image Generation state
  const [aiSettings, setAiSettings] = useState<any>({})
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  const [generatingImageForLocation, setGeneratingImageForLocation] = useState<string | null>(null)
  const [treatmentId, setTreatmentId] = useState<string | null>(null)
  const [treatmentScenes, setTreatmentScenes] = useState<TreatmentScene[]>([])
  const [screenplayScenes, setScreenplayScenes] = useState<ScreenplayScene[]>([])
  const [filter, setFilter] = useState<string>("")
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [isCreatingLocation, setIsCreatingLocation] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [locationAssets, setLocationAssets] = useState<Asset[]>([])
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)
  
  // Location form fields
  const [editingLocationInFormId, setEditingLocationInFormId] = useState<string | null>(null)
  const [newLocName, setNewLocName] = useState("")
  const [newLocDescription, setNewLocDescription] = useState("")
  const [newLocType, setNewLocType] = useState<"interior" | "exterior" | "both" | "">("")
  const [newLocAddress, setNewLocAddress] = useState("")
  const [newLocCity, setNewLocCity] = useState("")
  const [newLocState, setNewLocState] = useState("")
  const [newLocCountry, setNewLocCountry] = useState("")
  const [newLocTimeOfDay, setNewLocTimeOfDay] = useState("")
  const [newLocAtmosphere, setNewLocAtmosphere] = useState("")
  const [newLocMood, setNewLocMood] = useState("")
  const [newLocVisualDescription, setNewLocVisualDescription] = useState("")
  const [newLocLightingNotes, setNewLocLightingNotes] = useState("")
  const [newLocSoundNotes, setNewLocSoundNotes] = useState("")
  const [newLocKeyFeatures, setNewLocKeyFeatures] = useState("")
  const [newLocProps, setNewLocProps] = useState("")
  const [newLocRestrictions, setNewLocRestrictions] = useState("")
  const [newLocAccessNotes, setNewLocAccessNotes] = useState("")
  const [newLocShootingNotes, setNewLocShootingNotes] = useState("")

  // Load data for selected project
  useEffect(() => {
    const load = async () => {
      if (!projectId) return
      setLoading(true)
      try {
        // Find treatment for project (if any)
        const treatment = await TreatmentsService.getTreatmentByProjectId(projectId)
        setTreatmentId(treatment?.id || null)

        // Load scenes from treatment (if present) and screenplay scenes
        const [tScenes, sScenes] = await Promise.all([
          treatment?.id ? TreatmentScenesService.getTreatmentScenes(treatment.id) : Promise.resolve([]),
          ScreenplayScenesService.getScreenplayScenes(projectId),
        ])
        setTreatmentScenes(tScenes)
        setScreenplayScenes(sScenes)

        // Load existing locations
        setIsLoadingLocations(true)
        const locs = await LocationsService.getLocations(projectId)
        setLocations(locs)
      } catch (err) {
        console.error("Failed to load locations data:", err)
        toast({
          title: "Error",
          description: "Failed to load locations. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingLocations(false)
        setLoading(false)
      }
    }
    load()
  }, [projectId, toast])

  // Auto-select first location when locations are loaded
  useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id)
    }
  }, [locations, selectedLocationId])

  // Load assets when a location is selected
  useEffect(() => {
    const loadAssets = async () => {
      if (!selectedLocationId) {
        setLocationAssets([])
        return
      }
      try {
        setIsLoadingAssets(true)
        const assets = await AssetService.getAssetsForLocation(selectedLocationId)
        setLocationAssets(assets)
      } catch (err) {
        console.error('Failed to load location assets:', err)
        setLocationAssets([])
        if (err instanceof Error && !err.message.includes('migration')) {
          toast({
            title: "Error",
            description: "Failed to load location assets.",
            variant: "destructive",
          })
        }
      } finally {
        setIsLoadingAssets(false)
      }
    }
    loadAssets()
  }, [selectedLocationId, toast])

  // Load text enhancer settings and user API keys
  useEffect(() => {
    if (!ready || !userId) return

    const fetchTextEnhancerSettings = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('system_ai_config')
          .select('setting_key, setting_value')
          .in('setting_key', ['text_enhancer_model', 'text_enhancer_prefix'])

        if (error) {
          console.error('Error fetching text enhancer settings:', error)
          return
        }

        const settings: { model: string; prefix: string } = {
          model: 'gpt-4o-mini',
          prefix: ''
        }

        data?.forEach((item) => {
          if (item.setting_key === 'text_enhancer_model') {
            settings.model = item.setting_value || 'gpt-4o-mini'
          } else if (item.setting_key === 'text_enhancer_prefix') {
            settings.prefix = item.setting_value || ''
          }
        })

        setTextEnhancerSettings(settings)
      } catch (error) {
        console.error('Error fetching text enhancer settings:', error)
      }
    }

    const fetchUserApiKeys = async () => {
      try {
        const { data, error } = await getSupabaseClient()
          .from('users')
          .select('openai_api_key, anthropic_api_key')
          .eq('id', userId)
          .single()

        if (error) {
          console.error('Error fetching user API keys:', error)
          return
        }

        setUserApiKeys({
          openai_api_key: data?.openai_api_key || undefined,
          anthropic_api_key: data?.anthropic_api_key || undefined,
        })
      } catch (error) {
        console.error('Error fetching user API keys:', error)
      }
    }

    const fetchAISettings = async () => {
      try {
        const settings = await AISettingsService.getUserSettings(userId)
        const settingsMap = settings.reduce((acc, setting) => {
          acc[setting.tab_type] = setting
          return acc
        }, {} as any)
        setAiSettings(settingsMap)
        setAiSettingsLoaded(true)
      } catch (error) {
        console.error('Error fetching AI settings:', error)
        setAiSettingsLoaded(true)
      }
    }

    fetchTextEnhancerSettings()
    fetchUserApiKeys()
    fetchAISettings()
  }, [ready, userId])

  // Aggregate distinct locations from all scenes
  const detectedLocations = useMemo(() => {
    const set = new Set<string>()
    const counts = new Map<string, number>()

    const addLocation = (loc?: string) => {
      if (!loc) return
      const location = (loc || "").trim()
      if (!location) return
      set.add(location)
      counts.set(location, (counts.get(location) || 0) + 1)
    }

    treatmentScenes.forEach((s) => addLocation(s.location))
    screenplayScenes.forEach((s) => addLocation(s.location))

    const list = Array.from(set.values()).map((name) => ({
      name,
      count: counts.get(name) || 0,
    }))

    return list
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .filter((l) => (filter ? l.name.toLowerCase().includes(filter.toLowerCase()) : true))
  }, [treatmentScenes, screenplayScenes, filter])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    setSelectedLocationId(null)
    const url = new URL(window.location.href)
    if (id) {
      url.searchParams.set("movie", id)
    } else {
      url.searchParams.delete("movie")
    }
    router.replace(url.toString())
  }

  const enhanceField = async (text: string, setter: (value: string) => void) => {
    if (!text.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text to enhance",
        variant: "destructive",
      })
      return
    }

    if (!userApiKeys.openai_api_key && !userApiKeys.anthropic_api_key) {
      toast({
        title: "API Key Missing",
        description: "Please add your OpenAI or Anthropic API key in Settings → Profile",
        variant: "destructive",
      })
      return
    }

    setIsEnhancingText(true)
    
    try {
      const model = textEnhancerSettings.model
      const prefix = textEnhancerSettings.prefix || 'You are a professional text enhancer. Fix grammar, spelling, and enhance the writing while keeping the same context and meaning. Return only the enhanced text without explanations.\n\nEnhance the following text:'
      const fullPrompt = `${prefix}\n\n${text}`

      // Determine which API to use based on model
      const isAnthropic = model.startsWith('claude-')
      const apiKey = isAnthropic ? userApiKeys.anthropic_api_key : userApiKeys.openai_api_key

      if (!apiKey) {
        throw new Error(`API key missing for ${isAnthropic ? 'Anthropic' : 'OpenAI'}`)
      }

      let response
      if (isAnthropic) {
        // Use Anthropic API
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 4000,
            messages: [
              { role: 'user', content: fullPrompt }
            ],
          }),
        })

        if (!anthropicResponse.ok) {
          const errorText = await anthropicResponse.text()
          throw new Error(`Anthropic API error: ${anthropicResponse.status} - ${errorText}`)
        }

        const result = await anthropicResponse.json()
        response = result.content?.[0]?.text || ''
      } else {
        // Use OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'user', content: fullPrompt }
            ],
            max_tokens: 4000,
            temperature: 0.7,
          }),
        })

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text()
          throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
        }

        const result = await openaiResponse.json()
        response = result.choices?.[0]?.message?.content || ''
      }

      if (response) {
        setter(response.trim())
        toast({
          title: "Success",
          description: "Text enhanced successfully",
        })
      } else {
        throw new Error('No response from AI')
      }
    } catch (error) {
      console.error('Error enhancing text:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to enhance text",
        variant: "destructive",
      })
    } finally {
      setIsEnhancingText(false)
    }
  }

  const enhanceDescription = () => enhanceField(newLocDescription, setNewLocDescription)

  const generateQuickImage = async (location: Location) => {
    if (!user || !userId) {
      toast({
        title: "Error",
        description: "You must be logged in to generate images",
        variant: "destructive",
      })
      return
    }

    const imagesSetting = aiSettings.images
    if (!imagesSetting || !imagesSetting.is_locked) {
      toast({
        title: "AI Not Available",
        description: "Please lock an image model in AI Settings first",
        variant: "destructive",
      })
      return
    }

    if (!userApiKeys.openai_api_key) {
      toast({
        title: "API Key Missing",
        description: "Please add your OpenAI API key in Settings → Profile",
        variant: "destructive",
      })
      return
    }

    if (!selectedLocationId || selectedLocationId !== location.id) {
      setSelectedLocationId(location.id)
      // Wait a bit for location to be selected
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    setGeneratingImageForLocation(location.id)
    
    try {
      // Build prompt from location details
      let imagePrompt = `Cinematic location: "${location.name}"`
      
      // Add type if available
      if (location.type) {
        imagePrompt += `, ${location.type}`
      }
      
      // Add visual description if available (limit to first 200 chars)
      if (location.visual_description && location.visual_description.trim()) {
        let visualDesc = location.visual_description
          .replace(/\*\*/g, '') // Remove markdown
          .replace(/\*/g, '')
          .replace(/\n/g, ' ') // Remove newlines
          .replace(/\s+/g, ' ') // Remove extra spaces
          .trim()
        
        if (visualDesc.length > 200) {
          const firstSentence = visualDesc.split(/[.!?]/)[0]
          visualDesc = (firstSentence && firstSentence.length > 0 && firstSentence.length < 200) 
            ? firstSentence 
            : visualDesc.substring(0, 200)
        }
        
        if (visualDesc) {
          imagePrompt += `. ${visualDesc}`
        }
      } else if (location.description && location.description.trim()) {
        // Fallback to description if no visual description
        let desc = location.description
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        
        if (desc.length > 200) {
          const firstSentence = desc.split(/[.!?]/)[0]
          desc = (firstSentence && firstSentence.length > 0 && firstSentence.length < 200) 
            ? firstSentence 
            : desc.substring(0, 200)
        }
        
        if (desc) {
          imagePrompt += `. ${desc}`
        }
      }
      
      // Add atmosphere and mood if available
      if (location.atmosphere) {
        imagePrompt += `, ${location.atmosphere} atmosphere`
      }
      if (location.mood) {
        imagePrompt += `, ${location.mood} mood`
      }
      
      // Add time of day if available
      if (location.time_of_day && location.time_of_day.length > 0) {
        imagePrompt += `, ${location.time_of_day[0]} lighting`
      }
      
      // Add address context if available
      if (location.city || location.country) {
        const locationContext = [location.city, location.country].filter(Boolean).join(', ')
        if (locationContext) {
          imagePrompt += `, located in ${locationContext}`
        }
      }
      
      // Add style descriptors
      imagePrompt += `. Professional cinematic photography, high quality, detailed, atmospheric, dramatic lighting`
      
      // Limit prompt length (DALL-E 3 has 1000 character limit)
      if (imagePrompt.length > 900) {
        imagePrompt = imagePrompt.substring(0, 900) + "..."
      }

      console.log('Generating location image with prompt:', imagePrompt)
      
      // Normalize model name (handle "DALL-E 3" -> "dall-e-3")
      let modelName = "dall-e-3"
      if (imagesSetting.locked_model) {
        const lockedModel = imagesSetting.locked_model.toLowerCase()
        if (lockedModel.includes('dall') || lockedModel.includes('dalle')) {
          modelName = "dall-e-3"
        }
      }
      
      const response = await OpenAIService.generateImage({
        prompt: imagePrompt,
        style: "cinematic location photography, professional",
        model: modelName,
        apiKey: userApiKeys.openai_api_key
      })

      if (response.success && response.data) {
        const imageUrl = response.data.data?.[0]?.url || ""
        
        if (!imageUrl) {
          throw new Error('No image URL received from AI service')
        }

        // Save the image to the bucket
        const saveResponse = await fetch('/api/ai/download-and-store-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: imageUrl,
            fileName: `location_image_${location.id}_${Date.now()}`,
            userId: userId
          })
        })

        if (!saveResponse.ok) {
          throw new Error('Failed to save image to bucket')
        }

        const saveResult = await saveResponse.json()
        
        if (saveResult.success) {
          const bucketUrl = saveResult.supabaseUrl
          
          // Save the image as an asset linked to the location
          // Each image gets a unique title with timestamp to allow multiple images
          const timestamp = new Date().toISOString()
          const now = new Date()
          const dateStr = now.toLocaleDateString()
          const timeStr = now.toLocaleTimeString()
          const assetData = {
            project_id: projectId,
            location_id: location.id,
            title: `${location.name} - AI Generated Image (${dateStr} ${timeStr})`,
            content_type: 'image' as const,
            content: '',
            content_url: bucketUrl,
            prompt: imagePrompt,
            model: modelName,
            generation_settings: {
              service: 'openai',
              prompt: imagePrompt,
              timestamp: timestamp,
            },
            metadata: {
              generated_at: timestamp,
              source: 'location_quick_image_generation',
              location_name: location.name,
              bucket_path: saveResult.filePath || '',
            }
          }

          const savedAsset = await AssetService.createAsset(assetData)
          
          // Always reload assets from server to get the complete list (ensures we have all images, including ones generated)
          // This ensures images are ADDED, not replaced
          if (selectedLocationId === location.id) {
            try {
              const assets = await AssetService.getAssetsForLocation(location.id)
              setLocationAssets(assets)
            } catch (err) {
              console.error('Error reloading location assets:', err)
              // If reload fails, at least add the new one we know about to the existing list
              setLocationAssets(prev => {
                // Check if asset already exists to avoid duplicates
                if (prev.some(a => a.id === savedAsset.id)) {
                  return prev
                }
                return [savedAsset, ...prev]
              })
            }
          } else {
            // If location not selected, still add to list if it's the same location
            setLocationAssets(prev => {
              if (prev.some(a => a.id === savedAsset.id)) {
                return prev
              }
              return [savedAsset, ...prev]
            })
          }
          
          toast({
            title: "Success!",
            description: `Image generated and added for "${location.name}"`,
          })
        } else {
          throw new Error(saveResult.error || 'Failed to save image')
        }
      } else {
        throw new Error(response.error || "Failed to generate image")
      }
    } catch (error) {
      console.error('Error generating location image:', error)
      let errorMessage = 'Failed to generate image'
      
      if (error instanceof Error) {
        // Check for content policy violations
        if (error.message.includes('copyrighted material') || 
            error.message.includes('explicit content') ||
            error.message.includes('content policy') ||
            error.message.includes('violates our usage policy')) {
          errorMessage = error.message
        } else if (error.message.includes('API key')) {
          errorMessage = 'API key issue. Please check your API key in Settings → Profile'
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setGeneratingImageForLocation(null)
    }
  }

  const loadLocationIntoForm = (loc: Location) => {
    setSelectedLocationId(loc.id)
    setEditingLocationInFormId(loc.id)
    setNewLocName(loc.name || "")
    setNewLocDescription(loc.description || "")
    setNewLocType((loc.type as any) || "")
    setNewLocAddress(loc.address || "")
    setNewLocCity(loc.city || "")
    setNewLocState(loc.state || "")
    setNewLocCountry(loc.country || "")
    setNewLocTimeOfDay((loc.time_of_day || []).join(", ") || "")
    setNewLocAtmosphere(loc.atmosphere || "")
    setNewLocMood(loc.mood || "")
    setNewLocVisualDescription(loc.visual_description || "")
    setNewLocLightingNotes(loc.lighting_notes || "")
    setNewLocSoundNotes(loc.sound_notes || "")
    setNewLocKeyFeatures((loc.key_features || []).join(", ") || "")
    setNewLocProps((loc.props || []).join(", ") || "")
    setNewLocRestrictions(loc.restrictions || "")
    setNewLocAccessNotes(loc.access_notes || "")
    setNewLocShootingNotes(loc.shooting_notes || "")
    
    setTimeout(() => {
      const locationsCard = document.getElementById("locations-form-card")
      if (locationsCard) {
        locationsCard.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }, 100)
  }

  const clearForm = () => {
    setEditingLocationInFormId(null)
    setNewLocName("")
    setNewLocDescription("")
    setNewLocType("")
    setNewLocAddress("")
    setNewLocCity("")
    setNewLocState("")
    setNewLocCountry("")
    setNewLocTimeOfDay("")
    setNewLocAtmosphere("")
    setNewLocMood("")
    setNewLocVisualDescription("")
    setNewLocLightingNotes("")
    setNewLocSoundNotes("")
    setNewLocKeyFeatures("")
    setNewLocProps("")
    setNewLocRestrictions("")
    setNewLocAccessNotes("")
    setNewLocShootingNotes("")
  }

  const createLocation = async (namePrefill?: string) => {
    if (!projectId) return
    const name = (namePrefill ?? newLocName).trim()
    if (!name) {
      toast({ title: "Name required", description: "Please enter a location name.", variant: "destructive" })
      return
    }
    try {
      setIsCreatingLocation(true)
      
      const parseArray = (str: string) => str.split(",").map(s => s.trim()).filter(Boolean)
      
      const locationData: any = {
        name: name || undefined,
        description: newLocDescription || undefined,
        type: newLocType || undefined,
        address: newLocAddress || undefined,
        city: newLocCity || undefined,
        state: newLocState || undefined,
        country: newLocCountry || undefined,
        time_of_day: parseArray(newLocTimeOfDay),
        atmosphere: newLocAtmosphere || undefined,
        mood: newLocMood || undefined,
        visual_description: newLocVisualDescription || undefined,
        lighting_notes: newLocLightingNotes || undefined,
        sound_notes: newLocSoundNotes || undefined,
        key_features: parseArray(newLocKeyFeatures),
        props: parseArray(newLocProps),
        restrictions: newLocRestrictions || undefined,
        access_notes: newLocAccessNotes || undefined,
        shooting_notes: newLocShootingNotes || undefined,
      }
      
      Object.keys(locationData).forEach(key => {
        if (locationData[key] === undefined || 
            (Array.isArray(locationData[key]) && locationData[key].length === 0)) {
          delete locationData[key]
        }
      })
      
      if (editingLocationInFormId) {
        const updated = await LocationsService.updateLocation(editingLocationInFormId, locationData)
        setLocations(prev => prev.map(l => l.id === editingLocationInFormId ? updated : l))
        clearForm()
        toast({ title: "Location updated", description: `"${updated.name}" saved.` })
      } else {
        locationData.project_id = projectId
        const created = await LocationsService.createLocation(locationData)
        setLocations([created, ...locations])
        if (!namePrefill) {
          clearForm()
        }
        toast({ title: "Location created", description: `"${created.name}" added.` })
      }
    } catch (err) {
      console.error('Create/update location failed:', err)
      toast({ title: "Error", description: editingLocationInFormId ? "Failed to update location." : "Failed to create location.", variant: "destructive" })
    } finally {
      setIsCreatingLocation(false)
    }
  }

  const deleteLocation = async (id: string) => {
    if (!confirm("Delete this location? This cannot be undone.")) return
    try {
      await LocationsService.deleteLocation(id)
      setLocations(prev => prev.filter(l => l.id !== id))
      if (selectedLocationId === id) {
        setSelectedLocationId(null)
      }
      toast({ title: "Deleted", description: "Location removed." })
    } catch (e) {
      console.error('Delete location failed:', e)
      toast({ title: "Error", description: "Failed to delete location.", variant: "destructive" })
    }
  }

  const getFileContentType = (file: File): 'image' | 'video' | 'audio' | 'script' | 'prose' => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type === 'application/pdf' || file.type.startsWith('text/') || 
        file.name.endsWith('.txt') || file.name.endsWith('.md') ||
        file.name.endsWith('.doc') || file.name.endsWith('.docx')) return 'prose'
    return 'script'
  }

  const handleFileUpload = async (file: File) => {
    if (!selectedLocationId || !projectId) {
      toast({
        title: "Error",
        description: "Please select a location first.",
        variant: "destructive",
      })
      return
    }

    setIsUploadingAsset(true)
    try {
      const filePath = `${projectId}/locations/${selectedLocationId}/${Date.now()}_${file.name}`
      
      const { data, error } = await getSupabaseClient().storage
        .from('cinema_files')
        .upload(filePath, file)
      
      if (error) {
        throw new Error(`Upload failed: ${error.message}`)
      }
      
      const { data: { publicUrl } } = getSupabaseClient().storage
        .from('cinema_files')
        .getPublicUrl(filePath)
      
      const contentType = getFileContentType(file)
      const selectedLoc = locations.find(l => l.id === selectedLocationId)
      
      const assetData = {
        project_id: projectId,
        location_id: selectedLocationId,
        title: `${selectedLoc?.name || 'Location'} - ${file.name}`,
        content_type: contentType,
        content: '',
        content_url: publicUrl,
        prompt: '',
        model: 'manual_upload',
        generation_settings: {},
        metadata: {
          location_name: selectedLoc?.name,
          uploaded_at: new Date().toISOString(),
          source: 'location_upload',
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
        }
      }

      const savedAsset = await AssetService.createAsset(assetData)
      setLocationAssets(prev => [savedAsset, ...prev])
      
      toast({
        title: "Success",
        description: `${file.name} uploaded successfully!`,
      })
    } catch (err) {
      console.error('Upload error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: "Error",
        description: errorMessage.includes('migration') 
          ? 'Database migration required. Please run migration 048_add_location_id_to_assets.sql in Supabase.'
          : `Failed to upload ${file.name}: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setIsUploadingAsset(false)
      const input = document.getElementById('location-asset-upload') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      handleFileUpload(file)
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("Delete this asset? This cannot be undone.")) return
    
    try {
      await AssetService.deleteAsset(assetId)
      
      // Reload assets from server to ensure we have the complete, up-to-date list
      if (selectedLocationId) {
        try {
          const assets = await AssetService.getAssetsForLocation(selectedLocationId)
          setLocationAssets(assets)
        } catch (reloadErr) {
          console.error('Error reloading assets after delete:', reloadErr)
          // Fallback to client-side filtering if reload fails
          setLocationAssets(prev => prev.filter(a => a.id !== assetId))
        }
      } else {
        // Fallback if no location selected
        setLocationAssets(prev => prev.filter(a => a.id !== assetId))
      }
      
      toast({
        title: "Deleted",
        description: "Asset removed.",
      })
    } catch (err) {
      console.error('Delete asset failed:', err)
      toast({
        title: "Error",
        description: "Failed to delete asset.",
        variant: "destructive",
      })
    }
  }

  const getAssetIcon = (asset: Asset) => {
    switch (asset.content_type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />
      case 'video':
        return <Video className="h-4 w-4" />
      case 'audio':
        return <File className="h-4 w-4" />
      default:
        return <File className="h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent">
              Locations
            </h1>
            <p className="text-muted-foreground">
              Aggregate locations from scenes and manage location profiles.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <ProjectSelector
            selectedProject={projectId}
            onProjectChange={handleProjectChange}
            placeholder="Select a movie to manage locations"
          />
        </div>

        {!projectId ? (
          <Card className="cinema-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              Select a movie to view and manage locations.
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading locations...
          </div>
        ) : (
          <>
            {/* Location Viewer Card */}
            <Card className="cinema-card mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    View Location
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="location-selector">Select Location</Label>
                  <Select
                    value={selectedLocationId || ""}
                    onValueChange={(value) => {
                      setSelectedLocationId(value || null)
                    }}
                    disabled={locations.length === 0}
                  >
                    <SelectTrigger id="location-selector" className="bg-input border-border">
                      <SelectValue placeholder={locations.length === 0 ? "No locations available. Create one below." : "Select a location to view details..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No locations available</div>
                      ) : (
                        locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                            {loc.type && ` (${loc.type})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                  
                  {selectedLocationId && (() => {
                    const selectedLoc = locations.find(l => l.id === selectedLocationId)
                    if (!selectedLoc) return null
                    
                    return (
                      <div className="space-y-4 p-4 bg-muted/20 rounded-lg border border-border">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Name</Label>
                            <p className="font-semibold text-lg">{selectedLoc.name}</p>
                          </div>
                          {selectedLoc.type && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Type</Label>
                              <p className="font-medium">{selectedLoc.type}</p>
                            </div>
                          )}
                        </div>
                        
                        {selectedLoc.description && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Description</Label>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{selectedLoc.description}</p>
                          </div>
                        )}
                        
                        {(selectedLoc.address || selectedLoc.city || selectedLoc.state || selectedLoc.country) && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Address</Label>
                            <p className="text-sm mt-1">
                              {[selectedLoc.address, selectedLoc.city, selectedLoc.state, selectedLoc.country].filter(Boolean).join(", ")}
                            </p>
                          </div>
                        )}
                        
                        {selectedLoc.visual_description && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Visual Description</Label>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{selectedLoc.visual_description}</p>
                          </div>
                        )}
                        
                        {(selectedLoc.atmosphere || selectedLoc.mood) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedLoc.atmosphere && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Atmosphere</Label>
                                <p className="text-sm mt-1">{selectedLoc.atmosphere}</p>
                              </div>
                            )}
                            {selectedLoc.mood && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Mood</Label>
                                <p className="text-sm mt-1">{selectedLoc.mood}</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {selectedLoc.time_of_day && selectedLoc.time_of_day.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Time of Day</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {selectedLoc.time_of_day.map((tod, i) => (
                                <Badge key={`${selectedLoc.id}-tod-${i}`} variant="outline">
                                  {tod}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <Separator />
                        
                        {/* Location Assets Section */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Assets</Label>
                            <div className="flex items-center gap-2">
                              <input
                                id="location-asset-upload"
                                type="file"
                                multiple
                                accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx,.md"
                                onChange={handleFileSelect}
                                className="hidden"
                                disabled={isUploadingAsset}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => document.getElementById('location-asset-upload')?.click()}
                                disabled={isUploadingAsset}
                                className="gap-2"
                              >
                                {isUploadingAsset ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4" />
                                    Upload Assets
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          
                          {isLoadingAssets ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading assets...
                            </div>
                          ) : locationAssets.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                              No assets uploaded yet. Upload images, videos, or files to help build up this location.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {locationAssets.map((asset) => (
                                <div
                                  key={asset.id}
                                  className="relative group border border-border rounded-lg overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                  {asset.content_type === 'image' && asset.content_url ? (
                                    <div className="aspect-video relative">
                                      <img
                                        src={asset.content_url}
                                        alt={asset.title}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => window.open(asset.content_url!, '_blank')}
                                          className="h-8"
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          View
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => handleDeleteAsset(asset.id)}
                                          className="h-8 text-white hover:text-white"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4">
                                      <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10">
                                          {getAssetIcon(asset)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">{asset.title}</p>
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {asset.content_type}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {asset.content_url && (
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => window.open(asset.content_url!, '_blank')}
                                              className="h-7 w-7"
                                            >
                                              <ExternalLink className="h-3 w-3" />
                                            </Button>
                                          )}
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDeleteAsset(asset.id)}
                                            className="h-7 w-7 text-white hover:text-white"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <Separator />
                        
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              loadLocationIntoForm(selectedLoc)
                            }}
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit Location
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateQuickImage(selectedLoc)}
                            disabled={generatingImageForLocation === selectedLoc.id}
                            className="gap-2"
                          >
                            {generatingImageForLocation === selectedLoc.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" />
                                Generate Image
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })()}
                  
                  {!selectedLocationId && locations.length > 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Select a location from the dropdown to view their full details
                    </div>
                  )}
                  
                  {locations.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No locations created yet. Create your first location below.
                    </div>
                  )}
                </CardContent>
              </Card>
            
            <div className="space-y-6">
            {/* Locations list and create */}
            <Card id="locations-form-card" className="cinema-card">
              <CardHeader className="pb-4">
                <CardTitle>Locations</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {editingLocationInFormId ? "Edit location details below." : "Create and manage location profiles for this movie."}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="loc-name">Name *</Label>
                      <Input id="loc-name" value={newLocName} onChange={(e) => setNewLocName(e.target.value)} className="bg-input border-border" placeholder="e.g., Main Street Coffee Shop" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loc-type">Type</Label>
                      <Select value={newLocType} onValueChange={(value: any) => setNewLocType(value)}>
                        <SelectTrigger id="loc-type" className="bg-input border-border">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interior">Interior</SelectItem>
                          <SelectItem value="exterior">Exterior</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="loc-description">Description</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => enhanceField(newLocDescription, setNewLocDescription)}
                          disabled={isEnhancingText || !newLocDescription.trim()}
                          className="flex items-center gap-2"
                        >
                          {isEnhancingText ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wand2 className="h-4 w-4" />
                          )}
                          {isEnhancingText ? "Enhancing..." : "Enhance Text"}
                        </Button>
                      </div>
                      <Textarea id="loc-description" value={newLocDescription} onChange={(e) => setNewLocDescription(e.target.value)} className="bg-input border-border min-h-[70px]" placeholder="Brief overview of the location..." />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Address</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="loc-address">Street Address</Label>
                        <Input id="loc-address" value={newLocAddress} onChange={(e) => setNewLocAddress(e.target.value)} className="bg-input border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loc-city">City</Label>
                        <Input id="loc-city" value={newLocCity} onChange={(e) => setNewLocCity(e.target.value)} className="bg-input border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loc-state">State/Province</Label>
                        <Input id="loc-state" value={newLocState} onChange={(e) => setNewLocState(e.target.value)} className="bg-input border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loc-country">Country</Label>
                        <Input id="loc-country" value={newLocCountry} onChange={(e) => setNewLocCountry(e.target.value)} className="bg-input border-border" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Visual & Atmosphere */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="loc-time-of-day">Time of Day (comma-separated)</Label>
                      <Input id="loc-time-of-day" value={newLocTimeOfDay} onChange={(e) => setNewLocTimeOfDay(e.target.value)} className="bg-input border-border" placeholder="day, night, dawn, dusk" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loc-atmosphere">Atmosphere</Label>
                      <Input id="loc-atmosphere" value={newLocAtmosphere} onChange={(e) => setNewLocAtmosphere(e.target.value)} className="bg-input border-border" placeholder="cozy, industrial, mysterious" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loc-mood">Mood</Label>
                      <Input id="loc-mood" value={newLocMood} onChange={(e) => setNewLocMood(e.target.value)} className="bg-input border-border" placeholder="tense, peaceful, chaotic" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="loc-visual">Visual Description</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => enhanceField(newLocVisualDescription, setNewLocVisualDescription)}
                        disabled={isEnhancingText || !newLocVisualDescription.trim()}
                        className="flex items-center gap-2"
                      >
                        {isEnhancingText ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                        {isEnhancingText ? "Enhancing..." : "Enhance Text"}
                      </Button>
                    </div>
                    <Textarea id="loc-visual" value={newLocVisualDescription} onChange={(e) => setNewLocVisualDescription(e.target.value)} className="bg-input border-border min-h-[70px]" placeholder="Detailed visual description of the location..." />
                  </div>

                  <Separator />

                  {/* Technical Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="loc-lighting">Lighting Notes</Label>
                      <Textarea id="loc-lighting" value={newLocLightingNotes} onChange={(e) => setNewLocLightingNotes(e.target.value)} className="bg-input border-border min-h-[60px]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loc-sound">Sound Notes</Label>
                      <Textarea id="loc-sound" value={newLocSoundNotes} onChange={(e) => setNewLocSoundNotes(e.target.value)} className="bg-input border-border min-h-[60px]" />
                    </div>
                  </div>

                  <Separator />

                  {/* Features & Props */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="loc-features">Key Features (comma-separated)</Label>
                      <Input id="loc-features" value={newLocKeyFeatures} onChange={(e) => setNewLocKeyFeatures(e.target.value)} className="bg-input border-border" placeholder="large windows, exposed brick, vintage furniture" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loc-props">Props (comma-separated)</Label>
                      <Input id="loc-props" value={newLocProps} onChange={(e) => setNewLocProps(e.target.value)} className="bg-input border-border" placeholder="coffee cups, newspapers, plants" />
                    </div>
                  </div>

                  <Separator />

                  {/* Production Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="loc-restrictions">Restrictions</Label>
                      <Textarea id="loc-restrictions" value={newLocRestrictions} onChange={(e) => setNewLocRestrictions(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="Time restrictions, noise limits, etc." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loc-access">Access Notes</Label>
                      <Textarea id="loc-access" value={newLocAccessNotes} onChange={(e) => setNewLocAccessNotes(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="Parking, entry points, permissions needed" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loc-shooting">Shooting Notes</Label>
                    <Textarea id="loc-shooting" value={newLocShootingNotes} onChange={(e) => setNewLocShootingNotes(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="Camera angles, challenges, opportunities" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => createLocation()} disabled={isCreatingLocation || !newLocName.trim()} className="gap-2">
                    {isCreatingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : editingLocationInFormId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingLocationInFormId ? "Update Location" : "Create Location"}
                  </Button>
                  {editingLocationInFormId && (
                    <Button variant="outline" onClick={clearForm} disabled={isCreatingLocation} className="gap-2">
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {isLoadingLocations ? "Loading locations..." : `${locations.length} location${locations.length === 1 ? "" : "s"}`}
                  </div>
                  {isLoadingLocations ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  ) : locations.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No locations yet.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {locations.map((loc) => (
                        <div
                          key={loc.id}
                          className={`p-2 rounded-md text-sm border ${
                            selectedLocationId === loc.id
                              ? 'border-primary/60 ring-2 ring-primary/20 bg-primary/5'
                              : 'border-border cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors'
                          }`}
                          onClick={() => setSelectedLocationId(loc.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium leading-tight line-clamp-1 flex items-center gap-2">
                                <span>{loc.name}</span>
                                {loc.type && <Badge variant="outline" className="text-[10px] px-1 py-0">{loc.type}</Badge>}
                              </div>
                              {loc.description && <div className="text-xs text-muted-foreground line-clamp-1 mt-1">{loc.description}</div>}
                            </div>
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => loadLocationIntoForm(loc)} title="Edit">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteLocation(loc.id)} title="Delete" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Detected Locations */}
            <Card className="cinema-card">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ListFilter className="h-4 w-4" />
                    Detected Locations
                  </CardTitle>
                  <Input
                    placeholder="Filter locations..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="h-8 bg-input border-border w-48"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {detectedLocations.length} unique location{detectedLocations.length === 1 ? "" : "s"} detected
                  {treatmentId ? " (Treatment + Screenplay)" : " (Screenplay)"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {detectedLocations.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No locations found in scenes.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {detectedLocations.map((l) => {
                      const alreadyExists = locations.some(
                        (loc) => loc.name.toLowerCase() === l.name.toLowerCase(),
                      )
                      return (
                        <div key={l.name} className="flex items-center justify-between p-2 border border-border rounded-md">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{l.count}</Badge>
                            <span className="truncate max-w-[8rem] sm:max-w-[10rem]">{l.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {alreadyExists ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                <Check className="h-3 w-3 mr-1" />
                                Added
                              </Badge>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => createLocation(l.name)} disabled={isCreatingLocation} title="Create Location">
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

