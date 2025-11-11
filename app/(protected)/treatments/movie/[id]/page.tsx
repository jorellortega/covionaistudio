"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthReady } from '@/components/auth-hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Sparkles, ImageIcon, Loader2, CheckCircle, Download, FileText } from 'lucide-react'
import { TreatmentsService, CreateTreatmentData, Treatment } from '@/lib/treatments-service'
import { MovieService, type Movie } from '@/lib/movie-service'
import { AISettingsService, type AISetting } from '@/lib/ai-settings-service'
import Header from '@/components/header'
import Link from 'next/link'
import TextToSpeech from '@/components/text-to-speech'
import { Eye, Edit as EditIcon } from 'lucide-react'

export default function MovieTreatmentPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  
  const [movie, setMovie] = useState<Movie | null>(null)
  const [treatment, setTreatment] = useState<Treatment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTreatment, setNewTreatment] = useState({
    title: '',
    genre: '',
    status: 'draft' as 'draft' | 'in-progress' | 'completed' | 'archived',
    cover_image_url: '',
    synopsis: '',
    target_audience: '',
    estimated_budget: '',
    estimated_duration: ''
  })

  // AI Image Generation States
  const [aiPrompt, setAiPrompt] = useState('')
  const [selectedAIService, setSelectedAIService] = useState('dalle')
  const [isGeneratingCover, setIsGeneratingCover] = useState(false)
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState('')
  
  // AI Script Generation States
  const [scriptAiPrompt, setScriptAiPrompt] = useState('')
  const [selectedScriptAIService, setSelectedScriptAIService] = useState('openai')
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false)
  const [generatedSynopsis, setGeneratedSynopsis] = useState('')
  
  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)

  useEffect(() => {
    if (id && ready) {
      loadMovieAndTreatment(id as string)
    }
  }, [id, ready])

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready) return
      
      try {
        const settings = await AISettingsService.getUserSettings(userId!)
        
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting(userId!, 'scripts'),
          AISettingsService.getOrCreateDefaultTabSetting(userId!, 'images'),
          AISettingsService.getOrCreateDefaultTabSetting(userId!, 'videos'),
          AISettingsService.getOrCreateDefaultTabSetting(userId!, 'audio')
        ])
        
        const mergedSettings = defaultSettings.map(defaultSetting => {
          const existingSetting = settings.find(s => s.tab_type === defaultSetting.tab_type)
          return existingSetting || defaultSetting
        })
        
        setAiSettings(mergedSettings)
        setAiSettingsLoaded(true)
        
        const imagesSetting = mergedSettings.find(setting => setting.tab_type === 'images')
        if (imagesSetting?.is_locked) {
          setSelectedAIService(imagesSetting.locked_model)
        }
        
        const scriptsSetting = mergedSettings.find(setting => setting.tab_type === 'scripts')
        if (scriptsSetting?.is_locked) {
          setSelectedScriptAIService(scriptsSetting.locked_model)
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
  }, [ready, userId])

  const loadMovieAndTreatment = async (movieId: string) => {
    try {
      setIsLoading(true)
      
      // Load movie details
      const movieData = await MovieService.getMovieById(movieId)
      if (!movieData) {
        toast({
          title: "Error",
          description: "Movie not found",
          variant: "destructive",
        })
        router.push('/movies')
        return
      }
      
      setMovie(movieData)
      
      // Check if treatment exists for this movie
      const existingTreatment = await TreatmentsService.getTreatmentByProjectId(movieId)
      
      if (existingTreatment) {
        // Display the existing treatment instead of redirecting
        setTreatment(existingTreatment)
        setShowCreateForm(false)
      } else {
        // No treatment exists, show create form
        setTreatment(null)
        setShowCreateForm(true)
        // Pre-fill treatment form with movie data
        setNewTreatment({
          title: movieData.name,
          genre: movieData.genre || '',
          status: 'draft',
          cover_image_url: movieData.thumbnail || '',
          synopsis: movieData.description || '',
          target_audience: '',
          estimated_budget: '',
          estimated_duration: movieData.duration || ''
        })
        setGeneratedCoverUrl(movieData.thumbnail || '')
      }
      
    } catch (error) {
      console.error('Error loading movie and treatment:', error)
      toast({
        title: "Error",
        description: "Failed to load movie details",
        variant: "destructive",
      })
      router.push('/movies')
    } finally {
      setIsLoading(false)
    }
  }

  // Upload generated image to Supabase storage
  const uploadGeneratedImageToStorage = async (imageUrl: string, fileName: string): Promise<string> => {
    try {
      const response = await fetch('/api/ai/download-and-store-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          fileName: fileName,
          userId: user!.id
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`API error: ${errorData.error || response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.supabaseUrl) {
        return result.supabaseUrl
      } else {
        throw new Error('API did not return a valid Supabase URL')
      }
      
    } catch (error) {
      console.error('Error uploading treatment cover to Supabase:', error)
      throw error
    }
  }

  const generateAICoverImage = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a prompt to generate a cover image.",
        variant: "destructive",
      })
      return
    }

    if (!ready) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating images.",
        variant: "destructive",
      })
      return
    }

    const sanitizedPrompt = aiPrompt
      .replace(/godzilla/gi, 'giant monster')
      .replace(/violence|blood|gore/gi, 'action')
      .trim()

    const fullPrompt = `Movie treatment cover: ${sanitizedPrompt}. Cinematic style, dramatic lighting.`
    if (fullPrompt.length > 1000) {
      toast({
        title: "Prompt Too Long",
        description: "Please keep your description shorter. DALL-E 3 has a 1000 character limit.",
        variant: "destructive",
      })
      return
    }

    const lockedModel = getImagesTabLockedModel()
    const serviceToUse = (isImagesTabLocked() && lockedModel) ? lockedModel : selectedAIService
    
    if (!serviceToUse) {
      toast({
        title: "Error",
        description: "No AI service selected. Please choose an AI service or configure your settings.",
        variant: "destructive",
      })
      return
    }

    const normalizedService = serviceToUse.toLowerCase().includes('dall') ? 'dalle' : 
                             serviceToUse.toLowerCase().includes('openart') ? 'openart' : 
                             serviceToUse.toLowerCase().includes('leonardo') ? 'leonardo' : 
                             serviceToUse

    try {
      setIsGeneratingCover(true)

      let imageUrl = ""
      
      const requestBody = {
        prompt: fullPrompt,
        service: normalizedService,
        apiKey: 'configured',
        userId: user?.id,
        autoSaveToBucket: true,
      }

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`AI API failed: ${response.status} - ${errorData.error || 'Unknown error'}`)
      }

      const data = await response.json()
      imageUrl = data.imageUrl

      if (imageUrl) {
        setGeneratedCoverUrl(imageUrl)
        setNewTreatment(prev => ({ ...prev, cover_image_url: imageUrl }))
        
        try {
          const fileName = `treatment-cover-${Date.now()}`
          const supabaseUrl = await uploadGeneratedImageToStorage(imageUrl, fileName)
          
          setGeneratedCoverUrl(supabaseUrl)
          setNewTreatment(prev => ({ ...prev, cover_image_url: supabaseUrl }))
          
          toast({
            title: "AI Cover Generated & Uploaded",
            description: `Cover generated and uploaded to storage using ${normalizedService.toUpperCase()}`,
          })
        } catch (uploadError) {
          console.error('Failed to upload treatment cover to Supabase:', uploadError)
          toast({
            title: "Cover Generated (Upload Failed)",
            description: "Cover generated but failed to upload to storage. Using temporary URL.",
            variant: "destructive",
          })
        }
      } else {
        throw new Error('No image URL received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI cover:', error)
      toast({
        title: "Generation Failed",
        description: `Failed to generate cover: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingCover(false)
    }
  }

  const downloadGeneratedCover = () => {
    if (!generatedCoverUrl) {
      toast({
        title: "No Generated Cover",
        description: "Generate a cover first before downloading.",
        variant: "destructive",
      })
      return
    }

    try {
      const link = document.createElement('a')
      link.href = generatedCoverUrl
      link.download = `generated_treatment_cover_${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({
        title: "🎨 Download Started!",
        description: "Generated cover image is downloading...",
      })
    } catch (error) {
      console.error('Error downloading generated cover:', error)
      toast({
        title: "Download Failed",
        description: "Failed to download the cover image. Please try again.",
        variant: "destructive",
      })
    }
  }

  const generateAISynopsis = async () => {
    if (isGeneratingSynopsis) return
    
    if (!scriptAiPrompt.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a prompt to generate a synopsis.",
        variant: "destructive",
      })
      return
    }

    if (!user) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating synopsis.",
        variant: "destructive",
      })
      return
    }

    const lockedModel = getScriptsTabLockedModel()
    const serviceToUse = (isScriptsTabLocked() && lockedModel) ? lockedModel : selectedScriptAIService
    
    if (!serviceToUse) {
      toast({
        title: "Error",
        description: "No AI service selected. Please choose an AI service or configure your settings.",
        variant: "destructive",
      })
      return
    }

    const normalizedService = serviceToUse.toLowerCase().includes('gpt') || serviceToUse.toLowerCase().includes('openai') ? 'openai' : 
                             serviceToUse.toLowerCase().includes('claude') || serviceToUse.toLowerCase().includes('anthropic') ? 'anthropic' : 
                             serviceToUse.toLowerCase().includes('gemini') || serviceToUse.toLowerCase().includes('google') ? 'google' : 
                             serviceToUse

    let apiKey = ''
    switch (normalizedService) {
      case 'openai':
      case 'anthropic':
        apiKey = 'configured'
        break
      case 'google':
        toast({
          title: "Service Not Available",
          description: "Google Gemini is not currently configured. Please use OpenAI or Anthropic.",
          variant: "destructive",
        })
        return
      default:
        throw new Error(`Unsupported AI service: ${serviceToUse}`)
    }

    try {
      setIsGeneratingSynopsis(true)

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Write a compelling 2-3 paragraph movie treatment synopsis for: ${scriptAiPrompt}. Make it engaging, cinematic, and professional. Focus on the main plot, key characters, and dramatic stakes.`,
          field: 'synopsis',
          service: normalizedService,
          apiKey: apiKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate synopsis')
      }

      const result = await response.json()

      if (result.success && result.text) {
        setGeneratedSynopsis(result.text)
        setNewTreatment(prev => ({ ...prev, synopsis: result.text }))
        toast({
          title: "Synopsis Generated & Applied",
          description: "AI has generated and automatically applied your treatment synopsis!",
        })
      } else {
        throw new Error('No synopsis text received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI synopsis:', error)
      toast({
        title: "Generation Failed",
        description: `Failed to generate synopsis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingSynopsis(false)
    }
  }

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setGeneratedCoverUrl(result)
      setNewTreatment(prev => ({ ...prev, cover_image_url: result }))
      toast({
        title: "Image Uploaded",
        description: "Cover image has been uploaded successfully!",
      })
    }
    reader.readAsDataURL(file)
  }

  const getImagesTabSetting = () => {
    return aiSettings.find(setting => setting.tab_type === 'images')
  }

  const isImagesTabLocked = () => {
    const setting = getImagesTabSetting()
    return setting?.is_locked || false
  }

  const getImagesTabLockedModel = () => {
    const setting = getImagesTabSetting()
    return setting?.locked_model || ""
  }

  const getScriptsTabSetting = () => {
    return aiSettings.find(setting => setting.tab_type === 'scripts')
  }

  const isScriptsTabLocked = () => {
    const setting = getScriptsTabSetting()
    return setting?.is_locked || false
  }

  const getScriptsTabLockedModel = () => {
    const setting = getScriptsTabSetting()
    return setting?.locked_model || ""
  }

  const handleCreateTreatment = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newTreatment.title || !newTreatment.genre || !newTreatment.synopsis) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    if (!movie) {
      toast({
        title: "Error",
        description: "Movie information not available",
        variant: "destructive"
      })
      return
    }

    try {
      setIsCreating(true)

      let finalCoverUrl = newTreatment.cover_image_url
      if (newTreatment.cover_image_url && newTreatment.cover_image_url.includes('oaidalleapiprodscus.blob.core.windows.net')) {
        try {
          const fileName = `treatment-cover-${Date.now()}`
          finalCoverUrl = await uploadGeneratedImageToStorage(newTreatment.cover_image_url, fileName)
        } catch (uploadError) {
          console.error('Failed to upload cover image to Supabase:', uploadError)
        }
      }

      const treatmentData: CreateTreatmentData & { status?: string } = {
        project_id: movie.id,
        title: newTreatment.title,
        genre: newTreatment.genre,
        cover_image_url: finalCoverUrl,
        synopsis: newTreatment.synopsis,
        target_audience: newTreatment.target_audience || undefined,
        estimated_budget: newTreatment.estimated_budget || undefined,
        estimated_duration: newTreatment.estimated_duration || undefined,
      }
      
      const createdTreatment = await TreatmentsService.createTreatment(treatmentData)
      
      // Update state to show the created treatment
      setTreatment(createdTreatment)
      setShowCreateForm(false)
      
      toast({
        title: "Success",
        description: "Treatment created successfully for this movie!",
      })
      
    } catch (error) {
      console.error('Error creating treatment:', error)
      toast({
        title: "Error",
        description: "Failed to create treatment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Please log in to create treatments</h1>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </>
    )
  }

  if (!movie) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Movie not found</h1>
            <Button asChild>
              <Link href="/movies">Back to Movies</Link>
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/movies" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Movies
            </Link>
          </Button>
          
          {/* Movie Info Card */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-blue-500" />
                <div>
                  <CardTitle className="text-xl">{movie.name}</CardTitle>
                  <CardDescription>Movie Project</CardDescription>
                </div>
              </div>
              {movie.genre && (
                <div className="mt-2">
                  <Badge variant="outline">{movie.genre}</Badge>
                </div>
              )}
            </CardHeader>
            {movie.description && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{movie.description}</p>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Show treatment if it exists, otherwise show create form */}
        {treatment ? (
          /* Treatment Display */
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-purple-500" />
                    <div>
                      <CardTitle className="text-2xl">{treatment.title}</CardTitle>
                      <CardDescription>Treatment for "{movie.name}"</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" asChild>
                      <Link href={`/treatments/${treatment.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Full Treatment
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Badge variant="outline">{treatment.genre}</Badge>
                  <Badge variant={treatment.status === 'completed' ? 'default' : 'secondary'}>
                    {treatment.status.replace('-', ' ')}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Treatment Cover Image */}
            {treatment.cover_image_url && (
              <Card>
                <CardContent className="pt-6">
                  <img
                    src={treatment.cover_image_url}
                    alt={`${treatment.title} cover`}
                    className="w-full max-w-2xl mx-auto h-96 object-cover rounded-lg"
                  />
                </CardContent>
              </Card>
            )}

            {/* Synopsis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Synopsis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-lg leading-relaxed whitespace-pre-wrap">{treatment.synopsis}</p>
                  <TextToSpeech 
                    text={treatment.synopsis}
                    title={`${treatment.title} - Synopsis`}
                    projectId={treatment.project_id || undefined}
                    sceneId={null}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Logline */}
            {treatment.logline && (
              <Card>
                <CardHeader>
                  <CardTitle>Logline</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{treatment.logline}</p>
                </CardContent>
              </Card>
            )}

            {/* Additional Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {treatment.target_audience && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Target Audience</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{treatment.target_audience}</p>
                  </CardContent>
                </Card>
              )}
              {treatment.estimated_budget && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Estimated Budget</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{treatment.estimated_budget}</p>
                  </CardContent>
                </Card>
              )}
              {treatment.estimated_duration && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Estimated Duration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{treatment.estimated_duration}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Characters */}
            {treatment.characters && (
              <Card>
                <CardHeader>
                  <CardTitle>Characters</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{treatment.characters}</p>
                </CardContent>
              </Card>
            )}

            {/* Themes */}
            {treatment.themes && (
              <Card>
                <CardHeader>
                  <CardTitle>Themes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{treatment.themes}</p>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {treatment.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{treatment.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          /* Create Treatment Form */
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <FileText className="h-8 w-8 text-purple-500" />
                <div>
                  <CardTitle className="text-2xl">Create Treatment for "{movie.name}"</CardTitle>
                  <CardDescription>Write a comprehensive treatment for your movie project</CardDescription>
                </div>
              </div>
              {movie.thumbnail && (
                <div className="mt-4">
                  <img 
                    src={movie.thumbnail} 
                    alt={movie.name}
                    className="w-full max-w-md h-48 object-cover rounded-lg"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTreatment} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newTreatment.title}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter treatment title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="genre">Genre *</Label>
                  <Select value={newTreatment.genre} onValueChange={(value) => setNewTreatment(prev => ({ ...prev, genre: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Action">Action</SelectItem>
                      <SelectItem value="Comedy">Comedy</SelectItem>
                      <SelectItem value="Drama">Drama</SelectItem>
                      <SelectItem value="Horror">Horror</SelectItem>
                      <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                      <SelectItem value="Thriller">Thriller</SelectItem>
                      <SelectItem value="Romance">Romance</SelectItem>
                      <SelectItem value="Documentary">Documentary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={newTreatment.status} onValueChange={(value: any) => setNewTreatment(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cover Image Section */}
              <div className="space-y-4">
                <Label>Cover Image</Label>
                
                {/* AI Image Generation */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold">AI Cover Generation</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {!isImagesTabLocked() && (
                      <div>
                        <Label htmlFor="ai-service">AI Service</Label>
                        <Select value={selectedAIService} onValueChange={setSelectedAIService}>
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="cinema-card border-border">
                            <SelectItem value="dalle">DALL-E 3 (OpenAI)</SelectItem>
                            <SelectItem value="openart">OpenArt (SDXL)</SelectItem>
                            <SelectItem value="leonardo">Leonardo AI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {isImagesTabLocked() && (
                      <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <p className="text-sm text-green-600 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          AI Online
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <Label htmlFor="ai-prompt">AI Prompt</Label>
                      <div className="flex gap-2">
                        <Input
                          id="ai-prompt"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Describe your treatment cover"
                          className="flex-1 bg-input border-border"
                        />
                        <Button
                          type="button"
                          onClick={generateAICoverImage}
                          disabled={isGeneratingCover || !aiPrompt.trim()}
                          variant="outline"
                          size="sm"
                        >
                          {isGeneratingCover ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          Generate
                        </Button>
                      </div>
                    </div>
                    
                    {generatedCoverUrl && (
                      <div className="space-y-3">
                        <Label>Generated Cover</Label>
                        <div className="relative">
                          <img
                            src={generatedCoverUrl}
                            alt="AI generated treatment cover"
                            className="w-full h-48 object-cover rounded-lg border border-border"
                          />
                          <div className="absolute top-2 right-2">
                            <Badge variant="secondary" className="bg-green-600/90 text-white">
                              Generated ✓
                            </Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={downloadGeneratedCover}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Cover
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual Upload */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <ImageIcon className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">Manual Upload</h3>
                  </div>
                  
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="cover-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="w-8 h-8 mb-4 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                      </div>
                      <input
                        id="cover-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(file)
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* AI Synopsis Generation */}
              <div className="space-y-4">
                <Label>Synopsis *</Label>
                
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">AI Synopsis Generation</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {!isScriptsTabLocked() && (
                      <div>
                        <Label htmlFor="script-ai-service">AI Service</Label>
                        <Select value={selectedScriptAIService} onValueChange={setSelectedScriptAIService}>
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="cinema-card border-border">
                            <SelectItem value="openai">OpenAI GPT-4</SelectItem>
                            <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
                            <SelectItem value="google">Google Gemini</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {isScriptsTabLocked() && (
                      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <p className="text-sm text-blue-600 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          AI Scripts Online
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <Label htmlFor="script-ai-prompt">AI Prompt</Label>
                      <div className="flex gap-2">
                        <Input
                          id="script-ai-prompt"
                          value={scriptAiPrompt}
                          onChange={(e) => setScriptAiPrompt(e.target.value)}
                          placeholder="Describe your story concept"
                          className="flex-1 bg-input border-border"
                        />
                        <Button
                          type="button"
                          onClick={generateAISynopsis}
                          disabled={isGeneratingSynopsis || !scriptAiPrompt.trim()}
                          variant="outline"
                          size="sm"
                        >
                          {isGeneratingSynopsis ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          Generate
                        </Button>
                      </div>
                    </div>
                    
                    {generatedSynopsis && (
                      <div className="space-y-3">
                        <Label>Generated Synopsis</Label>
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <p className="text-sm text-blue-600 mb-2 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            AI Generated
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{generatedSynopsis}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Textarea
                  id="synopsis"
                  value={newTreatment.synopsis}
                  onChange={(e) => setNewTreatment(prev => ({ ...prev, synopsis: e.target.value }))}
                  placeholder="Enter a brief synopsis of your story"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="targetAudience">Target Audience</Label>
                  <Input
                    id="targetAudience"
                    value={newTreatment.target_audience}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, target_audience: e.target.value }))}
                    placeholder="e.g., 18-35"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedBudget">Estimated Budget</Label>
                  <Input
                    id="estimatedBudget"
                    value={newTreatment.estimated_budget}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, estimated_budget: e.target.value }))}
                    placeholder="e.g., $10M"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedDuration">Estimated Duration</Label>
                  <Input
                    id="estimatedDuration"
                    value={newTreatment.estimated_duration}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, estimated_duration: e.target.value }))}
                    placeholder="e.g., 120 min"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isCreating} className="gradient-button text-white">
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Treatment'
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push('/movies')}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        )}
      </div>
    </>
  )
}

