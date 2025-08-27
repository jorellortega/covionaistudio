"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Lightbulb, Sparkles, Plus, Edit, Trash2, Save, Search, Filter, Image as ImageIcon, Upload, FileText } from "lucide-react"
import { useAuthReady } from "@/components/auth-hooks"
import { MovieIdeasService, type MovieIdea } from "@/lib/movie-ideas-service"
import { AISettingsService } from "@/lib/ai-settings-service"
import { OpenAIService } from "@/lib/ai-services"
import { getSupabaseClient } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import { IdeaImagesService } from "@/lib/idea-images-service"
import { Navigation } from "@/components/navigation"

export default function IdeasPage() {
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
  const [userApiKeys, setUserApiKeys] = useState<any>({})
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [aiResponse, setAiResponse] = useState<string>("")
  const [generatedImage, setGeneratedImage] = useState<string>("")
  const [isSavingImage, setIsSavingImage] = useState(false)
  
  // Idea Library Image Generation state
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [selectedIdeaForImage, setSelectedIdeaForImage] = useState<MovieIdea | null>(null)
  const [imagePrompt, setImagePrompt] = useState("")
  const [ideaImages, setIdeaImages] = useState<{[key: string]: string[]}>({})
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [dialogGeneratedImage, setDialogGeneratedImage] = useState<string | null>(null)
  
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
  
  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [genre, setGenre] = useState("")
  const [mainCreator, setMainCreator] = useState("")
  const [coCreators, setCoCreators] = useState<string[]>([])
  const [originalPrompt, setOriginalPrompt] = useState("")
  const [prompt, setPrompt] = useState("")
  const [status, setStatus] = useState<"concept" | "development" | "completed">("concept")

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
      const ideaData = {
        user_id: userId,
        title: title.trim(),
        description: description.trim(),
        genre: genre || "Unspecified",
        main_creator: mainCreator.trim() || "Unknown",
        co_creators: coCreators,
        original_prompt: originalPrompt.trim(),
        prompt: prompt.trim(),
        status,
        updated_at: new Date().toISOString()
      }

      if (editingIdea) {
        // Update existing idea
        await MovieIdeasService.updateIdea(editingIdea.id, ideaData)
        toast({
          title: "Success",
          description: "Idea updated successfully",
        })
      } else {
        // Create new idea
        const savedIdea = await MovieIdeasService.createIdea(user!.id, ideaData)
        
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
              title: "Success",
              description: "Idea saved with image!",
            })
          } catch (imageError) {
            console.error('Error saving image:', imageError)
            toast({
              title: "Partial Success",
              description: "Idea saved but image failed to save",
              variant: "destructive",
            })
          }
        } else {
          toast({
            title: "Success",
            description: "Idea saved successfully",
          })
        }
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
    setGenre(idea.genre)
    setMainCreator(idea.main_creator || "")
    setCoCreators(idea.co_creators || [])
    setOriginalPrompt(idea.original_prompt || "")
    setPrompt(idea.prompt)
    setStatus(idea.status)
    setShowAddDialog(true)
  }

  const resetForm = () => {
    setEditingIdea(null)
    setTitle("")
    setDescription("")
    setGenre("")
    setMainCreator("")
    setCoCreators([])
    setOriginalPrompt("")
    setPrompt("")
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
        const ideaResponse = await fetch('/api/import/idea', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: importIdeaTitle,
            description: importIdeaDescription || `Imported idea: ${importIdeaTitle}`,
            genre: importIdeaGenre || "Unspecified",
            main_creator: importIdeaMainCreator || "Unknown",
            co_creators: importIdeaCoCreators,
            status: importIdeaStatus || "concept"
          })
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
            const storageFileName = `${timestamp}-${fileName.replace(/\.[^/.]+$/, '')}.${fileExtension}`
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
      const settings = await AISettingsService.getUserSettings(user!.id)
      const settingsMap = settings.reduce((acc, setting) => {
        acc[setting.tab_type] = setting
        return acc
      }, {} as any)
      setAiSettings(settingsMap)
    } catch (error) {
      console.error('Error fetching AI settings:', error)
    }
  }

  const fetchUserApiKeys = async () => {
    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key, anthropic_api_key, openart_api_key, kling_api_key, runway_api_key, elevenlabs_api_key, suno_api_key')
        .eq('id', user!.id)
        .single()

      if (error) throw error
      setUserApiKeys(data || {})
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
    
    try {
      const response = await OpenAIService.generateScript({
        prompt: prompt,
        template: "Generate a creative movie script outline or scene based on the user's idea. Focus on storytelling, character development, and cinematic elements.",
        model: scriptsSetting.locked_model,
        apiKey: userApiKeys.openai_api_key || ""
      })

      if (response.success && response.data) {
        const content = response.data.choices?.[0]?.message?.content || "No response generated"
        setAiResponse(content)
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
            genre: importScriptGenre,
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

        const response = await fetch('/api/import/idea', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: importIdeaTitle,
            description: importIdeaDescription,
            genre: importIdeaGenre,
            main_creator: importIdeaMainCreator || "Unknown",
            co_creators: importIdeaCoCreators,
            status: importIdeaStatus,
            userId: user!.id
          })
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
    const matchesGenre = filterGenre === "all" || idea.genre === filterGenre
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
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingIdea ? "Edit Movie Idea" : "Add New Movie Idea"}
                </DialogTitle>
                <DialogDescription>
                  {editingIdea ? "Update your movie idea details" : "Capture your creative vision"}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
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
                    <Label htmlFor="genre">Genre</Label>
                    <Select value={genre} onValueChange={setGenre}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {genres.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <Label htmlFor="original-prompt">Original Prompt/Idea</Label>
                  <Textarea
                    id="original-prompt"
                    value={originalPrompt}
                    onChange={(e) => setOriginalPrompt(e.target.value)}
                    placeholder="Your original movie idea or prompt..."
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Your initial creative spark or prompt that started this idea
                  </p>
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
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveIdea} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {editingIdea ? "Update" : "Save"} Idea
                </Button>
              </div>
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

      <Tabs defaultValue="ai-prompt" className="w-full">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredIdeas.map((idea) => (
                  <Card key={idea.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg line-clamp-2">{idea.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {idea.genre}
                            </Badge>
                            <Badge className={`text-xs ${getStatusColor(idea.status)}`}>
                              {idea.status}
                            </Badge>
                            {idea.main_creator && (
                              <Badge variant="outline" className="text-xs">
                                👤 {idea.main_creator}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              console.log('Image button clicked for:', idea.title)
                              openImageGeneration(idea)
                            }}
                            className="h-8 px-2 text-xs"
                            title="Generate Images"
                          >
                            <ImageIcon className="h-3 w-3 mr-1" />
                            Image
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editIdea(idea)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteIdea(idea.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
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
                        setTitle("Generated Script Idea")
                        setDescription(aiResponse.substring(0, 200) + (aiResponse.length > 200 ? "..." : ""))
                        setOriginalPrompt(prompt) // Save your original prompt
                        setPrompt(aiResponse) // Save AI-generated content
                      } else if (generatedImage) {
                        setTitle("Generated Image Idea")
                        setDescription("AI-generated image concept: " + prompt)
                        setOriginalPrompt(prompt) // Save your original prompt
                        setPrompt("AI-generated image: " + prompt) // Save AI image reference
                      } else {
                        setTitle("")
                        setDescription("")
                        setOriginalPrompt(prompt) // Save your original prompt
                        setPrompt("") // No AI content yet
                      }
                      setGenre("")
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
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-green-500" />
                      Generated Script
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted p-4 rounded-md max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm font-mono">{aiResponse}</pre>
                    </div>
                                          <div className="flex gap-2 mt-4">
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
                          onClick={() => {
                            setTitle("Generated Script Idea")
                            setDescription(aiResponse.substring(0, 200) + (aiResponse.length > 200 ? "..." : ""))
                            setOriginalPrompt(prompt) // Save your original prompt
                            setPrompt(aiResponse) // Save AI-generated content
                            setGenre("")
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
                          onClick={() => setAiResponse("")}
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
                                genre: "",
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
                            setGenre(selectedIdeaForImage?.genre || "")
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
                <p><strong>Genre:</strong> {selectedIdeaForImage?.genre}</p>
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
                      setGenre(selectedIdeaForImage?.genre || "")
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
      </div>
    </>
  )
}
