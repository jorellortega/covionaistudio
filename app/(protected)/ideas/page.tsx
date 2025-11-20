"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
// Replace collapsible genre picker with overlay popover
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Lightbulb, Sparkles, Plus, Edit, Trash2, Save, Search, Filter, Image as ImageIcon, Upload, FileText, Film, Loader2, List, Copy, Download, ChevronDown, ChevronUp, Wand2 } from "lucide-react"
import { jsPDF } from "jspdf"
import { useAuthReady } from "@/components/auth-hooks"
import { MovieIdeasService, type MovieIdea } from "@/lib/movie-ideas-service"
import { AISettingsService } from "@/lib/ai-settings-service"
import { OpenAIService } from "@/lib/ai-services"
import { getSupabaseClient } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import { IdeaImagesService } from "@/lib/idea-images-service"
import { Navigation } from "@/components/navigation"
import { sanitizeFilename } from '@/lib/utils'
import { MovieService, type CreateMovieData } from "@/lib/movie-service"
import { TreatmentsService, type CreateTreatmentData } from "@/lib/treatments-service"

export default function IdeasPage() {
  const router = useRouter()
  const { user, userId, ready } = useAuthReady()
  const [ideas, setIdeas] = useState<MovieIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterGenre, setFilterGenre] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingIdea, setEditingIdea] = useState<MovieIdea | null>(null)
  
  // AI Settings state
  const [aiSettings, setAiSettings] = useState<any>({})
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  const [userApiKeys, setUserApiKeys] = useState<any>({})
  const [userName, setUserName] = useState<string>("")
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [aiResponse, setAiResponse] = useState<string>("")
  const [aiResponseRaw, setAiResponseRaw] = useState<string>("") // Store raw response before cleaning for genre extraction
  const [generatedImage, setGeneratedImage] = useState<string>("")
  const [isSavingImage, setIsSavingImage] = useState(false)
  
  // Idea Library Image Generation state
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [selectedIdeaForImage, setSelectedIdeaForImage] = useState<MovieIdea | null>(null)
  const [imagePrompt, setImagePrompt] = useState("")
  const [ideaImages, setIdeaImages] = useState<{[key: string]: string[]}>({})
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [dialogGeneratedImage, setDialogGeneratedImage] = useState<string | null>(null)
  const [generatingCoverForIdea, setGeneratingCoverForIdea] = useState<string | null>(null) // Track which idea is generating a cover
  
  // Store generated image data for form access
  const [pendingImageData, setPendingImageData] = useState<{
    imageUrl: string;
    prompt: string;
    bucketPath?: string;
  } | null>(null)
  
  // Import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importType, setImportType] = useState<'image' | 'script' | 'idea'>('image')
  const [importImageUrl, setImportImageUrl] = useState("")
  const [importImagePrompt, setImportImagePrompt] = useState("")
  const [importImageIdeaId, setImportImageIdeaId] = useState<string | undefined>(undefined)
  const [importScriptTitle, setImportScriptTitle] = useState("")
  const [importScriptContent, setImportScriptContent] = useState("")
  const [importScriptGenre, setImportScriptGenre] = useState("")
  const [importIdeaTitle, setImportIdeaTitle] = useState("")
  const [importIdeaDescription, setImportIdeaDescription] = useState("")
  const [importIdeaGenre, setImportIdeaGenre] = useState("")
  const [importIdeaMainCreator, setImportIdeaMainCreator] = useState("")
  const [importIdeaCoCreators, setImportIdeaCoCreators] = useState<string[]>([])
  type IdeaStatus = "concept" | "development" | "pre-production" | "production" | "post-production" | "completed"
  const [importIdeaStatus, setImportIdeaStatus] = useState<IdeaStatus>("concept")
  const [isImporting, setIsImporting] = useState(false)
  
  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const [importProgress, setImportProgress] = useState<{[key: string]: number}>({})
  
  // Import search state
  const [importIdeaSearch, setImportIdeaSearch] = useState("")
  
  // Tab state
  const [activeTab, setActiveTab] = useState("ai-prompt")
  
  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [genre, setGenre] = useState("") // Legacy, kept for backward compatibility
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]) // New: array of genres
  const [mainCreator, setMainCreator] = useState("")
  const [coCreators, setCoCreators] = useState<string[]>([])
  const [originalPrompt, setOriginalPrompt] = useState("")
  const [prompt, setPrompt] = useState("")
  const [synopsis, setSynopsis] = useState("")
  const [status, setStatus] = useState<"concept" | "development" | "completed">("concept")
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false)
  const [generatingSynopsisForIdea, setGeneratingSynopsisForIdea] = useState<string | null>(null)

  // Movie conversion state
  const [showMovieDialog, setShowMovieDialog] = useState(false)
  const [convertingIdea, setConvertingIdea] = useState<MovieIdea | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [cowriterInput, setCowriterInput] = useState("")
  const [movieData, setMovieData] = useState<CreateMovieData>({
    name: "",
    description: "",
    genre: "",
    project_type: "movie",
    movie_status: "Pre-Production",
    project_status: "active",
    writer: "",
    cowriters: []
  })

  // Treatment conversion dialog state
  const [showTreatmentDialog, setShowTreatmentDialog] = useState(false)
  const [isSavingTreatment, setIsSavingTreatment] = useState(false)
  const [isGeneratingTreatmentSynopsis, setIsGeneratingTreatmentSynopsis] = useState(false)
  const [convertingIdeaForTreatment, setConvertingIdeaForTreatment] = useState<MovieIdea | null>(null)
  const [treatmentTitle, setTreatmentTitle] = useState<string>("")
  const [treatmentGenre, setTreatmentGenre] = useState<string>("")
  const [treatmentLogline, setTreatmentLogline] = useState<string>("")
  const [treatmentSynopsis, setTreatmentSynopsis] = useState<string>("")
  const [treatmentPrompt, setTreatmentPrompt] = useState<string>("")
  const [treatmentCoverImageUrl, setTreatmentCoverImageUrl] = useState<string | undefined>(undefined)

  const genres = [
    "Action", "Adventure", "Comedy", "Crime", "Drama", "Fantasy", 
    "Horror", "Mystery", "Romance", "Sci-Fi", "Thriller", "Western",
    "Animation", "Documentary", "Musical", "War", "Biography", "History"
  ]

  useEffect(() => {
    if (ready) {
      fetchIdeas()
      fetchAISettings()
      fetchUserApiKeys()
    }
  }, [ready])

  useEffect(() => {
    if (ideas.length > 0 && ready) {
      loadSavedImages()
    }
  }, [ideas, ready])

  const fetchIdeas = async () => {
    try {
      setLoading(true)
      const data = await MovieIdeasService.getUserIdeas(user!.id)
      setIdeas(data)
    } catch (error) {
      console.error('Error fetching ideas:', error)
      toast({
        title: "Error",
        description: "Failed to fetch ideas",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const regenerateIdeaSynopsis = async (idea: MovieIdea) => {
    if (!ready || !user || !userId) return
    try {
      setGeneratingSynopsisForIdea(idea.id)
      const sourceText = (idea.prompt && idea.prompt.trim()) || (idea.description && idea.description.trim()) || ""
      if (!sourceText) {
        toast({
          title: "No Content",
          description: "This idea has no description or AI content to summarize.",
          variant: "destructive",
        })
        return
      }
      const newSynopsis = await generateSynopsisForText(sourceText)
      if (newSynopsis) {
        await MovieIdeasService.updateIdea(idea.id, {
          synopsis: newSynopsis,
          updated_at: new Date().toISOString(),
        })
        toast({
          title: "Synopsis Updated",
          description: "A new synopsis was generated and saved.",
        })
        await fetchIdeas()
      }
    } catch (error) {
      console.error('Error regenerating synopsis:', error)
      toast({
        title: "Error",
        description: "Failed to generate synopsis for this idea.",
        variant: "destructive",
      })
    } finally {
      setGeneratingSynopsisForIdea(null)
    }
  }

  // Generate synopsis from prompt/description using AI
  const generateSynopsis = async (): Promise<string | null> => {
    if (!ready || !user || !userId) {
      return null
    }

    // Get content to generate synopsis from (prioritize prompt, then description)
    const sourceText = prompt.trim() || description.trim()
    if (!sourceText) {
      return null
    }

    // Check AI settings
    if (!aiSettingsLoaded || !aiSettings.scripts) {
      toast({
        title: "AI Settings Not Loaded",
        description: "Please wait for AI settings to load.",
        variant: "destructive",
      })
      return null
    }

    // Get selected AI service
    const scriptsSetting = aiSettings.scripts
    const serviceToUse = scriptsSetting.is_locked && scriptsSetting.locked_model
      ? scriptsSetting.locked_model
      : scriptsSetting.selected_model || 'gpt-4o-mini'

    // Normalize service name
    const normalizedService = serviceToUse.toLowerCase().includes('gpt') || serviceToUse.toLowerCase().includes('openai') ? 'openai' : 
                             serviceToUse.toLowerCase().includes('claude') || serviceToUse.toLowerCase().includes('anthropic') ? 'anthropic' : 
                             'openai'

    if (normalizedService === 'google') {
      toast({
        title: "Service Not Available",
        description: "Google Gemini is not currently configured. Please use OpenAI or Anthropic.",
        variant: "destructive",
      })
      return null
    }

    try {
      setIsGeneratingSynopsis(true)

      // Clean the text
      const cleanedText = sourceText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/__/g, '')
        .replace(/`/g, '')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      // Limit to first 2000 characters
      const contentForPrompt = cleanedText.length > 2000 
        ? cleanedText.substring(0, 2000) + '...'
        : cleanedText

      const aiPrompt = `Write a brief movie synopsis (2-3 paragraphs, 150-300 words) for the following movie idea.

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

Movie idea content:
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
          apiKey: 'configured',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate synopsis')
      }

      const result = await response.json()
      
      if (result.success && result.text) {
        return result.text.trim()
      } else {
        throw new Error('No synopsis text received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI synopsis:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate synopsis'
      toast({
        title: "Synopsis Generation Failed",
        description: `Could not generate synopsis: ${errorMessage}. You can still save without a synopsis.`,
        variant: "destructive",
      })
      return null
    } finally {
      setIsGeneratingSynopsis(false)
    }
  }

  // Generate synopsis for arbitrary text (used in treatment dialog)
  const generateSynopsisForText = async (sourceText: string): Promise<string | null> => {
    if (!ready || !user || !userId) {
      return null
    }
    const content = (sourceText || "").trim()
    if (!content) return null
    if (!aiSettingsLoaded || !aiSettings.scripts) {
      toast({
        title: "AI Settings Not Loaded",
        description: "Please wait for AI settings to load.",
        variant: "destructive",
      })
      return null
    }
    const scriptsSetting = aiSettings.scripts
    const serviceToUse = scriptsSetting.is_locked && scriptsSetting.locked_model
      ? scriptsSetting.locked_model
      : scriptsSetting.selected_model || 'gpt-4o-mini'
    const normalizedService = serviceToUse.toLowerCase().includes('gpt') || serviceToUse.toLowerCase().includes('openai') ? 'openai' : 
                             serviceToUse.toLowerCase().includes('claude') || serviceToUse.toLowerCase().includes('anthropic') ? 'anthropic' : 
                             'openai'
    try {
      setIsGeneratingTreatmentSynopsis(true)
      const cleanedText = content
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/__/g, '')
        .replace(/`/g, '')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      const contentForPrompt = cleanedText.length > 2000 
        ? cleanedText.substring(0, 2000) + '...'
        : cleanedText
      const aiPrompt = `Write a brief movie synopsis (2-3 paragraphs, 150-300 words) for the following movie idea.\n\nREQUIREMENTS:\n- Summarize the MAIN STORY in 2-3 paragraphs only\n- Focus on: who is the protagonist, what is their goal, what is the central conflict\n- Write in third person, present tense\n- Engaging and cinematic tone\n- NO markdown formatting\n- NO scene breakdowns\n- NO character backstories\n- NO production details\n- NO plot expansion - just summarize what's already there\n\nCRITICAL: This is a SYNOPSIS (brief summary), NOT a full treatment. Keep it short and focused.\n\nMovie idea content:\n${contentForPrompt}\n\nSynopsis (2-3 paragraphs only):`
      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          field: 'synopsis',
          service: normalizedService,
          apiKey: 'configured',
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate synopsis')
      }
      const result = await response.json()
      if (result.success && result.text) {
        return result.text.trim()
      } else {
        throw new Error('No synopsis text received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI synopsis:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate synopsis'
      toast({
        title: "Synopsis Generation Failed",
        description: `Could not generate synopsis: ${errorMessage}.`,
        variant: "destructive",
      })
      return null
    } finally {
      setIsGeneratingTreatmentSynopsis(false)
    }
  }

  const openTreatmentDialog = async (idea: MovieIdea) => {
    setConvertingIdeaForTreatment(idea)
    // Prefill draft fields from idea
    const firstGenre = (idea.genres && idea.genres.length > 0) ? idea.genres[0] : (idea.genre || "Unspecified")
    setTreatmentTitle(idea.title || "")
    setTreatmentGenre(firstGenre)
    // Simple logline default from description
    const desc = idea.description || ""
    const loglineDefault = desc.length > 200 ? (desc.substring(0, 200).trim() + '...') : desc
    setTreatmentLogline(loglineDefault)
    setTreatmentSynopsis((idea.synopsis || "").trim())
    setTreatmentPrompt(idea.prompt || "")
    // Cover image will be resolved on save if needed (optional)
    setTreatmentCoverImageUrl(undefined)
    setShowTreatmentDialog(true)
  }

  const saveTreatmentFromDialog = async () => {
    if (!user || !userId || !convertingIdeaForTreatment) return
    try {
      setIsSavingTreatment(true)
      // Resolve cover image from idea images if not set
      let coverImageUrl = treatmentCoverImageUrl
      if (!coverImageUrl) {
        try {
          const ideaImages = await IdeaImagesService.getIdeaImages(convertingIdeaForTreatment.id)
          const imageFiles = ideaImages.filter(img => img.image_url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))
          if (imageFiles.length > 0) {
            coverImageUrl = imageFiles[0].image_url
          }
        } catch {
          // ignore
        }
      }
      const treatmentData: CreateTreatmentData = {
        title: treatmentTitle.trim() || convertingIdeaForTreatment.title,
        genre: treatmentGenre || "Unspecified",
        status: 'draft',
        synopsis: treatmentSynopsis.trim() || undefined,
        prompt: treatmentPrompt.trim() || undefined,
        logline: treatmentLogline.trim() || convertingIdeaForTreatment.description || '',
        notes: convertingIdeaForTreatment.original_prompt || undefined,
        cover_image_url: coverImageUrl,
      }
      const treatment = await TreatmentsService.createTreatment(treatmentData)
      toast({
        title: "Success!",
        description: `Idea "${treatmentData.title}" converted to treatment successfully!`,
      })
      setShowTreatmentDialog(false)
      setConvertingIdeaForTreatment(null)
      router.push('/treatments')
    } catch (error) {
      console.error('Error creating treatment from dialog:', error)
      toast({
        title: "Error",
        description: "Failed to create treatment",
        variant: "destructive",
      })
    } finally {
      setIsSavingTreatment(false)
    }
  }

  const saveIdea = async () => {
    if (!ready || !title.trim() || !description.trim() || !mainCreator.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Title, Description, and Main Creator)",
        variant: "destructive",
      })
      return
    }

    try {
      // Do NOT auto-generate synopsis; use whatever user provided
      const finalSynopsis = synopsis.trim()

      const ideaData = {
        user_id: userId,
        title: title.trim(),
        description: description.trim(),
        // Support both old genre field (for backward compatibility) and new genres array
        genre: selectedGenres.length > 0 ? selectedGenres[0] : (genre || "Unspecified"),
        genres: selectedGenres.length > 0 ? selectedGenres : (genre ? [genre] : []),
        main_creator: mainCreator.trim() || "Unknown",
        co_creators: coCreators,
        original_prompt: originalPrompt.trim(),
        prompt: prompt.trim(),
        synopsis: finalSynopsis,
        status,
        updated_at: new Date().toISOString()
      }

      console.log('🎬 DEBUG - Saving idea with data:', ideaData)
      console.log('🎬 DEBUG - mainCreator value:', mainCreator)
      console.log('🎬 DEBUG - main_creator in ideaData:', ideaData.main_creator)

      if (editingIdea) {
        // Update existing idea
        console.log('🎬 DEBUG - Updating existing idea:', editingIdea.id)
        const updatedIdea = await MovieIdeasService.updateIdea(editingIdea.id, ideaData)
        console.log('🎬 DEBUG - Updated idea result:', updatedIdea)
        toast({
          title: "Success",
          description: "Idea updated successfully",
        })
      } else {
        // Create new idea
        console.log('🎬 DEBUG - Creating new idea')
        const savedIdea = await MovieIdeasService.createIdea(user!.id, ideaData)
        console.log('🎬 DEBUG - Created idea result:', savedIdea)
        
        // If there's pending image data, save the image to this new idea
        if (pendingImageData && savedIdea) {
          try {
            await IdeaImagesService.saveIdeaImage(user!.id, {
              idea_id: savedIdea.id,
              image_url: pendingImageData.imageUrl,
              prompt: pendingImageData.prompt,
              bucket_path: pendingImageData.bucketPath || ''
            })
            
            toast({
              title: "Saved to library",
              description: "Idea saved with image!",
            })
          } catch (imageError) {
            console.error('Error saving image:', imageError)
            toast({
              title: "Saved to library",
              description: "Idea saved but image failed to save",
              variant: "destructive",
            })
          }
        } else {
          toast({
            title: "Saved to library",
            description: "Your idea has been saved successfully",
          })
        }
        
        // Switch to library tab after saving
        setActiveTab("library")
      }

      // Reset form and close dialog
      resetForm()
      setShowAddDialog(false)
      setPendingImageData(null) // Clear pending image data
      fetchIdeas()
      loadSavedImages() // Refresh images to show the new one
    } catch (error) {
      console.error('Error saving idea:', error)
      toast({
        title: "Error",
        description: "Failed to save idea",
        variant: "destructive",
      })
    }
  }

  const deleteIdea = async (id: string) => {
    try {
      await MovieIdeasService.deleteIdea(id)
      toast({
        title: "Success",
        description: "Idea deleted successfully",
      })
      fetchIdeas()
    } catch (error) {
      console.error('Error deleting idea:', error)
      toast({
        title: "Error",
        description: "Failed to delete idea",
        variant: "destructive",
      })
    }
  }

  const editIdea = (idea: MovieIdea) => {
    setEditingIdea(idea)
    setTitle(idea.title)
    setDescription(idea.description)
    // Support both old genre field and new genres array
    if (idea.genres && idea.genres.length > 0) {
      setSelectedGenres(idea.genres)
      setGenre(idea.genres[0]) // Set legacy genre to first genre for backward compatibility
    } else if (idea.genre) {
      setGenre(idea.genre)
      setSelectedGenres([idea.genre]) // Convert legacy genre to array
    } else {
      setGenre("")
      setSelectedGenres([])
    }
    setMainCreator(idea.main_creator || "")
    setCoCreators(idea.co_creators || [])
    setOriginalPrompt(idea.original_prompt || "")
    setPrompt(idea.prompt)
    setSynopsis(idea.synopsis || "")
    setStatus(idea.status)
    setShowAddDialog(true)
  }

  const resetForm = () => {
    setEditingIdea(null)
    setTitle("")
    setDescription("")
    setGenre("")
    setSelectedGenres([])
    setMainCreator("")
    setCoCreators([])
    setOriginalPrompt("")
    setPrompt("")
    setSynopsis("")
    setStatus("concept")
    setPendingImageData(null) // Clear pending image data
  }

  const resetImportForm = () => {
    setImportType('image')
    setImportImageUrl("")
    setImportImagePrompt("")
    setImportImageIdeaId(undefined)
    setImportScriptTitle("")
    setImportScriptContent("")
    setImportScriptGenre("")
    setImportIdeaTitle("")
    setImportIdeaDescription("")
    setImportIdeaGenre("")
    setImportIdeaMainCreator("")
    setImportIdeaCoCreators([])
    setImportIdeaStatus("concept")
    setDroppedFiles([])
    setImportProgress({})
    setImportIdeaSearch("")
  }

  const convertIdeaToMovie = async (idea: MovieIdea) => {
    setConvertingIdea(idea)
    // Pre-populate movie data from idea
    // Use first genre from genres array, or fallback to legacy genre field
    const firstGenre = (idea.genres && idea.genres.length > 0) 
      ? idea.genres[0] 
      : (idea.genre || "Unspecified")
    setMovieData({
      name: idea.title,
      description: idea.description,
      genre: firstGenre,
      project_type: "movie",
      movie_status: "Pre-Production",
      project_status: "active",
      writer: idea.main_creator || "Unknown",
      cowriters: idea.co_creators || []
    })
    setShowMovieDialog(true)
  }

  const convertIdeaToTreatment = async (idea: MovieIdea) => {
    if (!user || !userId) {
      toast({
        title: "Error",
        description: "You must be logged in to create a treatment",
        variant: "destructive",
      })
      return
    }

    try {
      // Refresh the idea from database to ensure we have the latest data including synopsis
      const freshIdea = await MovieIdeasService.getMovieIdea(idea.id)
      if (!freshIdea) {
        toast({
          title: "Error",
          description: "Idea not found",
          variant: "destructive",
        })
        return
      }
      
      // Use first genre from genres array, or fallback to legacy genre field
      const firstGenre = (freshIdea.genres && freshIdea.genres.length > 0) 
        ? freshIdea.genres[0] 
        : (freshIdea.genre || "Unspecified")
      
      // Use idea's synopsis if it exists, otherwise generate from prompt
      console.log('🎬 Converting idea to treatment:', {
        ideaId: freshIdea.id,
        hasSynopsis: !!freshIdea.synopsis,
        synopsisLength: freshIdea.synopsis?.length || 0,
        synopsisPreview: freshIdea.synopsis?.substring(0, 100) || 'none',
        hasPrompt: !!freshIdea.prompt,
        promptLength: freshIdea.prompt?.length || 0
      })
      
      // Use idea's synopsis if it exists and is not empty
      let synopsis = (freshIdea.synopsis && freshIdea.synopsis.trim()) 
        ? freshIdea.synopsis.trim() 
        : null
      
      // If no synopsis exists, try to extract one from prompt
      if (!synopsis && freshIdea.prompt && freshIdea.prompt.trim()) {
        const promptText = freshIdea.prompt.trim()
        // Remove markdown formatting
        const cleanedPrompt = promptText
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/__/g, '')
          .replace(/`/g, '')
          .replace(/#{1,6}\s+/g, '') // Remove markdown headers
          .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
          .trim()
        
        // Extract first 2-3 paragraphs or first 500-800 characters as synopsis
        const paragraphs = cleanedPrompt.split(/\n\n+/).filter(p => p.trim().length > 0)
        if (paragraphs.length > 0) {
          // Take first 2-3 paragraphs, up to 800 characters
          let synopsisText = ''
          for (let i = 0; i < Math.min(3, paragraphs.length); i++) {
            const para = paragraphs[i].trim()
            if (synopsisText.length + para.length + 2 <= 800) {
              synopsisText += (synopsisText ? '\n\n' : '') + para
            } else {
              // If adding this paragraph would exceed limit, take a portion of it
              const remaining = 800 - synopsisText.length - 2
              if (remaining > 50) {
                synopsisText += (synopsisText ? '\n\n' : '') + para.substring(0, remaining).trim()
              }
              break
            }
          }
          synopsis = synopsisText || cleanedPrompt.substring(0, 800).trim()
        } else {
          // No clear paragraphs, just take first 800 characters
          synopsis = cleanedPrompt.substring(0, 800).trim()
        }
      }
      
      // Fallback to description if still no synopsis
      if (!synopsis || !synopsis.trim()) {
        synopsis = freshIdea.description || 'No description available'
      }
      
      // Extract logline from prompt or description (first sentence or first 200 chars)
      let logline = freshIdea.description || ''
      if (freshIdea.prompt && freshIdea.prompt.trim()) {
        const promptText = freshIdea.prompt.trim()
        // Remove markdown
        const cleanedPrompt = promptText
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/__/g, '')
          .replace(/`/g, '')
          .replace(/#{1,6}\s+/g, '')
          .trim()
        
        // Try to extract first sentence (ending with . ! or ?)
        const firstSentenceMatch = cleanedPrompt.match(/^[^.!?]+[.!?]/)
        if (firstSentenceMatch && firstSentenceMatch[0].length <= 250) {
          logline = firstSentenceMatch[0].trim()
        } else {
          // Use first 200 characters, but try to end at a word boundary
          const excerpt = cleanedPrompt.substring(0, 200).trim()
          const lastSpace = excerpt.lastIndexOf(' ')
          if (lastSpace > 150) {
            logline = excerpt.substring(0, lastSpace).trim() + '...'
          } else {
            logline = excerpt + '...'
          }
        }
      } else if (freshIdea.description && freshIdea.description.length > 200) {
        // If description is long, extract first sentence or first 200 chars
        const firstSentenceMatch = freshIdea.description.match(/^[^.!?]+[.!?]/)
        if (firstSentenceMatch && firstSentenceMatch[0].length <= 250) {
          logline = firstSentenceMatch[0].trim()
        } else {
          logline = freshIdea.description.substring(0, 200).trim() + (freshIdea.description.length > 200 ? '...' : '')
        }
      }

      // Fetch idea images to get the cover image
      let coverImageUrl: string | undefined = undefined
      try {
        const ideaImages = await IdeaImagesService.getIdeaImages(freshIdea.id)
        // Get the first image (most recent) as cover image
        // Filter for image files (jpg, jpeg, png, gif, webp, svg)
        const imageFiles = ideaImages.filter(img => 
          img.image_url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
        )
        if (imageFiles.length > 0) {
          coverImageUrl = imageFiles[0].image_url
          console.log('Found cover image for treatment:', coverImageUrl)
        }
      } catch (imageError) {
        console.error('Error fetching idea images:', imageError)
        // Continue without cover image if there's an error
      }

      // Ensure synopsis is a string (not null)
      const finalSynopsis = synopsis && synopsis.trim() ? synopsis.trim() : undefined
      
      // Create treatment data from idea
      const treatmentData: CreateTreatmentData = {
        title: freshIdea.title,
        genre: firstGenre,
        status: 'draft',
        synopsis: finalSynopsis, // Use idea's synopsis if available, otherwise generated
        prompt: freshIdea.prompt || undefined, // Full treatment document (like ideas.prompt)
        logline: logline || freshIdea.description || '', // Extracted logline (first sentence or excerpt from prompt)
        notes: freshIdea.original_prompt || undefined, // Use original prompt as notes if available
        cover_image_url: coverImageUrl, // Set cover image if available
      }

      console.log('🎬 Creating treatment with data:', {
        title: treatmentData.title,
        hasSynopsis: !!treatmentData.synopsis,
        synopsisLength: treatmentData.synopsis?.length || 0,
        synopsisPreview: treatmentData.synopsis?.substring(0, 100) || 'none',
        hasPrompt: !!treatmentData.prompt,
        promptLength: treatmentData.prompt?.length || 0
      })

      // Create the treatment
      const treatment = await TreatmentsService.createTreatment(treatmentData)
      
      console.log('🎬 Treatment created:', {
        id: treatment.id,
        hasSynopsis: !!treatment.synopsis,
        synopsisLength: treatment.synopsis?.length || 0
      })

      toast({
        title: "Success!",
        description: `Idea "${freshIdea.title}" converted to treatment successfully!`,
      })

      // Navigate to treatments page
      router.push('/treatments')
    } catch (error) {
      console.error('Error converting idea to treatment:', error)
      toast({
        title: "Error",
        description: "Failed to convert idea to treatment",
        variant: "destructive",
      })
    }
  }

  const handleCreateMovie = async () => {
    setIsConverting(true)
    try {
      console.log('🎬 DEBUG - Converting idea to movie:', movieData)
      
      const newMovie = await MovieService.createMovie(movieData)
      
      toast({
        title: "Success!",
        description: `Idea "${movieData.name}" converted to movie successfully!`,
      })

      // Close dialog and reset
      setShowMovieDialog(false)
      setConvertingIdea(null)
      setMovieData({
        name: "",
        description: "",
        genre: "",
        project_type: "movie",
        movie_status: "Pre-Production",
        project_status: "active",
        writer: "",
        cowriters: []
      })
      
      // Optionally redirect to movies page or refresh
      // You could add navigation here if needed
      
    } catch (error) {
      console.error('Error converting idea to movie:', error)
      toast({
        title: "Error",
        description: "Failed to convert idea to movie",
        variant: "destructive",
      })
    } finally {
      setIsConverting(false)
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const newFiles = Array.from(e.dataTransfer.files)
    setDroppedFiles(prev => [...prev, ...newFiles])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    setDroppedFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (index: number) => {
    setDroppedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const getFileType = (file: File): 'image' | 'text' | 'document' | 'unknown' => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) return 'text'
    if (file.type === 'application/pdf' || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword' ||
        file.name.endsWith('.pdf') || 
        file.name.endsWith('.doc') || 
        file.name.endsWith('.docx')) return 'document'
    return 'unknown'
  }

  const getFileIcon = (file: File) => {
    const type = getFileType(file)
    const fileName = file.name.toLowerCase()
    
    switch (type) {
      case 'image': 
        return <ImageIcon className="h-4 w-4 text-blue-500" />
      case 'text': 
        return <FileText className="h-4 w-4 text-green-500" />
      case 'document':
        // Better icons for specific document types
        if (fileName.endsWith('.pdf')) {
          return <FileText className="h-4 w-4 text-red-500" />
        } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
          return <FileText className="h-4 w-4 text-blue-600" />
        } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
          return <FileText className="h-4 w-4 text-green-600" />
        } else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
          return <FileText className="h-4 w-4 text-orange-500" />
        } else {
          return <FileText className="h-4 w-4 text-purple-500" />
        }
      default:
        // Handle other file types with better icons
        if (fileName.endsWith('.mp4') || fileName.endsWith('.avi') || fileName.endsWith('.mov')) {
          return <FileText className="h-4 w-4 text-purple-600" />
        } else if (fileName.endsWith('.mp3') || fileName.endsWith('.wav') || fileName.endsWith('.aac')) {
          return <FileText className="h-4 w-4 text-yellow-500" />
        } else if (fileName.endsWith('.zip') || fileName.endsWith('.rar') || fileName.endsWith('.7z')) {
          return <FileText className="h-4 w-4 text-gray-600" />
        } else {
          return <FileText className="h-4 w-4 text-gray-500" />
        }
    }
  }

  const handleBulkImport = async () => {
    if (!ready || droppedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select files to import",
        variant: "destructive",
      })
      return
    }

    // Check if we have an existing idea or need to create a new one
    let ideaId: string | null = null
    
    if (importImageIdeaId) {
      // Use existing idea
      ideaId = importImageIdeaId
    } else {
      // Require a name for the new idea
      if (!importIdeaTitle.trim()) {
        toast({
          title: "Error",
          description: "Please provide a name for your new idea",
          variant: "destructive",
        })
        return
      }

      // Create a new movie idea
      try {
        const ideaData = {
          title: importIdeaTitle,
          description: importIdeaDescription || `Imported idea: ${importIdeaTitle}`,
          genre: importIdeaGenre || "Unspecified", // Legacy field for backward compatibility
          genres: importIdeaGenre ? [importIdeaGenre] : [], // New genres array
          main_creator: importIdeaMainCreator.trim() || "Unknown",
          co_creators: importIdeaCoCreators,
          status: importIdeaStatus || "concept"
        }
        
        console.log('🎬 DEBUG - Creating idea with data:', ideaData)
        console.log('🎬 DEBUG - importIdeaMainCreator raw value:', importIdeaMainCreator)
        console.log('🎬 DEBUG - importIdeaMainCreator trimmed:', importIdeaMainCreator.trim())
        console.log('🎬 DEBUG - Final main_creator value:', ideaData.main_creator)
        
        const ideaResponse = await fetch('/api/import/idea', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ideaData)
        })

        if (ideaResponse.ok) {
          const ideaData = await ideaResponse.json()
          ideaId = ideaData.idea.id
        } else {
          throw new Error('Failed to create idea')
        }
      } catch (error) {
        console.error('Error creating idea:', error)
        toast({
          title: "Error",
          description: "Failed to create new idea",
          variant: "destructive",
        })
        setIsImporting(false)
        return
      }
    }

    setIsImporting(true)
    const results: { success: string[], failed: string[] } = { success: [], failed: [] }

    // Now import all files and associate them with the new idea
    for (const file of droppedFiles) {
      try {
        const fileName = file.name
        setImportProgress(prev => ({ ...prev, [fileName]: 0 }))

        if (getFileType(file) === 'image') {
          // Handle image import - always associate with the new idea
          const formData = new FormData()
          formData.append('image', file)
          formData.append('prompt', `Imported image: ${fileName}`)
          formData.append('ideaId', ideaId!)

          const response = await fetch('/api/import/image-file', {
            method: 'POST',
            body: formData
          })

          if (response.ok) {
            results.success.push(fileName)
            setImportProgress(prev => ({ ...prev, [fileName]: 100 }))
          } else {
            results.failed.push(fileName)
          }
        } else {
          // Handle all other file types (text, PDF, Word, video, etc.) - upload to storage and save to idea
          try {
            // Upload file to Supabase storage
            const timestamp = Date.now()
            const fileExtension = fileName.split('.').pop()
            
            // Sanitize filename for safe storage
            const sanitizedName = sanitizeFilename(fileName)
            
            const storageFileName = `${timestamp}-${sanitizedName}.${fileExtension}`
            const filePath = `${user!.id}/ideas/${ideaId}/${storageFileName}`

            // Upload to storage
            const { data: uploadData, error: uploadError } = await getSupabaseClient().storage
              .from('cinema_files')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
              })

            if (uploadError) {
              console.error(`Storage upload error for ${fileName}:`, uploadError)
              results.failed.push(fileName)
              continue
            }

            // Get public URL
            const { data: { publicUrl } } = getSupabaseClient().storage
              .from('cinema_files')
              .getPublicUrl(filePath)

            // Save file reference to idea_images table (we'll use this for all file types)
            const { data: fileData, error: dbError } = await getSupabaseClient()
              .from('idea_images')
              .insert({
                user_id: user!.id,
                idea_id: ideaId,
                image_url: publicUrl, // We'll use this field for all file types
                prompt: `Imported file: ${fileName}`,
                bucket_path: filePath
              })
              .select()
              .single()

            if (dbError) {
              console.error(`Database insert error for ${fileName}:`, dbError)
              results.failed.push(fileName)
            } else {
              results.success.push(fileName)
              setImportProgress(prev => ({ ...prev, [fileName]: 100 }))
              console.log(`File ${fileName} uploaded and saved successfully for idea ${ideaId}`)
            }
          } catch (error) {
            console.error(`Error processing file ${fileName}:`, error)
            results.failed.push(fileName)
          }
        }
      } catch (error) {
        console.error(`Error importing ${file.name}:`, error)
        results.failed.push(file.name)
      }
    }

    // Show results
    if (results.success.length > 0) {
      toast({
        title: "Import Complete",
        description: `Successfully imported ${results.success.length} files${results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}`,
      })
    }

    if (results.failed.length > 0) {
      toast({
        title: "Import Errors",
        description: `Failed to import: ${results.failed.join(', ')}`,
        variant: "destructive",
      })
    }

    // Refresh data and reset
    fetchIdeas()
    loadSavedImages()
    setDroppedFiles([])
    setImportProgress({})
    setIsImporting(false)
  }

  const fetchAISettings = async () => {
    try {
      let settings = await AISettingsService.getUserSettings(user!.id)
      
      // Ensure selected_model is set for scripts tab with ChatGPT/GPT-4/Claude
      settings = settings.map(setting => {
        if (setting.tab_type === 'scripts' && !setting.selected_model) {
          if (setting.locked_model === 'ChatGPT' || setting.locked_model === 'GPT-4') {
            setting.selected_model = 'gpt-4o-mini'
          } else if (setting.locked_model === 'Claude') {
            setting.selected_model = 'claude-3-5-sonnet-20241022'
          }
        }
        return setting
      })
      
      const settingsMap = settings.reduce((acc, setting) => {
        acc[setting.tab_type] = setting
        return acc
      }, {} as any)
      setAiSettings(settingsMap)
      setAiSettingsLoaded(true)
    } catch (error) {
      console.error('Error fetching AI settings:', error)
      setAiSettingsLoaded(true) // Set to true even on error to prevent blocking
    }
  }

  const fetchUserApiKeys = async () => {
    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key, anthropic_api_key, openart_api_key, kling_api_key, runway_api_key, elevenlabs_api_key, suno_api_key, name')
        .eq('id', user!.id)
        .single()

      if (error) throw error
      setUserApiKeys(data || {})
      // Set user name if available
      if (data?.name) {
        setUserName(data.name)
      } else if (user?.name) {
        setUserName(user.name)
      } else if (user?.email) {
        // Fallback to email username if name not available
        setUserName(user.email.split('@')[0])
      }
    } catch (error) {
      console.error('Error fetching user API keys:', error)
    }
  }

  const loadSavedImages = async () => {
    try {
      const savedImages: {[key: string]: string[]} = {}
      
      for (const idea of ideas) {
        const images = await IdeaImagesService.getIdeaImages(idea.id)
        savedImages[idea.id] = images.map(img => img.image_url)
      }
      
      setIdeaImages(savedImages)
    } catch (error) {
      console.error('Error loading saved images:', error)
    }
  }

  // Function to refresh images for a specific idea
  const refreshIdeaImages = async (ideaId: string) => {
    try {
      const images = await IdeaImagesService.getIdeaImages(ideaId)
      const imageUrls = images.map(img => img.image_url)
      
      setIdeaImages(prev => ({
        ...prev,
        [ideaId]: imageUrls
      }))
    } catch (error) {
      console.error('Error refreshing idea images:', error)
    }
  }

  // Function to extract genres from text (returns array)
  const extractTitle = (text: string): string => {
    if (!text) return ""
    
    // Try to extract title from various patterns
    // Pattern 1: "Title: Title Name" or "Title:Title Name"
    let match = text.match(/Title:\s*([^\n]+)/i)
    if (match && match[1]) {
      return match[1].trim()
    }
    
    // Pattern 2: "# Title Name" or "## Title Name" (markdown headers)
    match = text.match(/^#{1,3}\s+(.+)$/m)
    if (match && match[1]) {
      return match[1].trim()
    }
    
    // Pattern 3: "**Title:** Title Name" (bold markdown)
    match = text.match(/\*\*Title:\*\*\s*([^\n*]+)/i)
    if (match && match[1]) {
      return match[1].trim().replace(/\*/g, '')
    }
    
    // Pattern 4: First line if it looks like a title (short, no punctuation at end)
    const lines = text.split('\n').filter(line => line.trim().length > 0)
    if (lines.length > 0) {
      const firstLine = lines[0].trim()
      // If first line is short and looks like a title (no period at end, less than 100 chars)
      if (firstLine.length < 100 && !firstLine.endsWith('.') && !firstLine.includes(':')) {
        return firstLine
      }
    }
    
    return ""
  }

  const extractGenres = (text: string): string[] => {
    if (!text) return []
    
    const availableGenres = [
      "Action", "Adventure", "Comedy", "Crime", "Drama", "Fantasy", 
      "Horror", "Mystery", "Romance", "Sci-Fi", "Thriller", "Western",
      "Animation", "Documentary", "Musical", "War", "Biography", "History"
    ]
    
    const foundGenres: string[] = []
    
    // Look for patterns like "Genre: Fantasy/Adventure" or "Genre: Fantasy, Adventure"
    // Try multiple patterns to catch different formats
    const genrePatterns = [
      /Genre:\s*([^\n\r]+)/i,           // "Genre: Fantasy/Adventure"
      /Genre\s*:\s*([^\n\r]+)/i,        // "Genre : Fantasy/Adventure"
      /\*\*Genre:\*\*\s*([^\n\r]+)/i,   // "**Genre:** Fantasy/Adventure"
      /Genre\s+([^\n\r]+)/i,            // "Genre Fantasy/Adventure"
      /^Genre[:\s]+([^\n\r]+)/i,        // At start of line
    ]
    
    for (const pattern of genrePatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        let genre = match[1].trim()
        
        // Clean up markdown formatting if present
        genre = genre
          .replace(/\*\*/g, '') // Remove bold
          .replace(/\*/g, '') // Remove italic
          .replace(/__/g, '') // Remove underline
          .replace(/`/g, '') // Remove code formatting
          .trim()
        
        // If genre contains "/" or ",", check each part
        // For example: "Fantasy/Adventure" -> check "Fantasy" and "Adventure"
        const genreParts = genre.split(/[\/,]/).map(part => part.trim()).filter(part => part.length > 0)
        
        for (const genrePart of genreParts) {
          // Try to match the genre (case-insensitive, exact or partial match)
          const matchedGenre = availableGenres.find(g => {
            const genreLower = genrePart.toLowerCase()
            const availableLower = g.toLowerCase()
            // Exact match
            if (genreLower === availableLower) return true
            // Partial match (contains) - but be careful with short words
            if (genrePart.length >= 3 && availableLower.length >= 3) {
              if (genreLower.includes(availableLower) || availableLower.includes(genreLower)) return true
            }
            // Handle "Sci-Fi" variations
            if ((genreLower.includes('sci') || genreLower.includes('science')) && 
                (genreLower.includes('fi') || genreLower.includes('fiction'))) {
              return g === 'Sci-Fi'
            }
            // Handle common variations
            if (genreLower === 'scifi' || genreLower === 'science fiction') return g === 'Sci-Fi'
            if (genreLower === 'scifi' || genreLower === 'sci fi') return g === 'Sci-Fi'
            return false
          })
          
          // Add to found genres if we found a match and it's not already in the array
          if (matchedGenre && !foundGenres.includes(matchedGenre)) {
            foundGenres.push(matchedGenre)
          }
        }
        
        // If we found genres, return them (don't continue searching other patterns)
        if (foundGenres.length > 0) {
          return foundGenres
        }
      }
    }
    
    // If no genre pattern found, return empty array
    return []
  }

  // Legacy function for backward compatibility (returns first genre or empty string)
  const extractGenre = (text: string): string => {
    const genres = extractGenres(text)
    return genres.length > 0 ? genres[0] : ""
  }

  // Function to clean markdown formatting from text
  const cleanMarkdown = (text: string): string => {
    if (!text) return ""
    
    let cleaned = text
      // Remove horizontal rules (---) on their own line
      .replace(/^[\s]*-{3,}[\s]*$/gm, '')
      // Remove markdown code blocks first (```code```)
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code (`code`) but keep the content
      .replace(/`([^`]+)`/g, '$1')
      // Remove markdown images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
      // Remove markdown links [text](url) but keep the text
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Process lines to handle bullet points with markdown formatting
      // First, handle complex patterns like "**Title:** *text*" in bullet points
      .split('\n')
      .map(line => {
        // Handle bullet points with bold labels and italic values
        line = line.replace(/\*\*([^*:]+):\*\*\s*\*([^*]+)\*/g, '$1: $2')
        // Handle standalone bold labels with italic values (not in bullets)
        line = line.replace(/\*\*([^*:]+):\*\*\s*\*([^*\n]+)\*/g, '$1: $2')
        return line
      })
      .join('\n')
      // Remove all remaining bold formatting (**text**)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      // Remove all remaining italic formatting (*text*) but preserve bullet points
      .replace(/\*([^*\n\s][^*\n]*[^*\n\s])\*/g, '$1')
      .replace(/\*([^*\n\s])\*/g, '$1')
      // Remove markdown headers (###, ##, #) but keep the text
      .replace(/^#{1,6}\s+(.+)$/gm, '$1')
      // Convert markdown bullet points to plain text bullets
      .replace(/^[\s]*[-*+]\s+(.+)$/gm, '  • $1')
      // Remove numbered list markers but keep content
      .replace(/^[\s]*\d+\.\s+(.+)$/gm, '$1')
      // Clean up extra blank lines (more than 2 consecutive newlines)
      .replace(/\n{3,}/g, '\n\n')
      // Remove trailing whitespace from each line
      .replace(/[ \t]+$/gm, '')
      .trim()
    
    return cleaned
  }

  // Function to copy text to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      const cleanedText = cleanMarkdown(text)
      await navigator.clipboard.writeText(cleanedText)
      toast({
        title: "Copied!",
        description: "Script copied to clipboard",
      })
    } catch (error) {
      console.error('Failed to copy:', error)
      toast({
        title: "Copy Failed",
        description: "Failed to copy script to clipboard",
        variant: "destructive",
      })
    }
  }

  // Function to export to PDF
  const exportToPDF = (text: string) => {
    try {
      const cleanedText = cleanMarkdown(text)
      
      // Create a new PDF document (A4 size in mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Set up margins and page dimensions
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      const maxWidth = pageWidth - (margin * 2)
      let yPosition = margin

      // Set default font
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      const lineHeight = 7
      const paragraphSpacing = 3

      // Split text into paragraphs
      const paragraphs = cleanedText.split(/\n\n+/).filter(p => p.trim().length > 0)
      
      paragraphs.forEach((paragraph: string) => {
        // Check if we need a new page before adding paragraph
        if (yPosition + lineHeight * 2 > pageHeight - margin) {
          doc.addPage()
          yPosition = margin
        }

        // Check if paragraph looks like a heading (short line, potentially uppercase or title case)
        const isHeading = paragraph.length < 80 && (
          paragraph === paragraph.toUpperCase() || 
          /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*:?$/.test(paragraph.trim())
        )

        if (isHeading) {
          // Format as heading
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(14)
          const headingLines = doc.splitTextToSize(paragraph.trim(), maxWidth)
          headingLines.forEach((line: string) => {
            if (yPosition + lineHeight > pageHeight - margin) {
              doc.addPage()
              yPosition = margin
            }
            doc.text(line, margin, yPosition)
            yPosition += lineHeight + 2
          })
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(11)
        } else {
          // Format as regular text
          const lines = doc.splitTextToSize(paragraph.trim(), maxWidth)
          lines.forEach((line: string) => {
            if (yPosition + lineHeight > pageHeight - margin) {
              doc.addPage()
              yPosition = margin
            }
            doc.text(line, margin, yPosition)
            yPosition += lineHeight
          })
        }

        // Add spacing between paragraphs
        yPosition += paragraphSpacing
      })

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `generated-script-${timestamp}.pdf`

      // Save the PDF
      doc.save(filename)

      toast({
        title: "PDF Exported",
        description: "Script has been exported as PDF successfully.",
      })
    } catch (error) {
      console.error('Failed to export PDF:', error)
      toast({
        title: "Export Failed",
        description: "Failed to export script to PDF. Please try again.",
        variant: "destructive",
      })
    }
  }

  const generateWithAI = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt first",
        variant: "destructive",
      })
      return
    }

    const scriptsSetting = aiSettings.scripts
    if (!scriptsSetting || !scriptsSetting.is_locked) {
      toast({
        title: "AI Not Available",
        description: "Please lock a script model in AI Settings first",
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

    setIsLoadingAI(true)
    setAiResponse("")
    setAiResponseRaw("")
    
    try {
      // Get the actual model to use - prefer selected_model, fallback to mapping locked_model
      let modelToUse = scriptsSetting.selected_model
      
      // If no selected_model, map locked_model to default models
      if (!modelToUse) {
        if (scriptsSetting.locked_model === 'ChatGPT' || scriptsSetting.locked_model === 'GPT-4') {
          modelToUse = 'gpt-4o-mini' // Default OpenAI model
        } else if (scriptsSetting.locked_model === 'Claude') {
          // Claude uses Anthropic service, not OpenAI - this would need different handling
          toast({
            title: "Unsupported Model",
            description: "Claude is not yet supported for script generation on this page. Please use ChatGPT or GPT-4.",
            variant: "destructive",
          })
          setIsLoadingAI(false)
          return
        } else {
          modelToUse = 'gpt-4o-mini' // Fallback default
        }
      }
      
      // Validate that we have a valid OpenAI model
      if (!modelToUse || (!modelToUse.startsWith('gpt-') && !modelToUse.startsWith('o1-'))) {
        toast({
          title: "Invalid Model",
          description: `Invalid model configuration: ${modelToUse}. Please check your AI settings.`,
          variant: "destructive",
        })
        setIsLoadingAI(false)
        return
      }
      
      const response = await OpenAIService.generateScript({
        prompt: prompt,
        template: "Generate a creative movie script outline or scene based on the user's idea. Focus on storytelling, character development, and cinematic elements. Do not use markdown formatting like **, *, ---, or ###. Use plain text with clear headings and paragraphs.",
        model: modelToUse,
        apiKey: userApiKeys.openai_api_key || ""
      })

      if (response.success && response.data) {
        const content = response.data.choices?.[0]?.message?.content || "No response generated"
        // Store raw response for genre extraction (before cleaning)
        setAiResponseRaw(content)
        // Clean the content when storing it
        const cleanedContent = cleanMarkdown(content)
        setAiResponse(cleanedContent)
        
        // Auto-extract and set title from generated content
        const extractedTitle = extractTitle(content)
        if (extractedTitle) {
          setTitle(extractedTitle)
        }
        
        toast({
          title: "Success",
          description: "AI script generated successfully",
        })
      } else {
        throw new Error(response.error || "Failed to generate script")
      }
    } catch (error) {
      console.error('Error generating script:', error)
      toast({
        title: "Error",
        description: "Failed to generate script with AI",
        variant: "destructive",
      })
    } finally {
      setIsLoadingAI(false)
    }
  }

  const generateImage = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt first",
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

    setIsLoadingAI(true)
    setGeneratedImage("")
    
    try {
      const response = await OpenAIService.generateImage({
        prompt: prompt,
        style: "cinematic, movie poster",
        model: imagesSetting.locked_model,
        apiKey: userApiKeys.openai_api_key || ""
      })

      if (response.success && response.data) {
        const imageUrl = response.data.data?.[0]?.url || ""
        
        // Save the image to the bucket instead of storing temporary URL
        setIsSavingImage(true)
        const saveResponse = await fetch('/api/ai/download-and-store-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: imageUrl,
            fileName: `ai_prompt_studio_${prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
            userId: userId
          })
        })

        if (!saveResponse.ok) {
          throw new Error('Failed to save image to bucket')
        }

        const saveResult = await saveResponse.json()
        
        if (saveResult.success) {
          // Store the permanent bucket URL instead of temporary DALL-E URL
          const bucketUrl = saveResult.supabaseUrl
          setGeneratedImage(bucketUrl)
          toast({
            title: "Success",
            description: "AI image generated and saved to your bucket!",
          })
        } else {
          throw new Error(saveResult.error || 'Failed to save image')
        }
      } else {
        throw new Error(response.error || "Failed to generate image")
      }
    } catch (error) {
      console.error('Error generating image:', error)
      toast({
        title: "Error",
        description: "Failed to generate image with AI",
        variant: "destructive",
      })
    } finally {
      setIsLoadingAI(false)
      setIsSavingImage(false)
    }
  }

  const generateImageForIdea = async (idea: MovieIdea) => {
    if (!imagePrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter an image prompt first",
        variant: "destructive",
      })
      return
    }

    // Validate prompt length to avoid API errors
    if (imagePrompt.length > 200) {
      toast({
        title: "Prompt Too Long",
        description: "Please keep your prompt under 200 characters for better results",
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

    setIsGeneratingImage(true)
    
    try {
      // Create a concise prompt to avoid exceeding DALL-E 3's 1000 character limit
      const basePrompt = imagePrompt.trim()
      const ideaContext = idea.title.length > 50 ? idea.title.substring(0, 50) + '...' : idea.title
      const enhancedPrompt = `${basePrompt}. Movie concept: ${ideaContext}. Cinematic style, movie poster quality.`
      
      console.log('Enhanced prompt length:', enhancedPrompt.length)
      console.log('Enhanced prompt:', enhancedPrompt)
      
      const response = await OpenAIService.generateImage({
        prompt: enhancedPrompt,
        style: "cinematic, movie poster, high quality",
        model: imagesSetting.locked_model,
        apiKey: userApiKeys.openai_api_key
      })

      if (response.success && response.data) {
        const imageUrl = response.data.data?.[0]?.url || ""
        
        // Save the image to the bucket instead of storing temporary URL
        const saveResponse = await fetch('/api/ai/download-and-store-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: imageUrl,
            fileName: `${idea.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${imagePrompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
            userId: user!.id
          })
        })

        if (!saveResponse.ok) {
          throw new Error('Failed to save image to bucket')
        }

        const saveResult = await saveResponse.json()
        
        if (saveResult.success) {
          // Store the permanent bucket URL instead of temporary DALL-E URL
          const bucketUrl = saveResult.supabaseUrl
          
          try {
            // Save the image record to the database
            await IdeaImagesService.saveIdeaImage(user!.id, {
              idea_id: idea.id,
              image_url: bucketUrl,
              prompt: imagePrompt,
              bucket_path: saveResult.filePath
            })
            
            // Add the new image to the idea's image collection
            setIdeaImages(prev => ({
              ...prev,
              [idea.id]: [...(prev[idea.id] || []), bucketUrl]
            }))
            
            // Set the dialog generated image for Save button
            setDialogGeneratedImage(bucketUrl)
            
            toast({
              title: "Success",
              description: "Image generated and saved to your bucket!",
            })
            
            // Clear the prompt for next use
            setImagePrompt("")
          } catch (dbError) {
            console.error('Error saving image record to database:', dbError)
            // Still show success since image is in bucket
            toast({
              title: "Partial Success",
              description: "Image saved to bucket but database record failed",
              variant: "destructive",
            })
          }
        } else {
          throw new Error(saveResult.error || 'Failed to save image')
        }
      } else {
        throw new Error(response.error || "Failed to generate image")
      }
    } catch (error) {
      console.error('Error generating image for idea:', error)
      toast({
        title: "Error",
        description: "Failed to generate image for this idea",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const openImageGeneration = (idea: MovieIdea) => {
    console.log('Opening image generation for idea:', idea.title)
    setSelectedIdeaForImage(idea)
    setImagePrompt("")
    setShowImageDialog(true)
    // Make sure we're not opening the edit dialog
    setShowAddDialog(false)
    setEditingIdea(null)
  }

  const closeImageGeneration = () => {
    setSelectedIdeaForImage(null)
    setImagePrompt("")
    setShowImageDialog(false)
    setDialogGeneratedImage(null)
  }

  // Quick cover generation function
  const generateQuickCover = async (idea: MovieIdea) => {
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

    setGeneratingCoverForIdea(idea.id)
    
    try {
      // Build prompt from idea context - avoid including full script content
      const genres = (idea.genres && idea.genres.length > 0 ? idea.genres : (idea.genre ? [idea.genre] : [])).join(", ")
      
      // Use description, but clean it and limit it to avoid including full script
      let description = ""
      if (idea.description && idea.description.trim()) {
        // Clean the description - remove markdown and script structure
        description = idea.description
          .replace(/\*\*/g, '') // Remove markdown
          .replace(/\*/g, '')
          .replace(/__/g, '')
          .replace(/`/g, '')
          .replace(/\n/g, ' ') // Remove newlines
          .replace(/\s+/g, ' ') // Remove extra spaces
          .replace(/Act \d+:|Scene \d+:|Chapter \d+:/gi, '') // Remove script structure markers
          .replace(/Title:|Genre:|Logline:/gi, '') // Remove metadata labels
          .trim()
        
        // Use first sentence or first 150 chars (avoid full script)
        const firstSentence = description.split(/[.!?]/)[0]
        description = (firstSentence && firstSentence.length > 0 && firstSentence.length < 150) 
          ? firstSentence 
          : description.substring(0, 150)
        description = description.trim()
      }
      
      // Create a cinematic movie poster prompt
      let coverPrompt = `Movie poster for "${idea.title}"`
      if (genres) {
        coverPrompt += `, ${genres} genre`
      }
      if (description) {
        coverPrompt += `. ${description}`
      }
      coverPrompt += `. Cinematic style, professional movie poster, high quality, dramatic lighting`

      // Limit prompt length to avoid API errors (DALL-E 3 has 1000 character limit)
      if (coverPrompt.length > 900) {
        coverPrompt = coverPrompt.substring(0, 900) + "..."
      }

      console.log('Generating quick cover with prompt:', coverPrompt)
      
      // Normalize model name (handle "DALL-E 3" -> "dall-e-3")
      let modelName = "dall-e-3"
      if (imagesSetting.locked_model) {
        const lockedModel = imagesSetting.locked_model.toLowerCase()
        if (lockedModel.includes('dall') || lockedModel.includes('dalle')) {
          modelName = "dall-e-3"
        }
      }
      
      const response = await OpenAIService.generateImage({
        prompt: coverPrompt,
        style: "cinematic, movie poster, professional",
        model: modelName,
        apiKey: userApiKeys.openai_api_key
      })

      if (response.success && response.data) {
        const imageUrl = response.data.data?.[0]?.url || ""
        
        // Save the image to the bucket
        const saveResponse = await fetch('/api/ai/download-and-store-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: imageUrl,
            fileName: `idea_cover_${idea.id}_${Date.now()}`,
            userId: userId
          })
        })

        if (!saveResponse.ok) {
          throw new Error('Failed to save image to bucket')
        }

        const saveResult = await saveResponse.json()
        
        if (saveResult.success) {
          const bucketUrl = saveResult.supabaseUrl
          
          // Save the image to the idea
          await IdeaImagesService.saveIdeaImage(userId, {
            idea_id: idea.id,
            image_url: bucketUrl,
            prompt: coverPrompt,
            bucket_path: saveResult.filePath || ''
          })
          
          // Refresh idea images
          await loadSavedImages()
          
          toast({
            title: "Success!",
            description: `Cover image generated for "${idea.title}"`,
          })
        } else {
          throw new Error(saveResult.error || 'Failed to save image')
        }
      } else {
        throw new Error(response.error || "Failed to generate image")
      }
    } catch (error) {
      console.error('Error generating quick cover:', error)
      let errorMessage = 'Failed to generate cover image'
      
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
      setGeneratingCoverForIdea(null)
    }
  }

  const handleImport = async () => {
    if (!ready) {
      toast({
        title: "Error",
        description: "User not logged in. Please log in to import content.",
        variant: "destructive",
      })
      return
    }

    setIsImporting(true)

    try {
      if (importType === 'image') {
        if (!importImageUrl.trim() || !importImagePrompt.trim()) {
          toast({
            title: "Error",
            description: "Image URL and prompt are required for image import.",
            variant: "destructive",
          })
          return
        }

        const response = await fetch('/api/import/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: importImageUrl,
            prompt: importImagePrompt,
            ideaId: importImageIdeaId,
            userId: user!.id
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to import image')
        }

        const data = await response.json()
        toast({
          title: "Success",
          description: `Image imported successfully! Idea: ${data.ideaTitle || 'N/A'}`,
        })
        fetchIdeas()
        loadSavedImages()
        setShowImportDialog(false)
        resetImportForm() // Reset import form
      } else if (importType === 'script') {
        if (!importScriptTitle.trim() || !importScriptContent.trim()) {
          toast({
            title: "Error",
            description: "Script title and content are required for script import.",
            variant: "destructive",
          })
          return
        }

        const response = await fetch('/api/import/script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: importScriptTitle,
            content: importScriptContent,
            genre: importScriptGenre, // Legacy field for backward compatibility
            genres: importScriptGenre ? [importScriptGenre] : [], // New genres array
            userId: user!.id
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to import script')
        }

        const data = await response.json()
        toast({
          title: "Success",
          description: `Script imported successfully! Idea: ${data.ideaTitle || 'N/A'}`,
        })
        fetchIdeas()
        loadSavedImages()
        setShowImportDialog(false)
        resetImportForm() // Reset import form
      } else if (importType === 'idea') {
        if (!importIdeaTitle.trim() || !importIdeaDescription.trim() || !importIdeaMainCreator.trim()) {
          toast({
            title: "Error",
            description: "Idea title, description, and main creator are required for idea import.",
            variant: "destructive",
          })
          return
        }

        const importData = {
          title: importIdeaTitle,
          description: importIdeaDescription,
          genre: importIdeaGenre, // Legacy field for backward compatibility
          genres: importIdeaGenre ? [importIdeaGenre] : [], // New genres array
          main_creator: importIdeaMainCreator.trim() || "Unknown",
          co_creators: importIdeaCoCreators,
          status: importIdeaStatus,
          userId: user!.id
        }
        
        console.log('🎬 DEBUG - Importing idea with data:', importData)
        console.log('🎬 DEBUG - importIdeaMainCreator raw value:', importIdeaMainCreator)
        console.log('🎬 DEBUG - importIdeaMainCreator trimmed:', importIdeaMainCreator.trim())
        console.log('🎬 DEBUG - Final main_creator value:', importData.main_creator)
        
        const response = await fetch('/api/import/idea', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(importData)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to import idea')
        }

        const data = await response.json()
        toast({
          title: "Success",
          description: `Idea imported successfully! Idea: ${data.ideaTitle || 'N/A'}`,
        })
        fetchIdeas()
        loadSavedImages()
        setShowImportDialog(false)
        resetImportForm() // Reset import form
      }
    } catch (error) {
      console.error('Error importing content:', error)
      toast({
        title: "Error",
        description: `Failed to import content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         idea.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (idea.original_prompt && idea.original_prompt.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (idea.prompt && idea.prompt.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         idea.main_creator.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (idea.co_creators && idea.co_creators.some(creator => creator.toLowerCase().includes(searchTerm.toLowerCase())))
    // Support both old genre field and new genres array for filtering
    const matchesGenre = filterGenre === "all" || 
      idea.genre === filterGenre || 
      (idea.genres && idea.genres.includes(filterGenre))
    const matchesStatus = filterStatus === "all" || idea.status === filterStatus
    
    return matchesSearch && matchesGenre && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concept": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "development": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  if (!ready) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to access your movie ideas</h1>
        </div>
      </div>
    )
  }

  return (
    <>
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-yellow-500" />
            Movie Ideas
          </h1>
          <p className="text-muted-foreground mt-2">
            Capture your creative sparks and develop them into full concepts
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Idea
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>
                  {editingIdea ? "Edit Movie Idea" : "Add New Movie Idea"}
                </DialogTitle>
                <DialogDescription>
                  {editingIdea ? "Update your movie idea details" : "Capture your creative vision"}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter movie title"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="genres">Genres</Label>
                    </div>
                    {selectedGenres.length > 0 && (
                      <div className="flex flex-wrap gap-2 py-2">
                        {selectedGenres.map((g) => (
                          <Badge 
                            key={g} 
                            variant="secondary" 
                            className="flex items-center gap-1"
                          >
                            {g}
                            <button
                              type="button"
                              onClick={() => {
                                const next = selectedGenres.filter(genre => genre !== g)
                                setSelectedGenres(next)
                                if (selectedGenres[0] === g) setGenre(next[0] || "")
                              }}
                              className="ml-1 hover:text-destructive focus:outline-none"
                              aria-label={`Remove ${g}`}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8">
                          Select Genres
                          <ChevronDown className="h-3 w-3 ml-2" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3">
                        <div className="max-h-56 overflow-y-auto">
                          <div className="grid grid-cols-1 gap-2">
                            {genres.map((g) => {
                              const isSelected = selectedGenres.includes(g)
                              return (
                                <div key={g} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`genre-${g}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        const next = [...selectedGenres, g]
                                        setSelectedGenres(next)
                                        if (selectedGenres.length === 0) setGenre(g)
                                      } else {
                                        const next = selectedGenres.filter(item => item !== g)
                                        setSelectedGenres(next)
                                        if (selectedGenres[0] === g) setGenre(next[0] || "")
                                      }
                                    }}
                                  />
                                  <label htmlFor={`genre-${g}`} className="text-sm leading-none">
                                    {g}
                                  </label>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="main-creator">Main Creator *</Label>
                    <Input
                      id="main-creator"
                      value={mainCreator}
                      onChange={(e) => setMainCreator(e.target.value)}
                      placeholder="Primary creator's name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="co-creators">Co-Creators</Label>
                    <Input
                      id="co-creators"
                      value={coCreators.join(', ')}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value.trim() === '') {
                          setCoCreators([])
                        } else {
                          setCoCreators(value.split(',').map(s => s.trim()).filter(s => s !== ''))
                        }
                      }}
                      placeholder="Co-creators (comma separated)"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Separate multiple names with commas
                    </p>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of your movie idea"
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label htmlFor="synopsis">Synopsis</Label>
                  <Textarea
                    id="synopsis"
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    placeholder="Brief synopsis (2-3 paragraphs) - used when converting to a treatment."
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    A brief synopsis (2-3 paragraphs) that will be used when converting this idea to a treatment.
                  </p>
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const text = (prompt.trim() || description.trim())
                        if (!text) {
                          toast({
                            title: "No Content",
                            description: "Add a description or AI content first to generate a synopsis.",
                            variant: "destructive",
                          })
                          return
                        }
                        const s = await generateSynopsis()
                        if (s) setSynopsis(s)
                      }}
                      disabled={isGeneratingSynopsis}
                      className="h-8"
                    >
                      {isGeneratingSynopsis ? "Generating..." : "Generate Synopsis with AI"}
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="original-prompt" className="mr-2">Original Prompt/Idea</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="h-8">
                        View
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[520px] p-3">
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Read-only original idea</p>
                        <Textarea
                          value={originalPrompt}
                          readOnly
                          rows={8}
                          className="font-mono text-xs"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div>
                  <Label htmlFor="prompt">AI Generated Content</Label>
                  <Textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="AI-generated content, development notes, or additional prompts..."
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    AI-generated content, development notes, or additional prompts to develop this idea
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concept">Concept</SelectItem>
                      <SelectItem value="development">In Development</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter className="flex-shrink-0">
                <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isGeneratingSynopsis}>
                  Cancel
                </Button>
                <Button onClick={saveIdea} className="flex items-center gap-2" disabled={isGeneratingSynopsis}>
                  {isGeneratingSynopsis ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Synopsis...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {editingIdea ? "Update" : "Save"} Idea
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button 
            variant="outline" 
            onClick={() => setShowImportDialog(true)}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai-prompt" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Prompt Studio
          </TabsTrigger>
          <TabsTrigger value="library" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Idea Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-6">
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search ideas by title, description, prompt, or creators..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Select value={filterGenre} onValueChange={setFilterGenre}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Genre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genres</SelectItem>
                    {genres.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="concept">Concept</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ideas Grid */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading your ideas...</p>
              </div>
            ) : filteredIdeas.length === 0 ? (
              <div className="text-center py-12">
                <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No ideas yet</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || filterGenre !== "all" || filterStatus !== "all" 
                    ? "No ideas match your current filters" 
                    : "Start capturing your creative ideas"}
                </p>
                {!searchTerm && filterGenre === "all" && filterStatus === "all" && (
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Idea
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredIdeas.map((idea) => (
                  <Card key={idea.id} className="hover:shadow-lg transition-shadow overflow-hidden flex flex-col h-full">
                    <CardHeader className="pb-3 pt-4 px-4">
                      {/* Title Section - Full Width */}
                      <div className="mb-3">
                        <CardTitle className="text-lg line-clamp-2 break-words mb-3">{idea.title}</CardTitle>
                      </div>
                      
                      {/* Badges Section */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Display all genres (support both genres array and legacy genre field) */}
                          {(idea.genres && idea.genres.length > 0 ? idea.genres : (idea.genre ? [idea.genre] : [])).map((g, index) => (
                            <Badge key={index} variant="secondary" className="text-xs flex-shrink-0">
                              {g}
                            </Badge>
                          ))}
                          <Badge className={`text-xs flex-shrink-0 ${getStatusColor(idea.status)}`}>
                            {idea.status}
                          </Badge>
                          {idea.main_creator && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              👤 {idea.main_creator}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons Section */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            regenerateIdeaSynopsis(idea)
                          }}
                          disabled={generatingSynopsisForIdea === idea.id}
                          className="h-7 px-2 text-xs flex-shrink-0"
                          title="Generate/Regenerate Synopsis with AI"
                        >
                          {generatingSynopsisForIdea === idea.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Wand2 className="h-3 w-3 mr-1" />
                          )}
                          Synopsis
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            generateQuickCover(idea)
                          }}
                          disabled={generatingCoverForIdea === idea.id}
                          className="h-7 px-2 text-xs flex-shrink-0"
                          title="Generate Cover Image"
                        >
                          {generatingCoverForIdea === idea.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Wand2 className="h-3 w-3 mr-1" />
                          )}
                          Cover
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            console.log('Image button clicked for:', idea.title)
                            openImageGeneration(idea)
                          }}
                          className="h-7 px-2 text-xs flex-shrink-0"
                          title="Generate Custom Images"
                        >
                          <ImageIcon className="h-3 w-3 mr-1" />
                          Image
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTreatmentDialog(idea)}
                          className="h-7 px-2 text-xs flex-shrink-0"
                          title="Convert to Treatment"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Treatment
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => convertIdeaToMovie(idea)}
                          className="h-7 px-2 text-xs flex-shrink-0"
                          title="Convert to Movie"
                        >
                          <Film className="h-3 w-3 mr-1" />
                          Movie
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/ideas/${idea.id}/scenes`)}
                          className="h-7 px-2 text-xs flex-shrink-0"
                          title="Manage Scene List"
                        >
                          <List className="h-3 w-3 mr-1" />
                          Scenes
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editIdea(idea)}
                          className="h-7 w-7 p-0 flex-shrink-0"
                          title="Edit Idea"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteIdea(idea.id)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive flex-shrink-0"
                          title="Delete Idea"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      {/* Synopsis snippet */}
                      {idea.synopsis && idea.synopsis.trim() && (
                        <div className="mb-3">
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {idea.synopsis}
                          </p>
                        </div>
                      )}
                      {/* Prominent Image Display */}
                      {ideaImages[idea.id] && ideaImages[idea.id].filter(url => url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)).length > 0 && (
                        <div className="mb-4">
                          <div className="grid grid-cols-2 gap-3">
                            {ideaImages[idea.id]
                              .filter(imageUrl => imageUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))
                              .slice(0, 4) // Show max 4 images
                              .map((imageUrl, index) => (
                                <div key={index} className="aspect-square overflow-hidden rounded-lg">
                                  <img 
                                    src={imageUrl} 
                                    alt={`Generated image ${index + 1}`}
                                    className="h-full w-full object-cover hover:scale-105 transition-transform cursor-pointer"
                                    onClick={() => window.open(imageUrl, '_blank')}
                                    title="Click to view full size"
                                  />
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Content Tabs */}
                      <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="details">Details</TabsTrigger>
                          <TabsTrigger value="content">Content</TabsTrigger>
                          <TabsTrigger value="files">Files</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="details" className="space-y-3">
                          <CardDescription className="line-clamp-3">
                            {idea.description}
                          </CardDescription>
                          
                          {/* Creator Information */}
                          <div className="space-y-2">
                            {idea.main_creator && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-muted-foreground">Main Creator:</span>
                                <span>{idea.main_creator}</span>
                              </div>
                            )}
                            {idea.co_creators && idea.co_creators.length > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-muted-foreground">Co-Creators:</span>
                                <span>{idea.co_creators.join(', ')}</span>
                              </div>
                            )}
                          </div>
                          
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(idea.created_at).toLocaleDateString()}
                          </p>
                        </TabsContent>
                        
                        <TabsContent value="content" className="space-y-3">
                          {idea.original_prompt && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                              <p className="text-sm font-medium mb-1 text-blue-800 dark:text-blue-200">Original Idea:</p>
                              <p className="text-sm text-blue-700 dark:text-blue-300 line-clamp-2">
                                {idea.original_prompt}
                              </p>
                            </div>
                          )}
                          {idea.prompt && (
                            <div className="p-3 bg-muted rounded-md">
                              <p className="text-sm font-medium mb-1">AI Generated Content:</p>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {idea.prompt}
                              </p>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="files" className="space-y-3">
                          {/* Imported Files */}
                          {ideaImages[idea.id] && ideaImages[idea.id].filter(url => !url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)).length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">Imported Files:</p>
                              <div className="flex gap-2 overflow-x-auto pb-2">
                                {ideaImages[idea.id]
                                  .filter(fileUrl => !fileUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))
                                  .map((fileUrl, index) => {
                                    const fileExtension = fileUrl.split('.').pop()?.toUpperCase() || 'FILE';
                                    
                                    return (
                                      <div key={index} className="flex-shrink-0">
                                        <a 
                                          href={fileUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="block h-20 w-20 bg-gray-800 border border-gray-600 rounded-md flex flex-col items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
                                          title="Click to download/view file"
                                        >
                                          <FileText className="h-6 w-6 text-blue-400" />
                                          <span className="text-xs text-gray-300 mt-1">{fileExtension}</span>
                                        </a>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                          
                          {(!ideaImages[idea.id] || ideaImages[idea.id].filter(url => !url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)).length === 0) && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No imported files yet
                            </p>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ai-prompt" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Prompt Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  AI Prompt Studio
                </CardTitle>
                <CardDescription>
                  Generate creative content to develop your movie ideas further
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="ai-prompt-input">Describe your idea or ask for help</Label>
                  <Textarea
                    id="ai-prompt-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., 'I have an idea about a time-traveling detective in 1920s Paris. Help me develop the plot and characters.'"
                    rows={6}
                    className="font-mono"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={generateWithAI} 
                    disabled={isLoadingAI || !prompt.trim()}
                    className="flex items-center gap-2"
                  >
                    {isLoadingAI ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Generate Script
                  </Button>
                  <Button 
                    onClick={generateImage} 
                    disabled={isLoadingAI || isSavingImage || !prompt.trim()}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {isLoadingAI ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    ) : isSavingImage ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isLoadingAI ? "Generating..." : isSavingImage ? "Saving..." : "Generate Image"}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      // Pre-fill the form with current prompt and generated content
                      if (aiResponse) {
                        // Extract title from generated content (use raw response for better extraction)
                        const extractedTitle = extractTitle(aiResponseRaw || aiResponse)
                        setTitle(extractedTitle || "Generated Script Idea")
                        // Store first 500 characters as description (increased from 200 to preserve more content)
                        // The full content is stored in prompt field
                        setDescription(aiResponse.substring(0, 500) + (aiResponse.length > 500 ? "..." : ""))
                        setOriginalPrompt(prompt) // Save your original prompt
                        setPrompt(aiResponse) // Save AI-generated content
                        // Extract genre from the generated script
                        // Try raw response first (has markdown), then cleaned response
                        // Extract genres (array) from the generated script
                        const extractedGenres = extractGenres(aiResponseRaw || aiResponse)
                        setSelectedGenres(extractedGenres)
                        setGenre(extractedGenres.length > 0 ? extractedGenres[0] : "") // Set legacy genre for backward compatibility
                      } else if (generatedImage) {
                        setTitle("Generated Image Idea")
                        setDescription("AI-generated image concept: " + prompt)
                        setOriginalPrompt(prompt) // Save your original prompt
                        setPrompt("AI-generated image: " + prompt) // Save AI image reference
                        setGenre("") // No genre for images
                      } else {
                        setTitle("")
                        setDescription("")
                        setOriginalPrompt(prompt) // Save your original prompt
                        setPrompt("") // No AI content yet
                        setGenre("") // No genre detected
                      }
                      setMainCreator(userName || user?.name || user?.email?.split('@')[0] || "") // Auto-populate with user's name
                      setStatus("concept")
                      setShowAddDialog(true)
                    }} 
                    disabled={!prompt.trim() && !aiResponse && !generatedImage}
                    variant="outline"
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save as New Idea
                  </Button>
                </div>
                
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    <strong>Tip:</strong> Be specific about what you want to develop - characters, plot points, 
                    world-building, or specific scenes. The more detailed your prompt, the better the AI can help!
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* AI Response Display */}
            <div className="space-y-6">
              {/* Script Response */}
              {aiResponse && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-green-500" />
                        Generated Script
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(aiResponse)}
                          className="flex items-center gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => exportToPDF(aiResponse)}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Export PDF
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted p-4 rounded-md max-h-[600px] overflow-y-auto">
                      <Textarea
                        id="ai-response-editor"
                        value={aiResponse}
                        onChange={(e) => setAiResponse(e.target.value)}
                        rows={16}
                        className="font-mono text-sm min-h-[320px]"
                        placeholder="Your generated script will appear here. You can edit it freely before saving."
                      />
                    </div>
                    <div className="flex gap-2 mt-4 flex-wrap">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setPrompt(aiResponse)}
                      >
                        Use as Prompt
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={async () => {
                          // Extract title from generated content (use raw response for better extraction)
                          const extractedTitle = extractTitle(aiResponseRaw || aiResponse)
                          setTitle(extractedTitle || "Generated Script Idea")
                          // Store first 500 characters as description (increased from 200 to preserve more content)
                          // The full content is stored in prompt field
                          setDescription(aiResponse.substring(0, 500) + (aiResponse.length > 500 ? "..." : ""))
                          setOriginalPrompt(prompt) // Save your original prompt
                          setPrompt(aiResponse) // Save AI-generated content
                          // Extract genres (array) from the generated script
                          // Try raw response first (has markdown), then cleaned response
                          const extractedGenres = extractGenres(aiResponseRaw || aiResponse)
                          setSelectedGenres(extractedGenres)
                          setGenre(extractedGenres.length > 0 ? extractedGenres[0] : "") // Set legacy genre for backward compatibility
                          setMainCreator(userName || user?.name || user?.email?.split('@')[0] || "") // Auto-populate with user's name
                          setStatus("concept")
                          setShowAddDialog(true)
                        }}
                        className="flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Save as Idea
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setAiResponse("")
                          setAiResponseRaw("")
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Image Response */}
              {generatedImage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-blue-500" />
                      Generated Image
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <img 
                        src={generatedImage} 
                        alt="AI Generated" 
                        className="w-full rounded-md shadow-lg"
                      />
                      <div className="flex flex-col gap-3">
                        {/* Primary Save Button - Make it prominent */}
                        <Button 
                          variant="default" 
                          size="lg"
                          onClick={async () => {
                            try {
                              // First save the idea
                              const newIdeaData = {
                                title: "Generated Image Idea",
                                description: "AI-generated image concept: " + prompt,
                                original_prompt: prompt,
                                prompt: "AI-generated image: " + prompt,
                                genres: [],
                                status: "concept" as const,
                                main_creator: user?.id || "unknown"
                              }
                              
                              if (user) {
                                const savedIdea = await MovieIdeasService.createIdea(user.id, newIdeaData)
                                
                                // Now save the image to this new idea
                                if (savedIdea && generatedImage) {
                                  await IdeaImagesService.saveIdeaImage(user.id, {
                                    idea_id: savedIdea.id,
                                    image_url: generatedImage,
                                    prompt: prompt,
                                    bucket_path: ''
                                  })
                                  
                                  // Refresh the ideas and images
                                  await fetchIdeas()
                                  await loadSavedImages()
                                  
                                  toast({
                                    title: "Success",
                                    description: "New idea created with image saved!",
                                  })
                                }
                              }
                              
                              // Reset the form
                              setTitle("")
                              setDescription("")
                              setOriginalPrompt("")
                              setPrompt("")
                              setGenre("")
                              setStatus("concept")
                              setGeneratedImage("")
                              setShowAddDialog(false)
                            } catch (error) {
                              console.error('Error saving idea with image:', error)
                              toast({
                                title: "Error",
                                description: "Failed to save idea with image",
                                variant: "destructive",
                              })
                            }
                          }}
                          className="flex items-center gap-2 w-full bg-green-600 hover:bg-green-700"
                        >
                          <Save className="h-5 w-5" />
                          Quick Save
                        </Button>
                        
                        {/* Save Details Button */}
                        <Button 
                          variant="outline" 
                          size="lg"
                          onClick={() => {
                            // Store the image data for the form to access
                            if (generatedImage) {
                              setPendingImageData({
                                imageUrl: generatedImage,
                                prompt: prompt,
                                bucketPath: ''
                              })
                            }
                            
                            // Just open the form with pre-filled data - NO automatic saving
                            setTitle("Generated Image Idea")
                            setDescription("AI-generated image concept: " + prompt)
                            setOriginalPrompt(prompt)
                            setPrompt("AI-generated image: " + prompt)
                            // Set genres from idea (support both genres array and legacy genre field)
                            if (selectedIdeaForImage?.genres && selectedIdeaForImage.genres.length > 0) {
                              setSelectedGenres(selectedIdeaForImage.genres)
                              setGenre(selectedIdeaForImage.genres[0])
                            } else {
                              setGenre(selectedIdeaForImage?.genre || "")
                              setSelectedGenres(selectedIdeaForImage?.genre ? [selectedIdeaForImage.genre] : [])
                            }
                            setStatus(selectedIdeaForImage?.status || "concept")
                            setShowAddDialog(true)
                            setShowImageDialog(false)
                          }}
                          className="flex items-center gap-2 w-full"
                        >
                          <Edit className="h-5 w-5" />
                          Save Details
                        </Button>
                        
                        {/* Secondary Actions */}
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(generatedImage, '_blank')}
                            className="flex-1"
                          >
                            View Full Size
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setGeneratedImage("")}
                            className="flex-1"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Status */}
              {!aiResponse && !generatedImage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      AI Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Script Generation:</span>
                        <Badge variant={aiSettings.scripts?.is_locked ? "default" : "secondary"}>
                          {aiSettings.scripts?.is_locked ? "Available" : "Not Available"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Image Generation:</span>
                        <Badge variant={aiSettings.images?.is_locked ? "default" : "secondary"}>
                          {aiSettings.images?.is_locked ? "Available" : "Not Available"}
                        </Badge>
                      </div>
                      {(!aiSettings.scripts?.is_locked || !aiSettings.images?.is_locked) && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Setup Required:</strong> Lock AI models in Settings → AI Settings to enable generation.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Image Generation Dialog */}
      <Dialog 
        open={showImageDialog} 
        onOpenChange={(open) => {
          console.log('Image dialog open change:', open)
          if (!open) closeImageGeneration()
        }}
        modal={true}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" id="image-generation-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="h-5 w-5 text-blue-500" />
              Generate Images for: {selectedIdeaForImage?.title}
            </DialogTitle>
            <DialogDescription>
              Create cinematic images for your movie idea using AI
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="image-prompt" className="text-sm font-medium">Image Prompt</Label>
              <Textarea
                id="image-prompt"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                rows={2}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Be specific about the scene, characters, mood, and style you want
              </p>
            </div>

            {/* Compact Idea Context */}
            <div className="p-3 bg-muted rounded-md">
              <h4 className="font-medium mb-2 text-sm">Quick Reference:</h4>
              <div className="space-y-1 text-xs">
                <p><strong>Title:</strong> {selectedIdeaForImage?.title}</p>
                <p><strong>Genre:</strong> {(selectedIdeaForImage?.genres && selectedIdeaForImage.genres.length > 0) 
                  ? selectedIdeaForImage.genres.join(", ") 
                  : (selectedIdeaForImage?.genre || "Unspecified")}</p>
                <p><strong>Description:</strong> {selectedIdeaForImage?.description.substring(0, 80)}...</p>
              </div>
            </div>

            {/* Existing Images - More compact */}
            {ideaImages[selectedIdeaForImage?.id || ''] && ideaImages[selectedIdeaForImage?.id || ''].length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-sm">Existing Images:</h4>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {ideaImages[selectedIdeaForImage?.id || ''].map((imageUrl, index) => (
                    <div key={index} className="flex-shrink-0">
                      <img 
                        src={imageUrl} 
                        alt={`Generated image ${index + 1}`}
                        className="h-20 w-20 object-cover rounded-md shadow-md hover:scale-105 transition-transform cursor-pointer"
                        onClick={() => window.open(imageUrl, '_blank')}
                        title="Click to view full size"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Newly Generated Image - More compact */}
            {dialogGeneratedImage && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <h4 className="font-medium mb-2 text-sm text-green-800 dark:text-green-200">✨ Newly Generated Image:</h4>
                <div className="space-y-2">
                  <img 
                    src={dialogGeneratedImage} 
                    alt="Newly generated image"
                    className="w-full rounded-md shadow-lg max-h-64 object-contain"
                  />
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => {
                      // Save the image to the existing idea
                      if (selectedIdeaForImage && user) {
                        IdeaImagesService.saveIdeaImage(user.id, {
                          idea_id: selectedIdeaForImage.id,
                          image_url: dialogGeneratedImage,
                          prompt: imagePrompt,
                          bucket_path: '' // We'll get this from the API response
                        }).then(() => {
                          // Refresh the images for this specific idea
                          refreshIdeaImages(selectedIdeaForImage.id)
                          
                          toast({
                            title: "Success",
                            description: "Image saved to your idea!",
                          })
                          
                          // Clear the generated image and close dialog
                          setDialogGeneratedImage(null)
                          setImagePrompt("")
                          setShowImageDialog(false)
                        }).catch((error) => {
                          console.error('Error saving image:', error)
                          toast({
                            title: "Error",
                            description: "Failed to save image to idea",
                            variant: "destructive",
                          })
                        })
                      }
                    }}
                    className="flex items-center gap-2 w-full bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4" />
                    Quick Save
                  </Button>
                  
                  {/* Save Details Button for existing ideas */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Store the image data for the form to access
                      if (dialogGeneratedImage) {
                        setPendingImageData({
                          imageUrl: dialogGeneratedImage,
                          prompt: imagePrompt,
                          bucketPath: ''
                        })
                      }
                      
                      // Just open the form with pre-filled data - NO automatic saving
                      setTitle(selectedIdeaForImage?.title || "")
                      setDescription(selectedIdeaForImage?.description || "")
                      setOriginalPrompt(imagePrompt)
                      setPrompt("AI-generated image: " + imagePrompt)
                      // Set genres from idea (support both genres array and legacy genre field)
                      if (selectedIdeaForImage?.genres && selectedIdeaForImage.genres.length > 0) {
                        setSelectedGenres(selectedIdeaForImage.genres)
                        setGenre(selectedIdeaForImage.genres[0])
                      } else {
                        setGenre(selectedIdeaForImage?.genre || "")
                        setSelectedGenres(selectedIdeaForImage?.genre ? [selectedIdeaForImage.genre] : [])
                      }
                      setStatus(selectedIdeaForImage?.status || "concept")
                      setShowAddDialog(true)
                      setShowImageDialog(false)
                    }}
                    className="flex items-center gap-2 w-full"
                  >
                    <Edit className="h-4 w-4" />
                    Save Details
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={closeImageGeneration}>
                Close
              </Button>
              <Button 
                size="sm"
                onClick={() => selectedIdeaForImage && generateImageForIdea(selectedIdeaForImage)}
                disabled={isGeneratingImage || !imagePrompt.trim()}
                className="flex items-center gap-2"
              >
                {isGeneratingImage ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {isGeneratingImage ? "Generating..." : "Generate Image"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Treatment Conversion Dialog */}
      <Dialog open={showTreatmentDialog} onOpenChange={setShowTreatmentDialog}>
        <DialogContent className="cinema-card border-border max-h-[90vh] max-w-2xl flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground">Convert Idea to Treatment</DialogTitle>
            <DialogDescription>
              Edit the fields below. You can generate a synopsis with AI before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="treatment-title">Title</Label>
                <Input
                  id="treatment-title"
                  value={treatmentTitle}
                  onChange={(e) => setTreatmentTitle(e.target.value)}
                  placeholder="Treatment title"
                />
              </div>
              <div>
                <Label htmlFor="treatment-genre">Genre</Label>
                <Input
                  id="treatment-genre"
                  value={treatmentGenre}
                  onChange={(e) => setTreatmentGenre(e.target.value)}
                  placeholder="Genre"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="treatment-logline">Logline</Label>
              <Textarea
                id="treatment-logline"
                value={treatmentLogline}
                onChange={(e) => setTreatmentLogline(e.target.value)}
                placeholder="One-sentence summary of the story"
                rows={2}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="treatment-synopsis">Synopsis</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const base = (treatmentPrompt.trim() || convertingIdeaForTreatment?.description || "")
                    if (!base) {
                      toast({
                        title: "No Content",
                        description: "Add content first (AI content or description) to generate a synopsis.",
                        variant: "destructive",
                      })
                      return
                    }
                    const s = await generateSynopsisForText(base)
                    if (s) setTreatmentSynopsis(s)
                  }}
                  disabled={isGeneratingTreatmentSynopsis}
                  className="h-8"
                >
                  {isGeneratingTreatmentSynopsis ? "Generating..." : "Generate with AI"}
                </Button>
              </div>
              <Textarea
                id="treatment-synopsis"
                value={treatmentSynopsis}
                onChange={(e) => setTreatmentSynopsis(e.target.value)}
                placeholder="2-3 paragraphs describing the story (editable)"
                rows={5}
              />
            </div>
            <div>
              <Label htmlFor="treatment-prompt">Full Content (optional)</Label>
              <Textarea
                id="treatment-prompt"
                value={treatmentPrompt}
                onChange={(e) => setTreatmentPrompt(e.target.value)}
                placeholder="Optional: paste any longer content to carry into the treatment"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowTreatmentDialog(false)} disabled={isSavingTreatment || isGeneratingTreatmentSynopsis}>
              Cancel
            </Button>
            <Button onClick={saveTreatmentFromDialog} className="flex items-center gap-2" disabled={isSavingTreatment || isGeneratingTreatmentSynopsis}>
              {isSavingTreatment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Treatment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-500" />
              Import Content
            </DialogTitle>
            <DialogDescription>
              Import images, scripts, or ideas from external sources into your idea library
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Drag and Drop Zone - Always Visible */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Drag & Drop Files</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragOver 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {droppedFiles.length === 0 ? (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Drag and drop files here, or{' '}
                      <label className="text-blue-500 hover:text-blue-600 cursor-pointer">
                        browse
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileSelect}
                          accept="image/*,.txt,.md,.pdf,.doc,.docx"
                        />
                      </label>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Supports: Images, Text files, Scripts, PDFs, Word docs
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {droppedFiles.length} file{droppedFiles.length !== 1 ? 's' : ''} selected
                    </p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {droppedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <div className="flex items-center gap-2">
                            {getFileIcon(file)}
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-gray-500">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {importProgress[file.name] !== undefined && (
                              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${importProgress[file.name]}%` }}
                                />
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    
                    {droppedFiles.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setDroppedFiles([])}
                        className="w-full"
                      >
                        Clear All Files
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tabs for Import Options */}
            <Tabs defaultValue="import" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="import">Import Files</TabsTrigger>
                <TabsTrigger value="advanced">Advanced Options</TabsTrigger>
              </TabsList>
              
              <TabsContent value="import" className="space-y-3">
                {/* Idea Association */}
                <div>
                  <Label className="text-sm font-medium">Associate with Idea</Label>
                  <Select value={importImageIdeaId} onValueChange={setImportImageIdeaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an idea to associate with (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2">
                        <Input
                          placeholder="Search ideas..."
                          value={importIdeaSearch}
                          onChange={(e) => setImportIdeaSearch(e.target.value)}
                          className="mb-2"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {ideas
                          .filter(idea =>
                            idea.title.toLowerCase().includes(importIdeaSearch.toLowerCase()) ||
                            idea.description.toLowerCase().includes(importIdeaSearch.toLowerCase())
                          )
                          .map((idea) => (
                            <SelectItem key={idea.id} value={idea.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{idea.title}</span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {idea.description.substring(0, 50)}...
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </div>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose an existing idea to add files to, or leave empty to create a new one
                  </p>
                </div>

                {/* New Idea Details - Only show if no existing idea selected */}
                {!importImageIdeaId && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="import-idea-title" className="text-sm font-medium">
                        New Idea Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="import-idea-title"
                        placeholder="Enter a name for your new idea"
                        value={importIdeaTitle}
                        onChange={(e) => setImportIdeaTitle(e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="import-idea-description" className="text-sm font-medium">
                        Description
                      </Label>
                      <Textarea
                        id="import-idea-description"
                        placeholder="Describe your idea (optional)"
                        value={importIdeaDescription}
                        onChange={(e) => setImportIdeaDescription(e.target.value)}
                        className="mt-1"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="import-idea-genre" className="text-sm font-medium">
                          Genre
                        </Label>
                        <Select value={importIdeaGenre} onValueChange={setImportIdeaGenre}>
                          <SelectTrigger className="mt-1">
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
                            <SelectItem value="Unspecified">Unspecified</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="import-idea-status" className="text-sm font-medium">
                          Status
                        </Label>
                        <Select value={importIdeaStatus} onValueChange={(value: IdeaStatus) => setImportIdeaStatus(value)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="concept">Concept</SelectItem>
                            <SelectItem value="development">Development</SelectItem>
                            <SelectItem value="pre-production">Pre-Production</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="post-production">Post-Production</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="import-idea-main-creator" className="text-sm font-medium">
                          Main Creator <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="import-idea-main-creator"
                          placeholder="Primary creator's name"
                          value={importIdeaMainCreator}
                          onChange={(e) => setImportIdeaMainCreator(e.target.value)}
                          className="mt-1"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="import-idea-co-creators" className="text-sm font-medium">
                          Co-Creators
                        </Label>
                        <Input
                          id="import-idea-co-creators"
                          placeholder="Co-creators (comma separated)"
                          value={importIdeaCoCreators.join(', ')}
                          onChange={(e) => {
                            const value = e.target.value
                            if (value.trim() === '') {
                              setImportIdeaCoCreators([])
                            } else {
                              setImportIdeaCoCreators(value.split(',').map(s => s.trim()).filter(s => s !== ''))
                            }
                          }}
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Separate multiple names with commas
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-3">
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-lg font-medium mb-2">Advanced Import Options</p>
                  <p className="text-sm mb-4">
                    Use the "Import Files" tab to drag & drop files and configure your idea.
                  </p>
                  <div className="space-y-2 text-xs">
                    <p>• Drag & drop multiple file types</p>
                    <p>• Associate with existing ideas</p>
                    <p>• Create new ideas with custom details</p>
                    <p>• Bulk import with progress tracking</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or use manual import</span>
              </div>
            </div>



            

            {/* Import Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleBulkImport}
                disabled={isImporting}
                className="flex items-center gap-2"
              >
                {isImporting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isImporting ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movie Conversion Dialog */}
      <Dialog open={showMovieDialog} onOpenChange={setShowMovieDialog}>
        <DialogContent className="cinema-card border-border max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground">Convert Idea to Movie</DialogTitle>
            <DialogDescription>
              Convert your idea "{convertingIdea?.title}" into a full movie project with all the details pre-filled.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid gap-2">
              <Label htmlFor="movie-name">Project Title</Label>
              <Input
                id="movie-name"
                value={movieData.name}
                onChange={(e) => setMovieData({...movieData, name: e.target.value})}
                className="bg-input border-border"
              />
              <p className="text-xs text-muted-foreground">Edit the title if needed</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="movie-genre">Genre</Label>
              <Input
                id="movie-genre"
                value={movieData.genre}
                onChange={(e) => setMovieData({...movieData, genre: e.target.value})}
                className="bg-input border-border"
              />
              <p className="text-xs text-muted-foreground">Edit the genre if needed</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="movie-writer">Writer</Label>
              <Input
                id="movie-writer"
                value={movieData.writer}
                onChange={(e) => setMovieData({...movieData, writer: e.target.value})}
                className="bg-input border-border"
              />
              <p className="text-xs text-muted-foreground">Edit the writer if needed</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="movie-cowriters">Co-writers</Label>
              <div className="space-y-2">
                {/* Tags Display */}
                {movieData.cowriters && movieData.cowriters.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {movieData.cowriters.map((name, index) => (
                      <div key={index} className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md text-sm">
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updatedCowriters = movieData.cowriters?.filter((_, i) => i !== index) || []
                            setMovieData({...movieData, cowriters: updatedCowriters})
                          }}
                          className="text-blue-300 hover:text-blue-100 ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Input and Add Button */}
                <div className="flex gap-2">
                  <Input
                    id="movie-cowriters"
                    value={cowriterInput}
                    onChange={(e) => setCowriterInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && cowriterInput.trim()) {
                        e.preventDefault()
                        const newCowriters = [...(movieData.cowriters || []), cowriterInput.trim()]
                        setMovieData({...movieData, cowriters: newCowriters})
                        setCowriterInput("")
                      }
                    }}
                    placeholder="Type name and press Enter"
                    className="flex-1 bg-input border-border"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (cowriterInput.trim()) {
                        const newCowriters = [...(movieData.cowriters || []), cowriterInput.trim()]
                        setMovieData({...movieData, cowriters: newCowriters})
                        setCowriterInput("")
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="px-3"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Add, remove, or edit co-writers</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="movie-description">Description</Label>
              <Textarea
                id="movie-description"
                value={movieData.description}
                onChange={(e) => setMovieData({...movieData, description: e.target.value})}
                className="bg-input border-border"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Edit the description if needed</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="movie-phase">Phase</Label>
              <Select 
                value={movieData.movie_status} 
                onValueChange={(value) => setMovieData({...movieData, movie_status: value as any})}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent className="cinema-card border-border">
                  <SelectItem value="Pre-Production">Pre-Production</SelectItem>
                  <SelectItem value="Production">Production</SelectItem>
                  <SelectItem value="Post-Production">Post-Production</SelectItem>
                  <SelectItem value="Distribution">Distribution</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Choose the movie phase</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="movie-status">Status</Label>
              <Select 
                value={movieData.project_status} 
                onValueChange={(value) => setMovieData({...movieData, project_status: value as any})}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="cinema-card border-border">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Choose the project status</p>
            </div>
          </div>
          
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowMovieDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateMovie} 
              disabled={isConverting}
              className="flex items-center gap-2"
            >
              {isConverting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Movie...
                </>
              ) : (
                <>
                  <Film className="h-4 w-4" />
                  Create Movie
                </>
                )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
