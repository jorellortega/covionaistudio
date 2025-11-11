"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Edit, Trash2, FileText, Clock, Calendar, User, Target, DollarSign, Film, Eye, Volume2, Save, X, Sparkles, Loader2 } from 'lucide-react'
import { TreatmentsService, Treatment } from '@/lib/treatments-service'
import { MovieService } from '@/lib/movie-service'
import Header from '@/components/header'
import TextToSpeech from '@/components/text-to-speech'
import Link from 'next/link'
import { AISettingsService } from '@/lib/ai-settings-service'
import { useAuthReady } from '@/components/auth-hooks'

export default function TreatmentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { session } = useAuth()
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  const [treatment, setTreatment] = useState<Treatment | null>(null)
  const [movie, setMovie] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditingTreatment, setIsEditingTreatment] = useState(false)
  const [editingTreatmentData, setEditingTreatmentData] = useState({
    target_audience: '',
    estimated_budget: '',
    estimated_duration: '',
  })
  const [isSavingTreatment, setIsSavingTreatment] = useState(false)
  const [isEditingSynopsis, setIsEditingSynopsis] = useState(false)
  const [editingSynopsis, setEditingSynopsis] = useState('')
  const [isSavingSynopsis, setIsSavingSynopsis] = useState(false)
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState('')
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false)
  const [aiSettings, setAiSettings] = useState<any[]>([])
  const [selectedScriptAIService, setSelectedScriptAIService] = useState<string>('')
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)

  useEffect(() => {
    if (id) {
      loadTreatment(id as string)
    }
  }, [id])

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready || !userId) return
      
      try {
        const settings = await AISettingsService.getUserSettings(userId)
        
        // Ensure default settings exist for scripts tab
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'scripts'),
        ])
        
        // Merge existing settings with default ones, preferring existing
        const mergedSettings = defaultSettings.map(defaultSetting => {
          const existingSetting = settings.find(s => s.tab_type === defaultSetting.tab_type)
          return existingSetting || defaultSetting
        })
        
        setAiSettings(mergedSettings)
        setAiSettingsLoaded(true)
        
        // Auto-select locked model for scripts tab if available
        const scriptsSetting = mergedSettings.find(setting => setting.tab_type === 'scripts')
        if (scriptsSetting?.is_locked && scriptsSetting.locked_model) {
          setSelectedScriptAIService(scriptsSetting.locked_model)
        } else if (scriptsSetting?.selected_model) {
          setSelectedScriptAIService(scriptsSetting.selected_model)
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
  }, [ready, userId])

  // Helper functions for AI settings
  const isScriptsTabLocked = () => {
    const setting = aiSettings.find(s => s.tab_type === 'scripts')
    return setting?.is_locked || false
  }

  const getScriptsTabLockedModel = () => {
    const setting = aiSettings.find(s => s.tab_type === 'scripts')
    return setting?.locked_model || ""
  }

  const loadTreatment = async (treatmentId: string) => {
    try {
      setIsLoading(true)
      const data = await TreatmentsService.getTreatment(treatmentId)
      if (data) {
        console.log('Loaded treatment data:', {
          id: data.id,
          title: data.title,
          project_id: data.project_id,
          synopsis: data.synopsis?.substring(0, 100),
          prompt: data.prompt?.substring(0, 100),
          hasPrompt: !!data.prompt,
          hasSynopsis: !!data.synopsis
        })
        setTreatment(data)
        
        // Note: Treatment can be saved without project_id (standalone treatment)
        // Audio saving will work even without a project_id
        
        // If treatment is linked to a movie project, load the movie
        if (data.project_id) {
          try {
            const movieData = await MovieService.getMovieById(data.project_id)
            if (movieData) {
              setMovie(movieData)
            }
          } catch (movieError) {
            console.error('Error loading linked movie:', movieError)
            // Don't show error for movie, just continue without it
          }
        }
      } else {
        toast({
          title: "Error",
          description: "Treatment not found",
          variant: "destructive",
        })
        router.push('/treatments')
      }
    } catch (error) {
      console.error('Error loading treatment:', error)
      toast({
        title: "Error",
        description: "Failed to load treatment",
        variant: "destructive",
      })
      router.push('/treatments')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!treatment || !confirm('Are you sure you want to delete this treatment?')) return
    
    try {
      setIsDeleting(true)
      await TreatmentsService.deleteTreatment(treatment.id)
      toast({
        title: "Success",
        description: "Treatment deleted successfully",
      })
      router.push('/treatments')
    } catch (error) {
      console.error('Error deleting treatment:', error)
      toast({
        title: "Error",
        description: "Failed to delete treatment",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleStartEditTreatment = () => {
    if (!treatment) return
    setEditingTreatmentData({
      target_audience: treatment.target_audience || '',
      estimated_budget: treatment.estimated_budget || '',
      estimated_duration: treatment.estimated_duration || '',
    })
    setIsEditingTreatment(true)
  }

  const handleCancelEditTreatment = () => {
    setIsEditingTreatment(false)
    setEditingTreatmentData({
      target_audience: '',
      estimated_budget: '',
      estimated_duration: '',
    })
  }

  const handleSaveTreatment = async () => {
    if (!treatment) return

    try {
      setIsSavingTreatment(true)
      const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
        target_audience: editingTreatmentData.target_audience || undefined,
        estimated_budget: editingTreatmentData.estimated_budget || undefined,
        estimated_duration: editingTreatmentData.estimated_duration || undefined,
      })
      
      setTreatment(updatedTreatment)
      setIsEditingTreatment(false)
      
      toast({
        title: "Success",
        description: "Treatment updated successfully",
      })
    } catch (error) {
      console.error('Error updating treatment:', error)
      toast({
        title: "Error",
        description: "Failed to update treatment",
        variant: "destructive",
      })
    } finally {
      setIsSavingTreatment(false)
    }
  }

  const handleStartEditSynopsis = () => {
    if (!treatment) return
    setEditingSynopsis(treatment.synopsis || '')
    setIsEditingSynopsis(true)
  }

  const handleCancelEditSynopsis = () => {
    setIsEditingSynopsis(false)
    setEditingSynopsis('')
  }

  const handleSaveSynopsis = async () => {
    if (!treatment) return

    try {
      setIsSavingSynopsis(true)
      const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
        synopsis: editingSynopsis,
      })
      
      setTreatment(updatedTreatment)
      setIsEditingSynopsis(false)
      
      toast({
        title: "Success",
        description: "Synopsis updated successfully",
      })
    } catch (error) {
      console.error('Error updating synopsis:', error)
      toast({
        title: "Error",
        description: "Failed to update synopsis",
        variant: "destructive",
      })
    } finally {
      setIsSavingSynopsis(false)
    }
  }

  const handleStartEditPrompt = () => {
    if (!treatment) return
    setEditingPrompt(treatment.prompt || '')
    setIsEditingPrompt(true)
  }

  const handleCancelEditPrompt = () => {
    setIsEditingPrompt(false)
    setEditingPrompt('')
  }

  const handleSavePrompt = async () => {
    if (!treatment) return

    try {
      setIsSavingPrompt(true)
      const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
        prompt: editingPrompt,
      })
      
      setTreatment(updatedTreatment)
      setIsEditingPrompt(false)
      
      toast({
        title: "Success",
        description: "Treatment updated successfully",
      })
    } catch (error) {
      console.error('Error updating treatment:', error)
      toast({
        title: "Error",
        description: "Failed to update treatment",
        variant: "destructive",
      })
    } finally {
      setIsSavingPrompt(false)
    }
  }

  // Generate AI Synopsis from treatment content
  const generateAISynopsis = async () => {
    if (isGeneratingSynopsis) return
    
    if (!treatment) {
      toast({
        title: "Error",
        description: "Treatment not loaded",
        variant: "destructive",
      })
      return
    }

    // Check if treatment has content to generate from
    const treatmentContent = treatment.prompt || treatment.synopsis || treatment.logline
    if (!treatmentContent || !treatmentContent.trim()) {
      toast({
        title: "Missing Content",
        description: "Treatment needs content (prompt, synopsis, or logline) to generate a new synopsis.",
        variant: "destructive",
      })
      return
    }

    if (!user || !userId) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating synopsis.",
        variant: "destructive",
      })
      return
    }

    if (!aiSettingsLoaded) {
      toast({
        title: "AI Settings Not Loaded",
        description: "Please wait for AI settings to load.",
        variant: "destructive",
      })
      return
    }

    // Use locked model if available, otherwise use selected service
    const lockedModel = getScriptsTabLockedModel()
    const serviceToUse = (isScriptsTabLocked() && lockedModel) ? lockedModel : selectedScriptAIService
    
    if (!serviceToUse) {
      toast({
        title: "AI Service Not Configured",
        description: "Please configure your AI settings in Settings → AI Settings. You need to set up an OpenAI or Anthropic API key.",
        variant: "destructive",
      })
      return
    }

    // Normalize service name
    const normalizedService = serviceToUse.toLowerCase().includes('gpt') || serviceToUse.toLowerCase().includes('openai') ? 'openai' : 
                             serviceToUse.toLowerCase().includes('claude') || serviceToUse.toLowerCase().includes('anthropic') ? 'anthropic' : 
                             serviceToUse.toLowerCase().includes('gemini') || serviceToUse.toLowerCase().includes('google') ? 'google' : 
                             'openai' // Default to OpenAI

    if (normalizedService === 'google') {
      toast({
        title: "Service Not Available",
        description: "Google Gemini is not currently configured. Please use OpenAI or Anthropic.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsGeneratingSynopsis(true)

      // Create prompt from treatment content
      // Use prompt if available, otherwise use synopsis or logline
      const sourceText = treatment.prompt || treatment.synopsis || treatment.logline || ''
      
      // Clean the text (remove markdown, normalize)
      const cleanedText = sourceText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/__/g, '')
        .replace(/`/g, '')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      // Limit to first 2000 characters to avoid token limits
      const contentForPrompt = cleanedText.length > 2000 
        ? cleanedText.substring(0, 2000) + '...'
        : cleanedText

      const aiPrompt = `Write a brief movie synopsis (2-3 paragraphs, 150-300 words) based on the treatment content below.

REQUIREMENTS:
- Summarize the MAIN STORY in 2-3 paragraphs only
- Focus on: who is the protagonist, what is their goal, what is the central conflict
- Write in third person, present tense
- Engaging and cinematic tone
- NO markdown formatting
- NO scene breakdowns
- NO character backstories
- NO production details
- NO plot expansion - just summarize what's already there

CRITICAL: This is a SYNOPSIS (brief summary), NOT a full treatment. Keep it short and focused.

Treatment content to summarize:
${contentForPrompt}

Synopsis (2-3 paragraphs only):`

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          field: 'synopsis',
          service: normalizedService,
          apiKey: 'configured', // Server will fetch from user's database or use environment variables
          userId: userId, // Pass userId so server can fetch user's API keys
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate synopsis')
      }

      const result = await response.json()

      if (result.success && result.text) {
        // Update the synopsis directly
        const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
          synopsis: result.text.trim(),
        })

        setTreatment(updatedTreatment)
        
        toast({
          title: "Synopsis Generated!",
          description: "AI has generated a new synopsis from your treatment content.",
        })
      } else {
        throw new Error('No synopsis text received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI synopsis:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Provide helpful error message if API key is missing
      if (errorMessage.includes('API key not configured') || errorMessage.includes('API key')) {
        toast({
          title: "API Key Required",
          description: "Please set up your OpenAI or Anthropic API key in Settings → AI Settings. Click here to go to settings.",
          variant: "destructive",
        })
        // Navigate to settings after a short delay
        setTimeout(() => {
          if (confirm('Would you like to go to AI Settings to configure your API key?')) {
            router.push('/settings-ai')
          }
        }, 1000)
      } else {
        toast({
          title: "Generation Failed",
          description: `Failed to generate synopsis: ${errorMessage}`,
          variant: "destructive",
        })
      }
    } finally {
      setIsGeneratingSynopsis(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'in-progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Please log in to view treatments</h1>
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading treatment...</p>
          </div>
        </div>
      </>
    )
  }

  if (!treatment) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Treatment not found</h1>
            <Button asChild>
              <Link href="/treatments">Back to Treatments</Link>
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/treatments" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Treatments
            </Link>
          </Button>
        </div>

        {/* Treatment Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{treatment.title}</h1>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {treatment.genre}
                </Badge>
                <Badge className={`text-lg px-3 py-1 ${getStatusColor(treatment.status)}`}>
                  {treatment.status.replace('-', ' ')}
                </Badge>
                {treatment.project_id && movie && (
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    <Film className="h-3 w-3 mr-1" />
                    Linked to: {movie.name}
                  </Badge>
                )}
              </div>
              {treatment.project_id && movie && (
                <div className="mt-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/treatments/movie/${movie.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Movie Project
                    </Link>
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>

        {/* Cover Image */}
        {treatment.cover_image_url && (
          <Card className="mb-8 overflow-hidden">
            <div className="relative h-64 md:h-80 bg-muted">
              <img
                src={treatment.cover_image_url}
                alt={`${treatment.title} cover`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden absolute inset-0 flex items-center justify-center bg-muted">
                <div className="text-center text-muted-foreground">
                  <Film className="h-16 w-16 mx-auto mb-4" />
                  <p className="text-lg">Cover Image</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Synopsis */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Synopsis
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {!isEditingSynopsis ? (
                      <>
                        {/* Quick Listen Button */}
                        {treatment.synopsis && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                            onClick={() => {
                              // Scroll to the text-to-speech component
                              const ttsElement = document.querySelector('[data-tts-synopsis]')
                              if (ttsElement) {
                                ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }
                            }}
                          >
                            <Volume2 className="h-4 w-4 mr-2" />
                            Listen
                          </Button>
                        )}
                        {/* AI Regenerate Button - Show when treatment has content */}
                        {(treatment.prompt || treatment.synopsis || treatment.logline) && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={generateAISynopsis}
                            disabled={isGeneratingSynopsis || !aiSettingsLoaded}
                            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                            title="Generate new synopsis from treatment content using AI"
                          >
                            {isGeneratingSynopsis ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                AI Regenerate
                              </>
                            )}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handleStartEditSynopsis}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCancelEditSynopsis}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSaveSynopsis} disabled={isSavingSynopsis}>
                          <Save className="h-4 w-4 mr-2" />
                          {isSavingSynopsis ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isEditingSynopsis ? (
                    <Textarea
                      value={editingSynopsis}
                      onChange={(e) => setEditingSynopsis(e.target.value)}
                      placeholder="Enter synopsis..."
                      rows={8}
                      className="text-lg leading-relaxed"
                    />
                  ) : (
                    <>
                      {treatment.synopsis ? (
                    <>
                      <p className="text-lg leading-relaxed whitespace-pre-wrap">{treatment.synopsis}</p>
                      
                      {/* Text to Speech Component */}
                      <div data-tts-synopsis>
                        <TextToSpeech 
                          text={treatment.synopsis}
                          title={`${treatment.title} - Synopsis`}
                          projectId={treatment.project_id}
                          sceneId={null}
                              treatmentId={treatment.id}
                          className="mt-4"
                        />
                      </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground italic">No synopsis provided</p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Treatment (Full Document) */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      Treatment
                    </CardTitle>
                    <CardDescription>Full treatment document - paste your complete treatment here (matches ideas.prompt field)</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditingPrompt ? (
                      <>
                        {treatment.prompt && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                            onClick={() => {
                              const ttsElement = document.querySelector('[data-tts-prompt]')
                              if (ttsElement) {
                                ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }
                            }}
                          >
                            <Volume2 className="h-4 w-4 mr-2" />
                            Listen
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handleStartEditPrompt}>
                          <Edit className="h-4 w-4 mr-2" />
                          {treatment.prompt ? 'Edit' : 'Add Treatment'}
                        </Button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCancelEditPrompt}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSavePrompt} disabled={isSavingPrompt}>
                          <Save className="h-4 w-4 mr-2" />
                          {isSavingPrompt ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isEditingPrompt ? (
                    <Textarea
                      value={editingPrompt}
                      onChange={(e) => setEditingPrompt(e.target.value)}
                      placeholder="Paste your full treatment document here. This is the complete treatment (like ideas.prompt), separate from the synopsis above."
                      rows={25}
                      className="text-base leading-relaxed font-mono min-h-[500px]"
                    />
                  ) : (
                    <>
                      {treatment.prompt ? (
                        <div className="space-y-4">
                          <p className="text-base leading-relaxed whitespace-pre-wrap font-mono">{treatment.prompt}</p>
                          
                          {/* Text to Speech Component */}
                          <div data-tts-prompt>
                            <TextToSpeech 
                              text={treatment.prompt}
                              title={`${treatment.title} - Treatment`}
                              projectId={treatment.project_id}
                              sceneId={null}
                              treatmentId={treatment.id}
                              className="mt-4"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed border-muted rounded-lg">
                          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-muted-foreground mb-2">No treatment document yet</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            Click "Add Treatment" to paste your full treatment document
                          </p>
                          <Button variant="outline" onClick={handleStartEditPrompt}>
                            <Edit className="h-4 w-4 mr-2" />
                            Add Treatment
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Treatment Details Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-500" />
                      Treatment Details
                    </CardTitle>
                    <CardDescription>Project information and metadata</CardDescription>
                  </div>
                  {!isEditingTreatment ? (
                    <Button variant="outline" size="sm" onClick={handleStartEditTreatment}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCancelEditTreatment}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button variant="default" size="sm" onClick={handleSaveTreatment} disabled={isSavingTreatment}>
                        <Save className="h-4 w-4 mr-2" />
                        {isSavingTreatment ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Project Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium text-sm">Target Audience</Label>
                      </div>
                      {isEditingTreatment ? (
                        <Input
                          value={editingTreatmentData.target_audience}
                          onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, target_audience: e.target.value }))}
                          placeholder="e.g., 18-35"
                          className="ml-6"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground pl-6">
                          {treatment.target_audience || 'Not specified'}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium text-sm">Estimated Budget</Label>
                      </div>
                      {isEditingTreatment ? (
                        <Input
                          value={editingTreatmentData.estimated_budget}
                          onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, estimated_budget: e.target.value }))}
                          placeholder="e.g., $10M"
                          className="ml-6"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground pl-6">
                          {treatment.estimated_budget || 'Not specified'}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium text-sm">Estimated Duration</Label>
                      </div>
                      {isEditingTreatment ? (
                        <Input
                          value={editingTreatmentData.estimated_duration}
                          onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, estimated_duration: e.target.value }))}
                          placeholder="e.g., 120 min"
                          className="ml-6"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground pl-6">
                          {treatment.estimated_duration || 'Not specified'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status and Genre */}
                  <div className="flex items-center gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm font-medium mb-1">Status</p>
                      <Badge className={getStatusColor(treatment.status)}>
                        {treatment.status.replace('-', ' ')}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Genre</p>
                      <Badge variant="outline">{treatment.genre}</Badge>
                    </div>
                    {treatment.project_id && movie && (
                      <div>
                        <p className="text-sm font-medium mb-1">Movie Project</p>
                        <Badge variant="secondary">
                          <Film className="h-3 w-3 mr-1" />
                          {movie.name}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Timeline */}
                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium mb-1">Created</p>
                        <p className="text-muted-foreground">
                          {new Date(treatment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">Last Updated</p>
                        <p className="text-muted-foreground">
                          {new Date(treatment.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logline */}
            {treatment.logline && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Logline</CardTitle>
                      <CardDescription>One-sentence summary</CardDescription>
                    </div>
                    {/* Quick Listen Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => {
                        const ttsElement = document.querySelector('[data-tts-logline]')
                        if (ttsElement) {
                          ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Listen
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-lg font-medium italic">"{treatment.logline}"</p>
                    
                    {/* Text to Speech Component */}
                    <div data-tts-logline>
                      <TextToSpeech 
                        text={treatment.logline}
                        title={`${treatment.title} - Logline`}
                        projectId={treatment.project_id}
                        sceneId={null}
                        treatmentId={treatment.id}
                        className="mt-4"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Characters */}
            {treatment.characters && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Characters</CardTitle>
                    {/* Quick Listen Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => {
                        const ttsElement = document.querySelector('[data-tts-characters]')
                        if (ttsElement) {
                          ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Listen
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="whitespace-pre-line">{treatment.characters}</p>
                    
                    {/* Text to Speech Component */}
                    <div data-tts-characters>
                      <TextToSpeech 
                        text={treatment.characters}
                        title={`${treatment.title} - Characters`}
                        projectId={treatment.project_id}
                        sceneId={null}
                        treatmentId={treatment.id}
                        className="mt-4"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Themes */}
            {treatment.themes && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Themes</CardTitle>
                    {/* Quick Listen Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => {
                        const ttsElement = document.querySelector('[data-tts-themes]')
                        if (ttsElement) {
                          ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Listen
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="whitespace-pre-line">{treatment.themes}</p>
                    
                    {/* Text to Speech Component */}
                    <div data-tts-themes>
                      <TextToSpeech 
                        text={treatment.themes}
                        title={`${treatment.title} - Themes`}
                        projectId={treatment.project_id}
                        sceneId={null}
                        treatmentId={treatment.id}
                        className="mt-4"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Visual References */}
            {treatment.visual_references && (
              <Card>
                <CardHeader>
                  <CardTitle>Visual References</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line">{treatment.visual_references}</p>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {treatment.notes && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Notes</CardTitle>
                    {/* Quick Listen Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => {
                        const ttsElement = document.querySelector('[data-tts-notes]')
                        if (ttsElement) {
                          ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Listen
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="whitespace-pre-line">{treatment.notes}</p>
                    
                    {/* Text to Speech Component */}
                    <div data-tts-notes>
                      <TextToSpeech 
                        text={treatment.notes}
                        title={`${treatment.title} - Notes`}
                        projectId={treatment.project_id}
                        sceneId={null}
                        treatmentId={treatment.id}
                        className="mt-4"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Project Details */}
            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Target Audience</p>
                    <p className="text-sm text-muted-foreground">
                      {treatment.target_audience || 'Not specified'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Estimated Budget</p>
                    <p className="text-sm text-muted-foreground">
                      {treatment.estimated_budget || 'Not specified'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Estimated Duration</p>
                    <p className="text-sm text-muted-foreground">
                      {treatment.estimated_duration || 'Not specified'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(treatment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(treatment.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Treatment
                </Button>
                <Button variant="outline" className="w-full" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View in Timeline
                </Button>
                <Button variant="outline" className="w-full" size="sm">
                  <Film className="h-4 w-4 mr-2" />
                  Create Movie Project
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
