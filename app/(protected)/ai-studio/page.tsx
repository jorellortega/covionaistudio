"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"
import { ProjectSelector } from "@/components/project-selector"
import { useAuthReady } from "@/components/auth-hooks"
import { OpenAIService } from "@/lib/openai-service"
import { MovieService, Movie } from "@/lib/movie-service"
import { TimelineService } from "@/lib/timeline-service"
import { AssetService } from "@/lib/asset-service"
import { AISettingsService, AISetting } from "@/lib/ai-settings-service"
import { getSupabaseClient } from "@/lib/supabase"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sparkles,
  FileText,
  ImageIcon,
  Video,
  Wand2,
  Download,
  Save,
  RefreshCw,
  History,
  Copy,
  Play,
  CheckCircle,
  ExternalLink,
  AlertCircle,
  Loader2,
  Bot,
  Settings,
  Upload,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ContentViolationDialog } from "@/components/content-violation-dialog"

// Real data types
interface Scene {
  id: string
  name: string
  description?: string
  start_time_seconds: number
  duration_seconds: number
  scene_type: string
  timeline_id: string
  user_id: string
  created_at: string
  updated_at: string
}

interface GeneratedContent {
  id: string
  title: string
  content?: string
  prompt: string
  type: 'script' | 'image' | 'video' | 'audio'
  model: string
  created_at: string
  project_id?: string
  scene_id?: string
  url?: string
  duration?: string
  saved?: boolean
  asset_id?: string
  jobId?: string
  status?: 'processing' | 'completed' | 'failed'
}

const aiModels = {
  script: ["ChatGPT", "Claude", "GPT-4", "Gemini", "Custom"],
  image: ["OpenArt", "DALL-E 3", "Runway ML", "Midjourney", "Stable Diffusion", "Custom"],
  video: ["Kling", "Runway ML", "Runway Gen-4 Turbo", "Runway Gen-4 Aleph", "Runway Gen-3A Turbo", "Runway Act-Two", "Runway Upscale", "Pika Labs", "Stable Video", "LumaAI"],
  audio: ["ElevenLabs", "Suno AI", "Udio", "MusicLM", "AudioCraft", "Custom"],
}

const scriptTemplates = [
  { name: "Scene Description", prompt: "Write a detailed scene description for:" },
  { name: "Character Dialogue", prompt: "Create dialogue between characters in this situation:" },
  { name: "Action Sequence", prompt: "Write an action sequence involving:" },
  { name: "Character Backstory", prompt: "Develop a character backstory for:" },
  { name: "Plot Treatment", prompt: "Create a plot treatment for:" },
]

const imageStyles = [
  "Cinematic",
  "Concept Art",
  "Storyboard",
  "Character Design",
  "Environment",
  "Props",
  "Mood Board",
  "Technical Drawing",
]

const handleCopy = (content: string) => {
  navigator.clipboard.writeText(content)
  // You could add a toast notification here
  console.log('Content copied to clipboard')
}



export default function AIStudioPage() {
  // State variables
  const [activeTab, setActiveTab] = useState("scripts")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [scriptPrompt, setScriptPrompt] = useState("")
  const [imagePrompt, setImagePrompt] = useState("")
  const [videoPrompt, setVideoPrompt] = useState("")
  const [audioPrompt, setAudioPrompt] = useState("")
  const [selectedModel, setSelectedModel] = useState("")
  const [selectedStyle, setSelectedStyle] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [selectedProject, setSelectedProject] = useState("")
  const [selectedScene, setSelectedScene] = useState("none")
  const [selectedDuration, setSelectedDuration] = useState("5s")
  const [selectedVideoStyle, setSelectedVideoStyle] = useState("cinematic")
  const [selectedCameraMovement, setSelectedCameraMovement] = useState("static")
  const [selectedLighting, setSelectedLighting] = useState("natural")
  const [selectedResolution, setSelectedResolution] = useState("1280x720")
  const [useVideoStyle, setUseVideoStyle] = useState(false)
  const [useCameraMovement, setUseCameraMovement] = useState(false)
  const [useLighting, setUseLighting] = useState(false)
  const [selectedRunwayModel, setSelectedRunwayModel] = useState("act_two")
  const [selectedRunwayImageModel, setSelectedRunwayImageModel] = useState("gen4_image")
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [selectedAudioType, setSelectedAudioType] = useState("music")
  const [selectedAudioDuration, setSelectedAudioDuration] = useState("30s")
  const [selectedVoice, setSelectedVoice] = useState("21m00Tcm4TlvDq8ikWAM")
  const [cloningVoiceName, setCloningVoiceName] = useState("")
  const [cloningVoiceDescription, setCloningVoiceDescription] = useState("")
  const [cloningVoiceFiles, setCloningVoiceFiles] = useState<File[]>([])
  const [customVoices, setCustomVoices] = useState<any[]>([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveModalData, setSaveModalData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [continuingScript, setContinuingScript] = useState<{
    title: string
    version_name: string
    content: string
    prompt: string
  } | null>(null)
  
  // Scene scripts state
  const [sceneScripts, setSceneScripts] = useState<any[]>([])
  const [selectedSceneScript, setSelectedSceneScript] = useState("none")
  const [isLoadingSceneScripts, setIsLoadingSceneScripts] = useState(false)

  // Content violation dialog state
  const [showContentViolationDialog, setShowContentViolationDialog] = useState(false)
  const [contentViolationData, setContentViolationData] = useState<{
    type: 'script' | 'image' | 'video' | 'audio'
    prompt: string
  } | null>(null)

  const { toast } = useToast()

  // Content violation handling functions
  const handleContentViolation = (type: 'script' | 'image' | 'video' | 'audio', prompt: string) => {
    setContentViolationData({ type, prompt })
    setShowContentViolationDialog(true)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    
    const files = event.dataTransfer.files
    if (files && files[0]) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        setUploadedFile(file)
        const reader = new FileReader()
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please upload an image file (JPG, PNG, GIF, etc.)",
          variant: "destructive",
        })
      }
    }
  }

  const pollVideoJobStatus = async (jobId: string, contentId: string) => {
    let attempts = 0
    const maxAttempts = 60 // 60 seconds max
    
    const poll = async () => {
      attempts++
      console.log(`🎬 Polling video job status (attempt ${attempts}/${maxAttempts})...`)
      
      try {
        const response = await fetch('/api/ai/check-video-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId }),
        })
        
        if (response.ok) {
          const result = await response.json()
          
          if (result.success && (result.data?.status === 'completed' || result.data?.status === 'SUCCEEDED') && result.data?.url) {
            console.log('🎬 Video generation completed! URL:', result.data.url)
            
            // Update the content with the video URL
            setGeneratedContent(prev => prev.map(content => 
              content.id === contentId 
                ? { ...content, url: result.data.url, status: 'completed' }
                : content
            ))
            
            // Show success toast
            toast({
              title: "Video Generated!",
              description: "Your video has been created successfully.",
              variant: "default",
            })
            
            return // Stop polling
          } else if (result.data?.status === 'failed' || result.data?.status === 'FAILED') {
            console.error('🎬 Video generation failed:', result.data)
            toast({
              title: "Video Generation Failed",
              description: "Video generation failed. Please try again.",
              variant: "destructive",
            })
            return // Stop polling
          }
          
          // Still processing, continue polling
          if (attempts < maxAttempts) {
            setTimeout(poll, 2000) // Poll every 2 seconds
          } else {
            console.log('🎬 Video generation timed out')
            toast({
              title: "Video Generation Timeout",
              description: "Video generation is taking longer than expected. Check back later.",
              variant: "destructive",
            })
          }
        } else {
          console.error('🎬 Failed to check video status:', response.status)
          if (attempts < maxAttempts) {
            setTimeout(poll, 2000)
          }
        }
      } catch (error) {
        console.error('🎬 Error polling video status:', error)
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000)
        }
      }
    }
    
    // Start polling
    poll()
  }

  const handleTryDifferentPrompt = () => {
    setShowContentViolationDialog(false)
    // Focus on the appropriate prompt input based on content type
    if (contentViolationData?.type === 'script') {
      // Focus script prompt
      document.getElementById('script-prompt')?.focus()
    } else if (contentViolationData?.type === 'image') {
      // Focus image prompt
      document.getElementById('image-prompt')?.focus()
    } else if (contentViolationData?.type === 'video') {
      // Focus video prompt
      document.getElementById('video-prompt')?.focus()
    } else if (contentViolationData?.type === 'audio') {
      // Focus audio prompt
      document.getElementById('audio-prompt')?.focus()
    }
  }

  const handleTryDifferentAI = () => {
    setShowContentViolationDialog(false)
    // Switch to a different AI model for the same content type
    if (contentViolationData?.type === 'image') {
      // Switch from DALL-E 3 to OpenArt
      setSelectedModel('OpenArt')
      toast({
        title: "Switched to OpenArt",
        description: "Try generating your image with OpenArt instead.",
      })
    } else if (contentViolationData?.type === 'script') {
      // Switch from ChatGPT to Claude
      setSelectedModel('Claude')
      toast({
        title: "Switched to Claude",
        description: "Try generating your script with Claude instead.",
      })
    } else if (contentViolationData?.type === 'video') {
      // Switch from Kling to Runway ML
      setSelectedModel('Runway ML')
      toast({
        title: "Switched to Runway ML",
        description: "Try generating your video with Runway ML instead.",
      })
    } else if (contentViolationData?.type === 'audio') {
      // Switch from ElevenLabs to Suno AI
      setSelectedModel('Suno AI')
      toast({
        title: "Switched to Suno AI",
        description: "Try generating your audio with Suno AI instead.",
      })
    }
  }

  // Real data state
  const [movies, setMovies] = useState<Movie[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  const { user, userId, ready } = useAuthReady()

  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  
  // User API Keys state
  const [userApiKeys, setUserApiKeys] = useState<any>({})

  // Debug logging
  console.log("AI Studio - User:", user)
  console.log("AI Studio - OpenAI API Key:", userApiKeys.openai_api_key ? "Available" : "Not available")

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!userId) return
      
      try {
        const settings = await AISettingsService.getUserSettings(userId)
        
        // Ensure default settings exist for all tabs
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'scripts'),
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'images'),
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'videos'),
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'audio')
        ])
        
        // Merge existing settings with default ones, preferring existing
        const mergedSettings = defaultSettings.map(defaultSetting => {
          const existingSetting = settings.find(s => s.tab_type === defaultSetting.tab_type)
          return existingSetting || defaultSetting
        })
        
        setAiSettings(mergedSettings)
        setAiSettingsLoaded(true)
        
        // Auto-select locked models for each tab
        mergedSettings.forEach(setting => {
          if (setting.is_locked) {
            switch (setting.tab_type) {
              case 'scripts':
                setSelectedModel(setting.locked_model)
                break
              case 'images':
                setSelectedModel(setting.locked_model)
                break
              case 'videos':
                setSelectedModel(setting.locked_model)
                break
              case 'audio':
                setSelectedModel(setting.locked_model)
                break
            }
          }
        })
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
    fetchUserApiKeys()
  }, [userId])

  // Function to fetch user API keys
  const fetchUserApiKeys = async () => {
    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key, anthropic_api_key, openart_api_key, kling_api_key, runway_api_key, elevenlabs_api_key, suno_api_key')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserApiKeys(data || {})
    } catch (error) {
      console.error('Error fetching user API keys:', error)
    }
  }

  // Function to fetch scene scripts when scene is selected
  const fetchSceneScripts = async (sceneId: string) => {
    if (!sceneId || sceneId === 'none') {
      setSceneScripts([])
      setSelectedSceneScript("none")
      return
    }
    
    try {
      setIsLoadingSceneScripts(true)
      
      // Fetch scripts for the selected scene
              const { data: scripts, error } = await getSupabaseClient()
          .from('assets')
          .select('*')
          .eq('scene_id', sceneId)
          .eq('content_type', 'script')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching scene scripts:', error)
        toast({
          title: "Error",
          description: "Failed to load scene scripts",
          variant: "destructive",
        })
        return
      }
      
      setSceneScripts(scripts || [])
      setSelectedSceneScript("none")
      
      console.log('Scene scripts loaded:', scripts)
      
    } catch (error) {
      console.error('Error fetching scene scripts:', error)
      toast({
        title: "Error",
        description: "Failed to load scene scripts",
        variant: "destructive",
      })
    } finally {
      setIsLoadingSceneScripts(false)
    }
  }

  // Auto-select locked models when AI settings change
  useEffect(() => {
    if (aiSettings.length > 0 && activeTab) {
      const currentSetting = aiSettings.find(setting => setting.tab_type === activeTab)
      if (currentSetting?.is_locked) {
        console.log(`Setting locked model for ${activeTab}:`, currentSetting.locked_model)
        setSelectedModel(currentSetting.locked_model)
        
        // If video tab is locked to Runway ML, reset the sub-model to act_two
        if (activeTab === 'videos' && currentSetting.locked_model === 'Runway ML') {
          console.log('Resetting selectedRunwayModel to act_two for locked Runway ML')
          setSelectedRunwayModel('act_two')
        }
      }
    }
  }, [aiSettings, activeTab])

  // Fetch scene scripts when scene selection changes
  useEffect(() => {
    if (selectedScene && selectedScene !== 'none') {
      fetchSceneScripts(selectedScene)
    } else {
      setSceneScripts([])
      setSelectedSceneScript("none")
    }
  }, [selectedScene])

  // Get current tab's AI setting
  const getCurrentTabSetting = () => {
    return aiSettings.find(setting => setting.tab_type === activeTab)
  }

  // Check if current tab has a locked model
  const isCurrentTabLocked = () => {
    const setting = getCurrentTabSetting()
    return setting?.is_locked || false
  }

  // Get the locked model for current tab
  const getCurrentTabLockedModel = () => {
    const setting = getCurrentTabSetting()
    return setting?.locked_model || ""
  }

  // Reset model selection when switching tabs
  useEffect(() => {
    // Don't reset selectedModel if the current tab has a locked model
    if (!isCurrentTabLocked()) {
      setSelectedModel("")
    }
    
    setSelectedStyle("")
    setSelectedTemplate("")
    setSelectedDuration("5s")
    setSelectedVideoStyle("cinematic")
    setSelectedCameraMovement("static")
    setSelectedLighting("natural")
    setSelectedResolution("1280x720")
    setSelectedRunwayModel("act_two")
    setSelectedRunwayImageModel("gen4_image")
    setSelectedAudioType("music")
    setSelectedAudioDuration("30s")
    setSelectedVoice("21m00Tcm4TlvDq8ikWAM")
    setCloningVoiceName("")
    setCloningVoiceDescription("")
    setCloningVoiceFiles([])
    setCustomVoices([])
  }, [activeTab])

  // Update resolution when Runway model changes
  useEffect(() => {
    if (selectedRunwayModel === "upscale_v1") {
      setSelectedResolution("auto")
    } else if (selectedResolution === "auto") {
      setSelectedResolution("1280x720")
    }
  }, [selectedRunwayModel])

  // Force reset selectedRunwayModel to act_two on component mount
  useEffect(() => {
    console.log('🎬 Component mount - forcing selectedRunwayModel to act_two')
    setSelectedRunwayModel('act_two')
  }, [])

  // Load real data from database
  useEffect(() => {
    const loadData = async () => {
      if (!userId) return
      
      try {
        setIsLoadingData(true)
        
        // Load user's movies
        const userMovies = await MovieService.getMovies()
        setMovies(userMovies)
        
        // Initialize with empty generated content
        setGeneratedContent([])
        
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadData()
  }, [userId])

  // Load scenes when project is selected
  useEffect(() => {
    const loadScenes = async () => {
      if (!selectedProject || !ready) return
      
      try {
        console.log('Loading scenes for project:', selectedProject)
        
        // Fetch real scenes from the database
        const realScenes = await TimelineService.getMovieScenes(selectedProject)
        console.log('Real scenes loaded:', realScenes)
        
        if (realScenes && realScenes.length > 0) {
          // Convert SceneWithMetadata to Scene format for the UI
          const convertedScenes: Scene[] = realScenes.map(scene => ({
            id: scene.id,
            name: scene.name,
            description: scene.description,
            start_time_seconds: scene.start_time_seconds,
            duration_seconds: scene.duration_seconds,
            scene_type: scene.scene_type,
            timeline_id: scene.timeline_id,
            user_id: scene.user_id,
            created_at: scene.created_at,
            updated_at: scene.updated_at,
          }))
          
          console.log('Converted scenes for UI:', convertedScenes)
          setScenes(convertedScenes)
        } else {
          console.log('No real scenes found for this project')
          setScenes([])
        }
      } catch (error) {
        console.error('Error loading real scenes:', error)
        setScenes([])
      }
    }

    loadScenes()
  }, [selectedProject, userId])

  // Effect to check for continued script data
  useEffect(() => {
    const continuedScriptData = sessionStorage.getItem('continueScriptData')
    if (continuedScriptData) {
      try {
        const scriptData = JSON.parse(continuedScriptData)
        console.log('Loading continued script data:', scriptData)
        
        // Set the continuing script state
        setContinuingScript({
          title: scriptData.title,
          version_name: scriptData.version_name || `v${scriptData.version}`,
          content: scriptData.content || '',
          prompt: scriptData.prompt || ''
        })
        
        // Pre-fill the form with the script data
        setSelectedProject(scriptData.project_id)
        setSelectedScene(scriptData.scene_id || "none")
        setSelectedTemplate(scriptData.generation_settings?.template || "cinematic")
        setSelectedStyle(scriptData.generation_settings?.style || "modern")
        
        // Pre-fill the prompt with the original prompt
        setScriptPrompt(scriptData.prompt || "")
        
        // Show a toast about the loaded script
        toast({
          title: "Script Loaded!",
          description: `"${scriptData.title}" (${scriptData.version_name || `v${scriptData.version}`}) is ready for editing.`,
          variant: "default",
        })
        
        // Clear the session storage
        sessionStorage.removeItem('continueScriptData')
        
        // Optionally, you could also pre-populate the generated content area
        // to show what the user is continuing from
        
      } catch (error) {
        console.error('Error parsing continued script data:', error)
        sessionStorage.removeItem('continueScriptData')
      }
    }
  }, [toast])

  const handleGenerate = async (type: string) => {
    // Check if we have the required API key for the selected model
    if (!userId) {
      alert("Please log in to use AI features")
      return
    }
    
          // API key checks simplified since keys aren't stored in user object
      // All models are considered ready for now

    // Helper function to enhance prompt with selected script content
    const enhancePromptWithScript = (basePrompt: string, type: string) => {
      console.log(`🔍 ENHANCE PROMPT - Type: ${type}, Base Prompt: "${basePrompt}"`)
      console.log(`🔍 ENHANCE PROMPT - Selected Script ID: ${selectedSceneScript}`)
      console.log(`🔍 ENHANCE PROMPT - Available Scripts:`, sceneScripts.map(s => ({ id: s.id, title: s.title })))
      
      if (!selectedSceneScript || !sceneScripts.find(s => s.id === selectedSceneScript)) {
        console.log(`🔍 ENHANCE PROMPT - No script selected, returning base prompt`)
        console.log(`🔍 ENHANCE PROMPT - Base prompt length: ${basePrompt.length} characters`)
        return basePrompt
      }
      
      const selectedScript = sceneScripts.find(s => s.id === selectedSceneScript)
      console.log(`🔍 ENHANCE PROMPT - Selected Script:`, { 
        id: selectedScript?.id, 
        title: selectedScript?.title, 
        version: selectedScript?.version_name || selectedScript?.version,
        contentLength: selectedScript?.content?.length || 0
      })
      
      if (!selectedScript?.content) {
        console.log(`🔍 ENHANCE PROMPT - No script content found, returning base prompt`)
        return basePrompt
      }
      
      // Send the FULL script content, not just a preview
      const scriptInfo = `\n\n--- REFERENCE SCRIPT ---\nTitle: ${selectedScript.title}\nVersion: ${selectedScript.version_name || `Version ${selectedScript.version}`}\nFull Script Content:\n${selectedScript.content}\n--- END REFERENCE ---\n\n`
      
      let enhancedPrompt = ""
      switch (type) {
        case 'script':
          enhancedPrompt = `${scriptInfo}${basePrompt}\n\nPlease use the above reference script as context and inspiration. Build upon the existing story, characters, and style while creating something new that fits seamlessly with the established narrative.`
          break
        case 'image':
          enhancedPrompt = `${scriptInfo}${basePrompt}\n\nCreate an image that visually represents the scene described in the reference script above. The image should capture the mood, setting, and visual elements mentioned in the script.`
          break
        case 'video':
          enhancedPrompt = `${scriptInfo}${basePrompt}\n\nGenerate a video that brings to life the scene from the reference script above. Consider the pacing, mood, and visual style established in the script.`
          break
        case 'audio':
          enhancedPrompt = `${scriptInfo}${basePrompt}\n\nCreate audio that complements the mood and atmosphere described in the reference script above. The audio should enhance the emotional impact and setting of the scene.`
          break
        default:
          enhancedPrompt = basePrompt
      }
      
      console.log(`🔍 ENHANCE PROMPT - Final Enhanced Prompt:`)
      console.log(`🔍 ENHANCE PROMPT - ${enhancedPrompt}`)
      console.log(`🔍 ENHANCE PROMPT - Script Info Added: ${scriptInfo}`)
      console.log(`🔍 ENHANCE PROMPT - Total Prompt Length: ${enhancedPrompt.length} characters`)
      console.log(`🔍 ENHANCE PROMPT - Full Script Content Length: ${selectedScript.content.length} characters`)
      console.log(`🔍 ENHANCE PROMPT - AI now receives: 100% of the script (${selectedScript.content.length} characters)`)
      
      return enhancedPrompt
    }

    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      if (type === "script" && selectedModel === "ChatGPT") {
        console.log('Attempting to generate script with:', {
          prompt: scriptPrompt,
          template: selectedTemplate || "Write a creative script based on:",
          apiKeyLength: userApiKeys.openai_api_key?.length || 0,
          apiKeyPrefix: userApiKeys.openai_api_key?.substring(0, 7) || 'None'
        })
        
        // First validate the API key
        console.log('Validating API key...')
        const isValid = await OpenAIService.validateApiKey(userApiKeys.openai_api_key!)
        console.log('API key validation result:', isValid)
        
        if (!isValid) {
          alert('Your OpenAI API key appears to be invalid. Please check your setup.')
          setIsGenerating(false)
          return
        }
        
                  const enhancedPrompt = enhancePromptWithScript(scriptPrompt, 'script')
        console.log(`🚀 SCRIPT GENERATION - Final Prompt Sent to OpenAI:`)
        console.log(`🚀 SCRIPT GENERATION - ${enhancedPrompt}`)
        console.log(`🚀 SCRIPT GENERATION - Template: ${selectedTemplate || "Write a creative script based on:"}`)
        
        const response = await OpenAIService.generateScript({
            prompt: enhancedPrompt,
            template: selectedTemplate || "Write a creative script based on:",
            apiKey: userApiKeys.openai_api_key!,
          })

        if (response.success) {
          // Create new generated content
          const newContent: GeneratedContent = {
            id: Date.now().toString(),
            title: `Generated Script - ${new Date().toLocaleDateString()}`,
            content: response.data.choices?.[0]?.message?.content || "No content generated",
            prompt: scriptPrompt,
            type: 'script',
            model: selectedModel,
            created_at: new Date().toISOString(),
            project_id: selectedProject,
            scene_id: selectedScene !== "none" ? selectedScene : undefined,
          }
          
          setGeneratedContent(prev => [newContent, ...prev])
          setScriptPrompt("") // Clear the prompt after successful generation
        } else {
          // Check if it's a content policy violation
          if (response.error?.includes('content_policy_violation') || response.error?.includes('safety system')) {
            handleContentViolation('script', scriptPrompt)
          } else {
            toast({
              title: "Script Generation Failed",
              description: `Error: ${response.error}`,
              variant: "destructive",
            })
          }
        }
      } else if (type === "image" && (selectedModel === "DALL-E 3" || selectedModel.startsWith("Runway"))) {
        console.log('Attempting to generate image with:', {
          prompt: imagePrompt,
          style: selectedStyle || "Cinematic",
          apiKeyLength: userApiKeys.openai_api_key?.length || 0,
          apiKeyPrefix: userApiKeys.openai_api_key?.substring(0, 7) || 'None'
        })
        
        // First validate the API key
        console.log('Validating API key for image generation...')
        const isValid = await OpenAIService.validateApiKey(userApiKeys.openai_api_key!)
        console.log('API key validation result:', isValid)
        
        if (!isValid) {
          alert('Your OpenAI API key appears to be invalid. Please check your setup.')
          setIsGenerating(false)
          return
        }
        
        const enhancedPrompt = enhancePromptWithScript(imagePrompt, 'image')
        console.log(`🚀 IMAGE GENERATION - Final Prompt Sent to ${selectedModel}:`)
        console.log(`🚀 IMAGE GENERATION - ${enhancedPrompt}`)
        console.log(`🚀 IMAGE GENERATION - Style: ${selectedStyle || "Cinematic"}`)
        
        let response
        if (selectedModel === "DALL-E 3") {
          response = await OpenAIService.generateImage({
          prompt: enhancedPrompt,
          style: selectedStyle || "Cinematic",
          apiKey: userApiKeys.openai_api_key!,
        })
        } else if (selectedModel === "Runway ML") {
          // Use the selected sub-model
          const actualModel = selectedRunwayImageModel
          
          // Parse resolution for gen4_image
          let width = 1280
          let height = 720
          if (selectedRunwayImageModel === "gen4_image") {
            if (selectedResolution === "720p") {
              width = 1280
              height = 720
            } else if (selectedResolution === "1080p") {
              width = 1920
              height = 1080
            }
          }
          
          // Use Runway ML for image generation
          if (actualModel === 'gen4_image_turbo' && uploadedFile) {
            // Use FormData for file upload
            const formData = new FormData()
            formData.append('prompt', enhancedPrompt)
            formData.append('model', actualModel)
            formData.append('service', 'runway')
            formData.append('width', width.toString())
            formData.append('height', height.toString())
            formData.append('apiKey', userApiKeys.runway_api_key)
            formData.append('userId', userId)
            formData.append('file', uploadedFile)
            
            response = await fetch('/api/ai/generate-image', {
              method: 'POST',
              body: formData,
            })
          } else {
            // Use JSON for regular models
            response = await fetch('/api/ai/generate-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prompt: enhancedPrompt,
                model: actualModel,
                service: 'runway',
                width: width,
                height: height,
                apiKey: userApiKeys.runway_api_key,
                userId: userId
              }),
            })
          }
          
          const result = await response.json()
          if (response.ok && result.success) {
            response = { success: true, data: { imageUrl: result.imageUrl } }
          } else {
            response = { success: false, error: result.error || 'Unknown error' }
          }
        }

        if (response.success) {
          // Create new generated content
          const newContent: GeneratedContent = {
            id: Date.now().toString(),
            title: `Generated Image - ${new Date().toLocaleDateString()}`,
            prompt: imagePrompt,
            type: 'image',
            model: selectedModel,
            created_at: new Date().toISOString(),
            project_id: selectedProject,
            scene_id: selectedScene !== "none" ? selectedScene : undefined,
            url: response.data.data?.[0]?.url || response.data.imageUrl,
          }
          
          setGeneratedContent(prev => [newContent, ...prev])
          setImagePrompt("") // Clear the prompt after successful generation
        } else {
          // Check if it's a content policy violation
          if (response.error?.includes('content_policy_violation') || response.error?.includes('safety system')) {
            handleContentViolation('image', imagePrompt)
          } else {
            toast({
              title: "Image Generation Failed",
              description: `Error: ${response.error}`,
              variant: "destructive",
            })
          }
        }
              } else if (type === "video" && (selectedModel.startsWith("Runway") || selectedModel === "Runway ML")) {
          console.log('Attempting to generate video with Runway ML:', {
            prompt: videoPrompt,
            duration: "10s", // Default duration
            apiKeyLength: userApiKeys.runway_api_key?.length || 0,
            apiKeyPrefix: userApiKeys.runway_api_key?.substring(0, 7) || 'None'
          })
          
          // Import the RunwayML service
          const { RunwayMLService } = await import('@/lib/ai-services')
          
          // First validate the API key
          console.log('Validating Runway ML API key...')
          const isValid = await RunwayMLService.validateApiKey(userApiKeys.runway_api_key!)
          console.log('Runway ML API key validation result:', isValid)
          
          if (!isValid) {
            toast({
              title: "Invalid API Key",
              description: "Your Runway ML API key appears to be invalid. Please check your setup.",
              variant: "destructive",
            })
            setIsGenerating(false)
            return
          }
          
          // Build enhanced prompt with only the enabled optional settings
          let enhancedPrompt = videoPrompt
          if (useVideoStyle && selectedVideoStyle !== "cinematic") {
            enhancedPrompt += `, ${selectedVideoStyle} style`
          }
          if (useCameraMovement && selectedCameraMovement !== "static") {
            enhancedPrompt += `, camera ${selectedCameraMovement}`
          }
          if (useLighting && selectedLighting !== "natural") {
            enhancedPrompt += `, ${selectedLighting} lighting`
          }
          
          console.log('Enhanced prompt for Runway ML:', enhancedPrompt)
          
          // Use the selected Runway sub-model directly
          const actualModel = selectedRunwayModel || 'gen4_turbo'
          console.log('🎬 Frontend Debug - selectedModel:', selectedModel)
          console.log('🎬 Frontend Debug - actualModel:', actualModel)
          console.log('🎬 Frontend Debug - selectedRunwayModel:', selectedRunwayModel)
          
          // Parse resolution
          let width, height
          if (selectedResolution === "auto") {
            // For upscale, use the original video dimensions
            width = 1920
            height = 1080
          } else {
            [width, height] = selectedResolution.split('x').map(Number)
          }
          
          // Prepare form data for file upload
          const formData = new FormData()
          formData.append('prompt', enhancedPrompt)
          formData.append('duration', selectedDuration)
          formData.append('width', width.toString())
          formData.append('height', height.toString())
          formData.append('model', actualModel)
          
          // Add file if uploaded
          if (uploadedFile) {
            formData.append('file', uploadedFile)
          }
          
          // Use server-side API route instead of direct Runway ML calls
          const response = await fetch('/api/ai/generate-video', {
            method: 'POST',
            body: formData, // Use FormData instead of JSON for file upload
          })

          const result = await response.json()

          if (response.ok && result.success) {
            // Check if we have a job ID (async processing) or direct URL
            if (result.data?.jobId) {
              console.log('🎬 Video generation started, job ID:', result.data.jobId)
              
              // Show processing toast
              toast({
                title: "Video Generation Started",
                description: "Your video is being generated. This may take a few minutes...",
                variant: "default",
              })
              
              // Create placeholder content with job ID
              const newContent: GeneratedContent = {
                id: result.data.jobId,
                title: `Generated Video - ${new Date().toLocaleDateString()}`,
                prompt: videoPrompt,
                type: 'video',
                model: selectedModel,
                created_at: new Date().toISOString(),
                project_id: selectedProject,
                scene_id: selectedScene !== "none" ? selectedScene : undefined,
                duration: "10s",
                url: undefined, // Will be updated when job completes
                jobId: result.data.jobId,
                status: 'processing'
              }
              
              setGeneratedContent(prev => [newContent, ...prev])
              setVideoPrompt("") // Clear the prompt after successful generation
              
              // Start polling for completion
              pollVideoJobStatus(result.data.jobId, newContent.id)
            } else {
              // Direct URL available (synchronous completion)
              const newContent: GeneratedContent = {
                id: Date.now().toString(),
                title: `Generated Video - ${new Date().toLocaleDateString()}`,
                prompt: videoPrompt,
                type: 'video',
                model: selectedModel,
                created_at: new Date().toISOString(),
                project_id: selectedProject,
                scene_id: selectedScene !== "none" ? selectedScene : undefined,
                duration: "10s",
                url: result.data?.url || result.data?.output?.url,
              }
              
              setGeneratedContent(prev => [newContent, ...prev])
              setVideoPrompt("") // Clear the prompt after successful generation
              
              // Show success toast
              toast({
                title: "Video Generated!",
                description: "Your video has been created successfully.",
                variant: "default",
              })
            }
          } else {
            console.error('Runway ML video generation failed:', result.error || 'Unknown error')
            toast({
              title: "Video Generation Failed",
              description: `Error: ${result.error || 'Unknown error'}. Please check your Runway ML API key and try again.`,
              variant: "destructive",
            })
          }
        } else if (type === "video" && selectedModel === "Kling") {
          console.log('Attempting to generate video with Kling:', {
            prompt: videoPrompt,
            duration: "10s", // Default duration
            apiKeyLength: userApiKeys.kling_api_key?.length || 0,
            apiKeyPrefix: userApiKeys.kling_api_key?.substring(0, 7) || 'None'
          })
          
          // Import the Kling service
          const { KlingService } = await import('@/lib/ai-services')
          
          const enhancedPrompt = enhancePromptWithScript(videoPrompt, 'video')
          console.log(`🚀 VIDEO GENERATION (Kling) - Final Prompt Sent to Kling:`)
          console.log(`🚀 VIDEO GENERATION (Kling) - ${enhancedPrompt}`)
          console.log(`🚀 VIDEO GENERATION (Kling) - Duration: 10s`)
          
          const response = await KlingService.generateVideo({
            prompt: enhancedPrompt,
            duration: "10s",
            model: selectedModel,
            apiKey: userApiKeys.kling_api_key!,
          })

          if (response.success) {
            // Create new generated content
            const newContent: GeneratedContent = {
              id: Date.now().toString(),
              title: `Generated Video - ${new Date().toLocaleDateString()}`,
              prompt: videoPrompt,
              type: 'video',
              model: selectedModel,
              created_at: new Date().toISOString(),
              project_id: selectedProject,
              scene_id: selectedScene !== "none" ? selectedScene : undefined,
              duration: "10s",
              url: response.data?.url || response.data?.output?.url,
            }
            
            setGeneratedContent(prev => [newContent, ...prev])
            setVideoPrompt("") // Clear the prompt after successful generation
          } else {
            // Check if it's a content policy violation
            if (response.error?.includes('content_policy_violation') || response.error?.includes('safety system')) {
              handleContentViolation('video', videoPrompt)
            } else {
              toast({
                title: "Video Generation Failed",
                description: `Error: ${response.error}`,
                variant: "destructive",
              })
            }
          }
        } else if (type === "audio" && selectedModel === "ElevenLabs") {
          console.log('Attempting to generate audio with ElevenLabs:', {
            prompt: audioPrompt,
            type: selectedAudioType,
            duration: selectedAudioDuration,
            voice: selectedVoice,
            apiKeyLength: userApiKeys.elevenlabs_api_key?.length || 0,
            apiKeyPrefix: userApiKeys.elevenlabs_api_key?.substring(0, 7) || 'None'
          })
          
          // Import the ElevenLabs service
          const { ElevenLabsService } = await import('@/lib/ai-services')
          
          // First validate the API key
          console.log('Validating ElevenLabs API key...')
          const isValid = await ElevenLabsService.validateApiKey(userApiKeys.elevenlabs_api_key!)
          console.log('ElevenLabs API key validation result:', isValid)
          
          if (!isValid) {
            toast({
              title: "Invalid API Key",
              description: "Your ElevenLabs API key appears to be invalid. Please check your setup.",
              variant: "destructive",
            })
            setIsGenerating(false)
            return
          }
          
          // Build enhanced prompt based on audio type and selected script
          let enhancedPrompt = enhancePromptWithScript(audioPrompt, 'audio')
          
          // Truncate prompt to stay within ElevenLabs character limits (aim for ~1000 chars)
          const maxPromptLength = 1000
          if (enhancedPrompt.length > maxPromptLength) {
            // Keep the beginning and end, truncate the middle
            const startLength = Math.floor(maxPromptLength * 0.4) // 40% at start
            const endLength = Math.floor(maxPromptLength * 0.3)   // 30% at end
            const middleLength = maxPromptLength - startLength - endLength - 20 // 20% for separator
            
            const start = enhancedPrompt.substring(0, startLength)
            const end = enhancedPrompt.substring(enhancedPrompt.length - endLength)
            
            enhancedPrompt = `${start}... [Content truncated for length] ...${end}`
            
            console.log(`🚀 AUDIO GENERATION (ElevenLabs) - Prompt truncated from ${enhancedPrompt.length + (enhancedPrompt.length - maxPromptLength)} to ${enhancedPrompt.length} characters`)
          }
          
          console.log(`🚀 AUDIO GENERATION (ElevenLabs) - Base Enhanced Prompt:`)
          console.log(`🚀 AUDIO GENERATION (ElevenLabs) - ${enhancedPrompt}`)
          
          if (selectedAudioType === "music") {
            enhancedPrompt = `Background music: ${enhancedPrompt}`
          } else if (selectedAudioType === "sfx") {
            enhancedPrompt = `Sound effect: ${enhancedPrompt}`
          } else if (selectedAudioType === "ambient") {
            enhancedPrompt = `Ambient sound: ${enhancedPrompt}`
          } else if (selectedAudioType === "dialogue") {
            enhancedPrompt = enhancedPrompt // Keep enhanced for voice generation
          } else if (selectedAudioType === "score") {
            enhancedPrompt = `Film score: ${enhancedPrompt}`
          }
          
          console.log(`🚀 AUDIO GENERATION (ElevenLabs) - Final Prompt After Audio Type Enhancement:`)
          console.log(`🚀 AUDIO GENERATION (ElevenLabs) - ${enhancedPrompt}`)
          
          const response = await ElevenLabsService.generateAudio({
            prompt: enhancedPrompt,
            type: selectedAudioType,
            model: selectedModel,
            apiKey: userApiKeys.elevenlabs_api_key!,
            voiceId: selectedVoice,
          })

          if (response.success) {
            // Get the audio blob from the response
            const audioBlob = response.data?.audio_blob
            if (!audioBlob) {
              throw new Error('No audio blob received from ElevenLabs')
            }

            // Upload audio to storage bucket
            const uploadResponse = await fetch('/api/ai/save-audio', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                audioBlob: audioBlob,
                fileName: `generated_audio_${selectedAudioType}_${Date.now()}`,
                projectId: selectedProject || '',
                sceneId: selectedScene !== "none" ? selectedScene : '',
                userId: userId || ''
              })
            })

            if (!uploadResponse.ok) {
              throw new Error('Failed to upload audio to storage')
            }

            const uploadResult = await uploadResponse.json()
            const storageUrl = uploadResult.url

            // Create new generated content with permanent storage URL
            const newContent: GeneratedContent = {
              id: Date.now().toString(),
              title: `Generated Audio - ${selectedAudioType} - ${new Date().toLocaleDateString()}`,
              prompt: audioPrompt,
              type: 'audio',
              model: selectedModel,
              created_at: new Date().toISOString(),
              project_id: selectedProject,
              scene_id: selectedScene !== "none" ? selectedScene : undefined,
              duration: selectedAudioDuration,
              url: storageUrl,
            }
            
            setGeneratedContent(prev => [newContent, ...prev])
            setAudioPrompt("") // Clear the prompt after successful generation
            
            // Show success toast
            toast({
              title: "Audio Generated!",
              description: `Your ${selectedAudioType} has been created and saved successfully.`,
              variant: "default",
            })
            
            // Auto-play the generated audio for immediate feedback
            if (storageUrl) {
              const audio = new Audio(storageUrl)
              audio.play().catch(e => console.log('Auto-play prevented:', e))
            }
          } else {
            console.error('ElevenLabs audio generation failed:', response.error)
            
            // Check for specific error types
            if (response.error?.includes('content_policy_violation') || response.error?.includes('safety system')) {
              handleContentViolation('audio', audioPrompt)
            } else if (response.error?.includes('quota_exceeded') || response.error?.includes('exceeds your quota')) {
              toast({
                title: "ElevenLabs Quota Exceeded",
                description: "You've reached your ElevenLabs usage limit. Please upgrade your plan or try a shorter prompt.",
                variant: "destructive",
              })
            } else if (response.error?.includes('Invalid API key')) {
              toast({
                title: "Invalid API Key",
                description: "Your ElevenLabs API key appears to be invalid. Please check your setup.",
                variant: "destructive",
              })
            } else {
              toast({
                title: "Audio Generation Failed",
                description: `Error: ${response.error}. Please try again or contact support.`,
                variant: "destructive",
              })
            }
          }
        } else if (type === "audio" && selectedModel === "Suno AI") {
          console.log('Attempting to generate audio with Suno AI:', {
            prompt: audioPrompt,
            type: selectedAudioType,
            duration: selectedAudioDuration,
            apiKeyLength: userApiKeys.openai_api_key?.length || 0,
            apiKeyPrefix: userApiKeys.openai_api_key?.substring(0, 7) || 'None'
          })
          
          // Import the Suno AI service
          const { SunoAIService } = await import('@/lib/ai-services')
          
          // First validate the API key
          console.log('Validating Suno AI API key...')
          const isValid = await SunoAIService.validateApiKey(userApiKeys.elevenlabs_api_key!)
          console.log('Suno AI API key validation result:', isValid)
          
          if (!isValid) {
            toast({
              title: "Invalid API Key",
              description: "Your Suno AI API key appears to be invalid. Please check your setup.",
              variant: "destructive",
            })
            setIsGenerating(false)
            return
          }
          
          // Build enhanced prompt based on audio type and selected script
          let enhancedPrompt = enhancePromptWithScript(audioPrompt, 'audio')
          console.log(`🚀 AUDIO GENERATION (Suno AI) - Base Enhanced Prompt:`)
          console.log(`🚀 AUDIO GENERATION (Suno AI) - ${enhancedPrompt}`)
          
          if (selectedAudioType === "music") {
            enhancedPrompt = `Music: ${enhancedPrompt}`
          } else if (selectedAudioType === "sfx") {
            enhancedPrompt = `Sound effect: ${enhancedPrompt}`
          } else if (selectedAudioType === "ambient") {
            enhancedPrompt = `Ambient: ${enhancedPrompt}`
          } else if (selectedAudioType === "score") {
            enhancedPrompt = `Film score: ${enhancedPrompt}`
          }
          
          console.log(`🚀 AUDIO GENERATION (Suno AI) - Final Prompt After Audio Type Enhancement:`)
          console.log(`🚀 AUDIO GENERATION (Suno AI) - ${enhancedPrompt}`)
          
          const response = await SunoAIService.generateAudio({
            prompt: enhancedPrompt,
            type: selectedAudioType,
            model: selectedModel,
            apiKey: userApiKeys.elevenlabs_api_key!,
          })

          if (response.success) {
            // Create new generated content
            const newContent: GeneratedContent = {
              id: Date.now().toString(),
              title: `Generated Audio - ${selectedAudioType} - ${new Date().toLocaleDateString()}`,
              prompt: audioPrompt,
              type: 'audio',
              model: selectedModel,
              created_at: new Date().toISOString(),
              project_id: selectedProject,
              scene_id: selectedScene !== "none" ? selectedScene : undefined,
              duration: selectedAudioDuration,
              url: response.data?.audio_url || response.data?.url,
            }
            
            setGeneratedContent(prev => [newContent, ...prev])
            setAudioPrompt("") // Clear the prompt after successful generation
            
            // Show success toast
            toast({
              title: "Audio Generated!",
              description: `Your ${selectedAudioType} has been created successfully.`,
              variant: "default",
            })
            
            // Auto-play the generated audio for immediate feedback
            if (response.data?.audio_url) {
              const audio = new Audio(response.data.audio_url)
              audio.play().catch(e => console.log('Auto-play prevented:', e))
            }
          } else {
            console.error('Suno AI audio generation failed:', response.error)
            // Check if it's a content policy violation
            if (response.error?.includes('content_policy_violation') || response.error?.includes('safety system')) {
              handleContentViolation('audio', audioPrompt)
            } else {
              toast({
                title: "Audio Generation Failed",
                description: `Error: ${response.error}. Please check your Suno AI API key and try again.`,
                variant: "destructive",
              })
            }
          }
        } else {
          // For other models, show a message that they're not implemented yet
          alert(`${selectedModel} is not yet implemented. Please use ChatGPT for scripts, DALL-E 3 or Runway models for images, or Runway models/Kling for videos.`)
          setIsGenerating(false)
          return
        }

      setGenerationProgress(100)
    } catch (error) {
      console.error('Unexpected error in handleGenerate:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Check if it's a content policy violation
      if (errorMessage.includes('content_policy_violation') || errorMessage.includes('safety system')) {
        // Determine the content type based on the current state
        let contentType: 'script' | 'image' | 'video' | 'audio' = 'script'
        let prompt = ''
        
        if (activeTab === 'scripts') {
          contentType = 'script'
          prompt = scriptPrompt
        } else if (activeTab === 'images') {
          contentType = 'image'
          prompt = imagePrompt
        } else if (activeTab === 'videos') {
          contentType = 'video'
          prompt = videoPrompt
        } else if (activeTab === 'audio') {
          contentType = 'audio'
          prompt = audioPrompt
        }
        
        handleContentViolation(contentType, prompt)
      } else {
        toast({
          title: "Generation Failed",
          description: `Unexpected error: ${errorMessage}`,
          variant: "destructive",
        })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLinkToScene = (item: any, type: string, sceneId: string) => {
    console.log(`🔗 LINKING - ${item.title} to scene ${sceneId}`)
    console.log(`🔗 LINKING - Current selectedScene: ${selectedScene}`)
    console.log(`🔗 LINKING - Available scenes:`, scenes.map(s => ({ id: s.id, name: s.name })))
    
    // Update the generated content with the scene_id
    setGeneratedContent(prev => prev.map(content => {
      if (content.id === item.id) {
        return {
          ...content,
          scene_id: sceneId === 'none' ? undefined : sceneId
        }
      }
      return content
    }))
    
    // Show toast notification
    if (sceneId === 'none') {
      toast({
        title: "Scene Link Removed",
        description: `${item.title} is no longer linked to a specific scene.`,
      })
    } else {
      const sceneName = scenes.find(s => s.id === sceneId)?.name || 'Unknown Scene'
      toast({
        title: "Scene Linked",
        description: `${item.title} is now linked to ${sceneName}.`,
      })
    }
  }

  const handleSaveToLibrary = (item: any, type: string) => {
    // Check if a project is selected
    if (!selectedProject) {
      toast({
        title: "Project Required",
        description: "Please select a project above before saving to the library. Generated content must be associated with a project.",
        variant: "destructive",
        duration: 5000, // Show for 5 seconds
      })
      return
    }

    const assetData = {
      ...item,
      project: selectedProject,
      scene: selectedScene,
      type,
      createdAt: new Date().toISOString(),
    }

    setSaveModalData({
      item: assetData,
      type,
      projectName: movies.find((m) => m.id.toString() === selectedProject)?.name || "Unknown Project",
      sceneName: selectedScene
        ? scenes.find((s) => s.id === selectedScene)?.name
        : null,
    })
    setShowSaveModal(true)
  }

  // Download image function
  const handleDownloadImage = async (imageUrl: string, fileName: string) => {
    try {
      console.log('Downloading image via API...')
      
      // Check if it's already a Supabase URL
      if (imageUrl.includes('supabase.co')) {
        // Direct download from Supabase (no CORS issues)
        const response = await fetch(imageUrl)
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status}`)
        }
        
        const imageBlob = await response.blob()
        console.log('Image downloaded from Supabase, size:', imageBlob.size)
        
        // Create download link
        const url = window.URL.createObjectURL(imageBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${fileName}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        toast({
          title: "Download Started",
          description: "Image download has begun.",
          variant: "default",
        })
      } else {
        // For OpenAI URLs, use our API to download and then download from Supabase
        toast({
          title: "Processing Image",
          description: "Downloading and uploading image to storage first...",
          variant: "default",
        })
        
        // Use our API route to download and upload
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
          // Now download from the new Supabase URL
          const downloadResponse = await fetch(result.supabaseUrl)
          if (!downloadResponse.ok) {
            throw new Error(`Failed to download from Supabase: ${downloadResponse.status}`)
          }
          
          const imageBlob = await downloadResponse.blob()
          const url = window.URL.createObjectURL(imageBlob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${fileName}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          
          toast({
            title: "Download Started",
            description: "Image uploaded to storage and download begun.",
            variant: "default",
          })
        } else {
          throw new Error('Failed to get Supabase URL from API')
        }
      }
      
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: "Download Failed",
        description: "Failed to download image. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Download video function
  const handleDownloadVideo = async (videoUrl: string, fileName: string) => {
    try {
      console.log('Downloading video...')
      
      // Create download link
      const link = document.createElement('a')
      link.href = videoUrl
      link.download = `${fileName}.mp4`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({
        title: "Download Started",
        description: "Video download has begun.",
        variant: "default",
      })
      
    } catch (error) {
      console.error('Video download error:', error)
      toast({
        title: "Download Failed",
        description: "Failed to download video. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Download and upload image to Supabase storage
  const downloadAndUploadImage = async (imageUrl: string, fileName: string): Promise<string> => {
    try {
      console.log('Processing image for Supabase storage via API...')
      
      // Use our API route to download and upload (bypasses CORS)
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
      console.log('API response:', result)
      
      if (result.success && result.supabaseUrl) {
        console.log('Image uploaded successfully to Supabase:', result.supabaseUrl)
        return result.supabaseUrl
      } else {
        throw new Error('API did not return a valid Supabase URL')
      }
      
    } catch (error) {
      console.error('Error downloading/uploading image via API:', error)
      throw error
    }
  }

  const handleConfirmSave = async () => {
    if (!saveModalData || !user) return
    
    // Validate project selection
    if (!selectedProject) {
      toast({
        title: "Project Required",
        description: "Please select a project before saving to the library.",
        variant: "destructive",
      })
      return
    }
    
    try {
      setLoading(true)
      
      let finalContentUrl = saveModalData.item.url
      
      // For images, download and upload to Supabase storage
      if (saveModalData.type === 'image' && saveModalData.item.url) {
        try {
          console.log('Processing image for Supabase storage...')
          const fileName = saveModalData.item.title || 'generated-image'
          finalContentUrl = await downloadAndUploadImage(saveModalData.item.url, fileName)
          console.log('Image uploaded to Supabase, new URL:', finalContentUrl)
        } catch (error) {
          console.error('Failed to upload image to Supabase:', error)
          toast({
            title: "Image Upload Failed",
            description: "Failed to upload image to storage, but saving to database with original URL.",
            variant: "destructive",
          })
          // Continue with original URL if upload fails
        }
      }
      
      // Save the asset to the database
      const assetData = {
        project_id: selectedProject,
        scene_id: selectedScene !== "none" ? selectedScene : null,
        title: saveModalData.item.title,
        content_type: saveModalData.type as 'script' | 'image' | 'video' | 'audio',
        content: saveModalData.item.content,
        content_url: finalContentUrl, // Use the new Supabase URL if available
        prompt: saveModalData.item.prompt,
        model: saveModalData.item.model,
        version_name: saveModalData.versionLabel || undefined, // Pass version name
        generation_settings: {
          template: selectedTemplate,
          style: selectedStyle,
        },
        metadata: {
          project_name: saveModalData.projectName,
          scene_name: saveModalData.sceneName,
          generated_at: new Date().toISOString(),
          version_label: saveModalData.versionLabel || null, // Keep in metadata for backward compatibility
        }
      }
      
      console.log('Saving asset to database:', JSON.stringify(assetData, null, 2))
      console.log('Content type being sent:', assetData.content_type)
      console.log('Project ID being sent:', assetData.project_id)
      console.log('Scene ID being sent:', assetData.scene_id)
      console.log('Final content URL:', assetData.content_url)
      
      const savedAsset = await AssetService.createAsset(assetData)
      console.log('Asset saved successfully:', savedAsset)
      
      // Update the generated content to show it's been saved
      setGeneratedContent(prev => 
        prev.map(item => 
          item.id === saveModalData.item.id 
            ? { ...item, saved: true, asset_id: savedAsset.id }
            : item
        )
      )
      
      // Show success message
      toast({
        title: "Asset Saved!",
        description: `${saveModalData.type} has been saved to your asset library.`,
        variant: "default",
      })
      
      // If a scene was selected, show a link to view it
      if (selectedScene && selectedScene !== "none") {
        toast({
          title: "View in Scene",
          description: (
            <div className="flex items-center gap-2">
              <span>Asset saved to scene. </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/timeline-scene/${selectedScene}`, '_blank')}
                className="h-6 px-2 text-xs"
              >
                View Scene
              </Button>
            </div>
          ),
          variant: "default",
        })
      }
      
      setShowSaveModal(false)
      setSaveModalData(null)
      
    } catch (error) {
      console.error('Error saving asset:', error)
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save asset to database.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVoicePreview = async (voiceId: string) => {
    if (false) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key first.",
        variant: "destructive",
      })
      return
    }

    try {
      const { ElevenLabsService } = await import('@/lib/ai-services')
      const response = await ElevenLabsService.getVoicePreview(userApiKeys.elevenlabs_api_key, voiceId)
      
      if (response.success && response.data?.audioUrl) {
        // Create and play the audio preview
        const audio = new Audio(response.data.audioUrl)
        audio.play()
        
        toast({
          title: "Voice Preview",
          description: "Playing voice preview...",
          variant: "default",
        })
      } else {
        toast({
          title: "Preview Failed",
          description: response.error || "Could not generate voice preview",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Voice preview error:', error)
      toast({
        title: "Preview Error",
        description: "Failed to generate voice preview",
        variant: "destructive",
      })
    }
  }

  const handleCloneVoice = async () => {
    if (false) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key first.",
        variant: "destructive",
      })
      return
    }

    if (!cloningVoiceName || cloningVoiceFiles.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please provide a voice name and upload audio files.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsGenerating(true)
      const { ElevenLabsService } = await import('@/lib/ai-services')
      
      const response = await ElevenLabsService.cloneVoice(
        userApiKeys.elevenlabs_api_key,
        cloningVoiceName,
        cloningVoiceDescription,
        cloningVoiceFiles
      )

      if (response.success) {
        toast({
          title: "Voice Cloned!",
          description: `"${cloningVoiceName}" has been created successfully.`,
          variant: "default",
        })
        
        // Clear the form
        setCloningVoiceName("")
        setCloningVoiceDescription("")
        setCloningVoiceFiles([])
        
        // Optionally refresh available voices
        // You could implement a function to fetch and update the voice list
      } else {
        toast({
          title: "Cloning Failed",
          description: response.error || "Failed to clone voice",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Voice cloning error:', error)
      toast({
        title: "Cloning Error",
        description: "Failed to clone voice",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRefreshCustomVoices = async () => {
    if (false) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key first.",
        variant: "destructive",
      })
      return
    }

    try {
      const { ElevenLabsService } = await import('@/lib/ai-services')
      const response = await ElevenLabsService.getAvailableVoices(userApiKeys.elevenlabs_api_key)
      
      if (response.success && response.data?.voices) {
        // Filter to show only custom voices (not the default ones)
        const customVoicesList = response.data.voices.filter((voice: any) => 
          voice.category === 'cloned' || voice.category === 'generated'
        )
        setCustomVoices(customVoicesList)
        
        toast({
          title: "Voices Refreshed",
          description: `Found ${customVoicesList.length} custom voices.`,
          variant: "default",
        })
      } else {
        toast({
          title: "Refresh Failed",
          description: response.error || "Could not fetch custom voices",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Refresh custom voices error:', error)
      toast({
        title: "Refresh Error",
        description: "Failed to refresh custom voices",
        variant: "destructive",
      })
    }
  }

  const handleDeleteCustomVoice = async (voiceId: string) => {
    if (false) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key first.",
        variant: "destructive",
      })
      return
    }

    if (!confirm("Are you sure you want to delete this voice? This action cannot be undone.")) {
      return
    }

    try {
      const { ElevenLabsService } = await import('@/lib/ai-services')
      const response = await ElevenLabsService.deleteVoice(userApiKeys.elevenlabs_api_key, voiceId)
      
      if (response.success) {
        // Remove the voice from the local state
        setCustomVoices(prev => prev.filter(voice => voice.voice_id !== voiceId))
        
        toast({
          title: "Voice Deleted",
          description: "Custom voice has been removed successfully.",
          variant: "default",
        })
      } else {
        toast({
          title: "Deletion Failed",
          description: response.error || "Failed to delete voice",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Delete custom voice error:', error)
      toast({
        title: "Deletion Error",
        description: "Failed to delete custom voice",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">AI Studio</h1>
              <p className="text-muted-foreground">Generate scripts, images, and videos with AI</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => window.open('/settings-ai', '_blank')}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                AI Settings
              </Button>
            </div>
          </div>
        </div>



        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Generate for Project</label>
            <ProjectSelector
              selectedProject={selectedProject}
              onProjectChange={(projectId) => {
                setSelectedProject(projectId)
                setSelectedScene("none") // Reset scene when project changes
              }}
              showCreateNew={true}
            />
            {!selectedProject && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ Select a project to save generated content to your library
              </p>
            )}
          </div>

          {selectedProject && (
            <div>
              <label className="text-sm font-medium mb-2 block">Link to Scene (Optional)</label>
              <Select value={selectedScene} onValueChange={setSelectedScene}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select a scene" />
                </SelectTrigger>
                <SelectContent className="cinema-card border-border">
                  <SelectItem value="none">No specific scene</SelectItem>
                  {scenes.map((scene) => (
                    <SelectItem key={scene.id} value={scene.id}>
                      Scene {scene.start_time_seconds}s: {scene.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* AI Tools Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-muted/50 border border-border">
            <TabsTrigger 
              value="scripts" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-blue-300 data-[state=active]:scale-110 data-[state=active]:rounded-lg transition-all duration-300"
            >
              <FileText className="h-4 w-4" />
              Scripts
            </TabsTrigger>
            <TabsTrigger 
              value="images" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-blue-300 data-[state=active]:scale-110 data-[state=active]:rounded-lg transition-all duration-300"
            >
              <ImageIcon className="h-4 w-4" />
              Images
            </TabsTrigger>
            <TabsTrigger 
              value="videos" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-blue-300 data-[state=active]:scale-110 data-[state=active]:rounded-lg transition-all duration-300"
            >
              <Video className="h-4 w-4" />
              Videos
            </TabsTrigger>
            <TabsTrigger 
              value="audio" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-blue-300 data-[state=active]:scale-110 data-[state=active]:rounded-lg transition-all duration-300"
            >
              <Sparkles className="h-4 w-4" />
              Audio
            </TabsTrigger>
          </TabsList>

          {/* Script Generation */}
          <TabsContent value="scripts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Generation Panel */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Script Generator</CardTitle>
                  <CardDescription>Generate dialogue, scenes, and story elements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedProject && (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm text-primary">
                        Generating for:{" "}
                        <span className="font-medium">
                          {movies.find((m) => m.id.toString() === selectedProject)?.name}
                        </span>
                        {selectedScene && (
                          <>
                            {" → "}
                            <span className="font-medium">
                              {
                                scenes.find(
                                  (s) => s.id === selectedScene,
                                )?.name
                              }
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  )}



                  <div className="grid gap-2">
                    <Label>Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Choose a template" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        {scriptTemplates.map((template) => (
                          <SelectItem key={template.name} value={template.name}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Scene Scripts Dropdown - Only show if scene is selected */}
                  {selectedScene && selectedScene !== 'none' && (
                    <div className="grid gap-2">
                      <Label>Scene Scripts</Label>
                      <Select value={selectedSceneScript} onValueChange={setSelectedSceneScript}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select a script to reference..." />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          {isLoadingSceneScripts ? (
                            <SelectItem value="loading" disabled>
                              <div className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Loading scripts...
                              </div>
                            </SelectItem>
                          ) : sceneScripts.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No scripts found in this scene
                            </SelectItem>
                          ) : (
                            <>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">No script selected</span>
                              </SelectItem>
                              {sceneScripts.map((script) => (
                                <SelectItem key={script.id} value={script.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{script.title}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {script.version_name || `Version ${script.version}`} • {new Date(script.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      
                      {/* Help text */}
                      <p className="text-xs text-muted-foreground">
                        💡 Select a script to automatically enhance your prompt with scene context. The AI will use the selected script as reference to create content that fits seamlessly with your existing story.
                      </p>
                      
                      {/* Show selected script preview */}
                      {selectedSceneScript && sceneScripts.find(s => s.id === selectedSceneScript) && (
                        <div className="p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-foreground">Selected Script:</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedSceneScript("none")}
                              className="h-6 px-2 text-xs"
                            >
                              Clear
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground max-h-20 overflow-y-auto">
                            {sceneScripts.find(s => s.id === selectedSceneScript)?.content?.substring(0, 200)}
                            {sceneScripts.find(s => s.id === selectedSceneScript)?.content && 
                             sceneScripts.find(s => s.id === selectedSceneScript)?.content.length > 200 && '...'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Model Selection - Only show if not locked */}
                  {!isCurrentTabLocked() && (
                    <div className="grid gap-2">
                      <Label>AI Model</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select AI model" />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          {aiModels.script.map((model) => {
                            let isReady = false
                            let statusText = ""
                            
                            if (model === "ChatGPT") {
                              isReady = !false
                              statusText = isReady ? "Ready" : "OpenAI API Key Required"
                            } else if (model === "Claude") {
                              isReady = !false
                              statusText = isReady ? "Ready" : "Anthropic API Key Required"
                            } else {
                              isReady = false
                              statusText = "Coming Soon"
                            }
                            
                            return (
                              <SelectItem key={model} value={model} disabled={!isReady}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{model}</span>
                                  <Badge variant={isReady ? "default" : "secondary"} className="text-xs ml-2">
                                    {statusText}
                                  </Badge>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      
                      {selectedModel === "ChatGPT" && false && (
                        <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                          <p className="text-sm text-orange-600">
                            <AlertCircle className="h-4 w-4 inline mr-2" />
                            OpenAI API key required. <Link href="/setup-ai" className="underline">Configure now</Link>
                          </p>
                        </div>
                      )}
                      
                      {selectedModel === "Claude" && false && (
                        <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                          <p className="text-sm text-orange-600">
                            <AlertCircle className="h-4 w-4 inline mr-2" />
                            Anthropic API key required. <Link href="/setup-ai" className="underline">Configure now</Link>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show locked model info if tab is locked */}
                  {isCurrentTabLocked() && (
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        AI Online
                      </p>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label>Prompt</Label>
                    <Textarea
                      id="script-prompt"
                      value={scriptPrompt}
                      onChange={(e) => setScriptPrompt(e.target.value)}
                      placeholder="Describe what you want to generate..."
                      className="bg-input border-border min-h-32"
                    />
                  </div>

                  {isGenerating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Generating...</span>
                        <span>{generationProgress}%</span>
                      </div>
                      <Progress value={generationProgress} className="w-full" />
                    </div>
                  )}

                  <Button
                    onClick={() => handleGenerate("script")}
                    disabled={
                      isGenerating || 
                      !scriptPrompt || 
                      !selectedProject || 
                      !selectedModel ||
                      (selectedModel === "ChatGPT" && false) ||
                      (selectedModel === "Claude" && false)
                    }
                    className="w-full gradient-button text-white"
                  >
                    {isGenerating ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate Script
                  </Button>
                  

                </CardContent>
              </Card>

              {/* Generated Scripts */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Generated Scripts</CardTitle>
                  <CardDescription>Your recent script generations</CardDescription>
                  {selectedProject && (
                    <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
                      ✅ Will save to project: <strong>{movies.find((m) => m.id.toString() === selectedProject)?.name}</strong>
                    </div>
                  )}
                  {!selectedProject && (
                    <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-2">
                      ⚠️ Select a project above to save scripts to your library
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {generatedContent.filter(item => item.type === 'script').length > 0 ? (
                    <div className="space-y-4">
                      {generatedContent
                        .filter(item => item.type === 'script')
                        .map((script) => (
                          <Card key={script.id} className="bg-muted/50 border-border">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">{script.title}</CardTitle>
                                <Badge variant="outline" className="text-xs">
                                  {script.model}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{script.content}</p>

                              {selectedProject && scenes.length > 0 && (
                                <div className="mb-3 p-2 bg-background/50 rounded border">
                                  <label className="text-xs font-medium mb-1 block">Link to Scene:</label>
                                  <Select 
                                    value={script.scene_id || selectedScene !== 'none' ? selectedScene : 'none'} 
                                    onValueChange={(sceneId) => handleLinkToScene(script, "script", sceneId)}
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue placeholder="Choose scene" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none" className="text-xs">
                                        No specific scene
                                      </SelectItem>
                                      {scenes.map((scene) => (
                                        <SelectItem key={scene.id} value={scene.id} className="text-xs">
                                          Scene {scene.start_time_seconds}s: {scene.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="text-xs bg-transparent" onClick={() => handleCopy(script.content || "")}>
                                  <Copy className="mr-1 h-3 w-3" />
                                  Copy
                                </Button>
                                {script.saved ? (
                                  <Button size="sm" variant="outline" className="text-xs bg-green-500/20 text-green-500 border-green-500/30" disabled>
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Saved
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSaveToLibrary(script, "script")}
                                    className="text-xs"
                                  >
                                    <Save className="mr-1 h-3 w-3" />
                                    Save
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Image Generation */}
          <TabsContent value="images" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Generation Panel */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Image Generator</CardTitle>
                  <CardDescription>Create concept art, storyboards, and visual assets</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Style</Label>
                    <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Choose a style" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        {imageStyles.map((style) => (
                          <SelectItem key={style} value={style}>
                            {style}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Scene Scripts Dropdown - Only show if scene is selected */}
                  {selectedScene && selectedScene !== 'none' && (
                    <div className="grid gap-2">
                      <Label>Scene Scripts</Label>
                      <Select value={selectedSceneScript} onValueChange={setSelectedSceneScript}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select a script to reference..." />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          {isLoadingSceneScripts ? (
                            <SelectItem value="loading" disabled>
                              <div className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Loading scripts...
                              </div>
                            </SelectItem>
                          ) : sceneScripts.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No scripts found in this scene
                            </SelectItem>
                          ) : (
                            <>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">No script selected</span>
                              </SelectItem>
                              {sceneScripts.map((script) => (
                                <SelectItem key={script.id} value={script.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{script.title}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {script.version_name || `Version ${script.version}`} • {new Date(script.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      
                      {/* Show selected script preview */}
                      {selectedSceneScript && sceneScripts.find(s => s.id === selectedSceneScript) && (
                        <div className="p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Selected Script:</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedSceneScript("none")}
                              className="h-6 px-2 text-xs"
                            >
                              Clear
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground max-h-16 overflow-y-auto">
                            {sceneScripts.find(s => s.id === selectedSceneScript)?.content?.substring(0, 150)}
                            {sceneScripts.find(s => s.id === selectedSceneScript)?.content && 
                             sceneScripts.find(s => s.id === selectedSceneScript)?.content.length > 150 && '...'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Model Selection - Only show if not locked */}
                  {!isCurrentTabLocked() && (
                    <div className="grid gap-2">
                      <Label>AI Model</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select AI model" />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          {aiModels.image.map((model) => {
                            let isReady = false
                            let statusText = ""
                            
                            if (model === "DALL-E 3") {
                              isReady = !false
                              statusText = isReady ? "Ready" : "OpenAI API Key Required"
                            } else if (model === "OpenArt") {
                              isReady = !false
                              statusText = isReady ? "Ready" : "API Key Required"
                            } else if (model === "Runway ML") {
                              isReady = !!userApiKeys.runway_api_key
                              statusText = isReady ? "Ready" : "Runway ML API Key Required"
                            } else {
                              isReady = false
                              statusText = "Coming Soon"
                            }
                            
                            return (
                              <SelectItem key={model} value={model} disabled={!isReady}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{model}</span>
                                  <Badge variant={isReady ? "default" : "secondary"} className="text-xs ml-2">
                                    {statusText}
                                  </Badge>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      
                      {/* Runway Model Selection - Show when Runway ML is selected */}
                      {selectedModel === "Runway ML" && (
                        <div className="grid gap-2">
                          <Label>Model</Label>
                          <Select value={selectedRunwayImageModel} onValueChange={setSelectedRunwayImageModel}>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Select Runway model" />
                            </SelectTrigger>
                            <SelectContent className="cinema-card border-border">
                              <SelectItem value="gen4_image">Gen-4 Image (Text → Image, 720p/1080p)</SelectItem>
                              <SelectItem value="gen4_image_turbo">Gen-4 Image Turbo (Image+Text → Image, requires reference image)</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {/* Pricing Display */}
                          <div className="text-xs text-muted-foreground">
                            {selectedRunwayImageModel === "gen4_image" && "5 credits per 720p image, 8 credits per 1080p image"}
                            {selectedRunwayImageModel === "gen4_image_turbo" && "2 credits per image (requires reference image)"}
                          </div>
                          
                          {/* Warning for turbo model */}
                          {selectedRunwayImageModel === "gen4_image_turbo" && (
                            <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                              ⚠️ This model requires a reference image. Use "Gen-4 Image" for text-only generation.
                            </div>
                          )}
                          
                          {/* Resolution Selection - Only for gen4_image */}
                          {selectedRunwayImageModel === "gen4_image" && (
                            <div className="grid gap-2">
                              <Label>Resolution</Label>
                              <Select value={selectedResolution} onValueChange={setSelectedResolution}>
                                <SelectTrigger className="bg-input border-border">
                                  <SelectValue placeholder="Select resolution" />
                                </SelectTrigger>
                                <SelectContent className="cinema-card border-border">
                                  <SelectItem value="720p">720p (5 credits)</SelectItem>
                                  <SelectItem value="1080p">1080p (8 credits)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {selectedModel === "DALL-E 3" && false && (
                        <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                          <p className="text-sm text-orange-600">
                            <AlertCircle className="h-4 w-4 inline mr-2" />
                            OpenAI API key required. <Link href="/setup-ai" className="underline">Configure now</Link>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show locked model info if tab is locked */}
                  {isCurrentTabLocked() && (
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        AI Online
                      </p>
                    </div>
                  )}

                  {/* File Upload - Show for Gen-4 Image Turbo */}
                  {selectedModel === "Runway ML" && selectedRunwayImageModel === "gen4_image_turbo" && (
                    <div className="grid gap-2">
                      <Label>Reference Image (Required)</Label>
                      <div 
                        className="border-2 border-dashed border-border rounded-lg p-4"
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="image-upload"
                        />
                        <label
                          htmlFor="image-upload"
                          className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                        >
                          {uploadedFile ? (
                            <div className="w-full">
                              <img
                                src={filePreview}
                                alt="Uploaded reference"
                                className="w-full h-32 object-cover rounded-lg"
                              />
                              <p className="text-sm text-muted-foreground mt-2 text-center">
                                Click to change reference image
                              </p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">
                                Click to upload reference image
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Gen-4 Image Turbo requires a reference image
                              </p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label>Prompt</Label>
                    <Textarea
                      id="image-prompt"
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Describe the image you want to generate..."
                      className="bg-input border-border min-h-32"
                    />
                  </div>

                  {isGenerating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Generating...</span>
                        <span>{generationProgress}%</span>
                      </div>
                      <Progress value={generationProgress} className="w-full" />
                    </div>
                  )}

                  <Button
                    onClick={() => handleGenerate("image")}
                    disabled={
                      isGenerating || 
                      !imagePrompt || 
                      !selectedModel ||
                      (selectedModel === "DALL-E 3" && false) ||
                      (selectedModel === "OpenArt" && false) ||
                      (selectedModel === "Runway ML" && !userApiKeys.runway_api_key) ||
                      (selectedModel === "Runway ML" && selectedRunwayImageModel === "gen4_image_turbo" && !uploadedFile)
                    }
                    className="w-full gradient-button text-white"
                  >
                    {isGenerating ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate Image
                  </Button>
                  
                  {/* Debug info for locked models - HIDDEN */}
                  {/* {isCurrentTabLocked() && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded border">
                      <div>Locked Model: {getCurrentTabLockedModel()}</div>
                      <div>Selected Model: {selectedModel || 'None'}</div>
                      <div>Is Locked: {isCurrentTabLocked().toString()}</div>
                    </div>
                  )} */}

                </CardContent>
              </Card>

              {/* Generated Images */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Generated Images</CardTitle>
                  <CardDescription>Your recent image generations</CardDescription>
                  {selectedProject && (
                    <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
                      ✅ Will save to project: <strong>{movies.find((m) => m.id.toString() === selectedProject)?.name}</strong>
                    </div>
                  )}
                  {!selectedProject && (
                    <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-2">
                      ⚠️ Select a project above to save images to your library
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {generatedContent
                      .filter(item => item.type === 'image')
                      .map((image) => (
                      <Card key={image.id} className="bg-muted/50 border-border">
                        <CardContent className="p-3">
                          <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-muted">
                            <img
                              src={image.url || "/placeholder.svg?height=200&width=200"}
                              alt={image.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <h4 className="text-sm font-medium mb-1">{image.title}</h4>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{image.prompt}</p>
                          


                          {selectedProject && scenes.length > 0 && (
                            <div className="mb-2">
                              <label className="text-xs font-medium mb-1 block">Link to Scene:</label>
                              <Select 
                                value={image.scene_id || selectedScene !== 'none' ? selectedScene : 'none'} 
                                onValueChange={(sceneId) => handleLinkToScene(image, "image", sceneId)}
                              >
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue placeholder="Link to scene" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none" className="text-xs">
                                    No specific scene
                                  </SelectItem>
                                  {scenes.map((scene) => (
                                    <SelectItem key={scene.id} value={scene.id} className="text-xs">
                                      Scene {scene.start_time_seconds}s: {scene.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="flex items-center gap-1">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs flex-1 bg-transparent"
                              onClick={() => handleDownloadImage(image.url || '', image.title || 'generated-image')}
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </Button>
                            {image.saved ? (
                              <Button size="sm" variant="outline" className="text-xs flex-1 bg-green-500/20 text-green-500 border-green-500/30" disabled>
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Saved
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveToLibrary(image, "image")}
                                className="text-xs flex-1"
                              >
                                <Save className="mr-1 h-3 w-3" />
                                Save
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Video Generation */}
          <TabsContent value="videos" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Generation Panel */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Video Generator</CardTitle>
                  <CardDescription>Create previsualization and video clips</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Duration</Label>
                    <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="5s">5 seconds</SelectItem>
                        <SelectItem value="10s">10 seconds</SelectItem>
                        <SelectItem value="30s">30 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Scene Scripts Dropdown - Only show if scene is selected */}
                  {selectedScene && selectedScene !== 'none' && (
                    <div className="grid gap-2">
                      <Label>Scene Scripts</Label>
                      <Select value={selectedSceneScript} onValueChange={setSelectedSceneScript}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select a script to reference..." />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          {isLoadingSceneScripts ? (
                            <SelectItem value="loading" disabled>
                              <div className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Loading scripts...
                              </div>
                            </SelectItem>
                          ) : sceneScripts.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No scripts found in this scene
                            </SelectItem>
                          ) : (
                            <>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">No script selected</span>
                              </SelectItem>
                              {sceneScripts.map((script) => (
                                <SelectItem key={script.id} value={script.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{script.title}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {script.version_name || `Version ${script.version}`} • {new Date(script.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      
                      {/* Show selected script preview */}
                      {selectedSceneScript && sceneScripts.find(s => s.id === selectedSceneScript) && (
                        <div className="p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Selected Script:</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedSceneScript("none")}
                              className="h-6 px-2 text-xs"
                            >
                              Clear
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground max-h-16 overflow-y-auto">
                            {sceneScripts.find(s => s.id === selectedSceneScript)?.content?.substring(0, 150)}
                            {sceneScripts.find(s => s.id === selectedSceneScript)?.content && 
                             sceneScripts.find(s => s.id === selectedSceneScript)?.content.length > 150 && '...'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(selectedModel.startsWith("Runway") || selectedModel === "Runway ML") && (
                    <>
                      {/* Show More Options Button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMoreOptions(!showMoreOptions)}
                        className="w-full"
                      >
                        {showMoreOptions ? "Hide Options" : "Show More Options"}
                      </Button>

                      {/* File Upload - Show for models that support it */}
                      {(selectedRunwayModel === "gen4_turbo" || selectedRunwayModel === "gen4_aleph" || selectedRunwayModel === "gen3a_turbo" || selectedRunwayModel === "act_two") && (
                      <div className="grid gap-2">
                          <Label>
                            {selectedRunwayModel === "act_two" ? "Upload Video" : "Upload Image (Optional)"}
                          </Label>
                          <div className="border-2 border-dashed border-border rounded-lg p-4">
                            <input
                              type="file"
                              accept={selectedRunwayModel === "act_two" ? "video/*" : "image/*"}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  setUploadedFile(file)
                                  const reader = new FileReader()
                                  reader.onload = (e) => {
                                    setFilePreview(e.target?.result as string)
                                  }
                                  reader.readAsDataURL(file)
                                }
                              }}
                              className="hidden"
                              id="file-upload"
                            />
                            <label
                              htmlFor="file-upload"
                              className="cursor-pointer flex flex-col items-center gap-2"
                            >
                              {filePreview ? (
                                <div className="relative">
                                  {selectedRunwayModel === "act_two" ? (
                                    <video
                                      src={filePreview}
                                      className="max-w-full max-h-32 rounded"
                                      controls
                                    />
                                  ) : (
                                    <img
                                      src={filePreview}
                                      alt="Preview"
                                      className="max-w-full max-h-32 rounded object-cover"
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      setUploadedFile(null)
                                      setFilePreview(null)
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <Upload className="h-8 w-8 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">
                                    {selectedRunwayModel === "act_two" 
                                      ? "Click to upload a video file" 
                                      : "Click to upload an image file (optional)"}
                                  </span>
                                </>
                              )}
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Optional Settings - Only show when expanded */}
                      {showMoreOptions && (
                        <>
                          {/* Optional Video Style */}
                          <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                              <Label>Video Style (Optional)</Label>
                              <Switch
                                checked={useVideoStyle}
                                onCheckedChange={setUseVideoStyle}
                              />
                            </div>
                            {useVideoStyle && (
                        <Select value={selectedVideoStyle} onValueChange={setSelectedVideoStyle}>
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue placeholder="Choose video style" />
                          </SelectTrigger>
                          <SelectContent className="cinema-card border-border">
                            <SelectItem value="cinematic">Cinematic</SelectItem>
                            <SelectItem value="realistic">Realistic</SelectItem>
                            <SelectItem value="artistic">Artistic</SelectItem>
                            <SelectItem value="documentary">Documentary</SelectItem>
                            <SelectItem value="fantasy">Fantasy</SelectItem>
                            <SelectItem value="sci-fi">Sci-Fi</SelectItem>
                            <SelectItem value="vintage">Vintage</SelectItem>
                            <SelectItem value="modern">Modern</SelectItem>
                          </SelectContent>
                        </Select>
                            )}
                      </div>

                          {/* Optional Camera Movement */}
                      <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                              <Label>Camera Movement (Optional)</Label>
                              <Switch
                                checked={useCameraMovement}
                                onCheckedChange={setUseCameraMovement}
                              />
                            </div>
                            {useCameraMovement && (
                        <Select value={selectedCameraMovement} onValueChange={setSelectedCameraMovement}>
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue placeholder="Select camera movement" />
                          </SelectTrigger>
                          <SelectContent className="cinema-card border-border">
                            <SelectItem value="static">Static</SelectItem>
                            <SelectItem value="pan-left">Pan Left</SelectItem>
                            <SelectItem value="pan-right">Pan Right</SelectItem>
                            <SelectItem value="pan-up">Pan Up</SelectItem>
                            <SelectItem value="pan-down">Pan Down</SelectItem>
                            <SelectItem value="zoom-in">Zoom In</SelectItem>
                            <SelectItem value="zoom-out">Zoom Out</SelectItem>
                            <SelectItem value="dolly-in">Dolly In</SelectItem>
                            <SelectItem value="dolly-out">Dolly Out</SelectItem>
                            <SelectItem value="tilt-up">Tilt Up</SelectItem>
                            <SelectItem value="tilt-down">Tilt Down</SelectItem>
                          </SelectContent>
                        </Select>
                            )}
                      </div>

                          {/* Optional Lighting */}
                      <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                              <Label>Lighting (Optional)</Label>
                              <Switch
                                checked={useLighting}
                                onCheckedChange={setUseLighting}
                              />
                            </div>
                            {useLighting && (
                        <Select value={selectedLighting} onValueChange={setSelectedLighting}>
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue placeholder="Choose lighting" />
                          </SelectTrigger>
                          <SelectContent className="cinema-card border-border">
                            <SelectItem value="natural">Natural</SelectItem>
                            <SelectItem value="dramatic">Dramatic</SelectItem>
                            <SelectItem value="soft">Soft</SelectItem>
                            <SelectItem value="harsh">Harsh</SelectItem>
                            <SelectItem value="warm">Warm</SelectItem>
                            <SelectItem value="cool">Cool</SelectItem>
                            <SelectItem value="golden-hour">Golden Hour</SelectItem>
                            <SelectItem value="blue-hour">Blue Hour</SelectItem>
                            <SelectItem value="studio">Studio</SelectItem>
                            <SelectItem value="low-key">Low Key</SelectItem>
                            <SelectItem value="high-key">High Key</SelectItem>
                          </SelectContent>
                        </Select>
                            )}
                      </div>
                        </>
                      )}
                    </>
                  )}

                  {/* AI Model Selection - Only show if not locked */}
                  {!isCurrentTabLocked() && (
                    <div className="grid gap-2">
                      <Label>AI Model</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select AI model" />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          {aiModels.video.map((model) => {
                            let isReady = false
                            let statusText = ""
                            
                            if (model.startsWith("Runway") || model === "Runway ML") {
                              isReady = !!userApiKeys.runway_api_key
                              statusText = isReady ? "Ready" : "Runway ML API Key Required"
                            } else if (model === "Kling") {
                              isReady = !!userApiKeys.kling_api_key
                              statusText = isReady ? "Ready" : "Kling API Key Required"
                            } else {
                              isReady = false
                              statusText = "Coming Soon"
                            }
                            
                            return (
                              <SelectItem key={model} value={model} disabled={!isReady}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{model}</span>
                                  <Badge variant={isReady ? "default" : "secondary"} className="text-xs ml-2">
                                    {statusText}
                                  </Badge>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      
                      {(selectedModel.startsWith("Runway") || selectedModel === "Runway ML") && !userApiKeys.runway_api_key && (
                        <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                          <p className="text-sm text-orange-600">
                            <AlertCircle className="h-4 w-4 inline mr-2" />
                            Runway ML API key required. <Link href="/setup-ai" className="underline">Configure now</Link>
                          </p>
                          <p className="text-xs text-orange-500 mt-1">
                            Get your API key from <a href="https://runwayml.com/api" target="_blank" rel="noopener noreferrer" className="underline">Runway ML's API page</a>
                          </p>
                        </div>
                      )}
                      
                      {(selectedModel.startsWith("Runway") || selectedModel === "Runway ML") && userApiKeys.runway_api_key && (
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <p className="text-sm text-blue-600">
                            <CheckCircle className="h-4 w-4 inline mr-2" />
                            Runway ML API key configured
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                console.log('🧪 Testing Runway ML API connection...')
                                const { RunwayMLService } = await import('@/lib/ai-services')
                                const result = await RunwayMLService.testApiConnection(userApiKeys.runway_api_key!)
                                
                                if (result.success) {
                                  toast({
                                    title: "API Connection Test",
                                    description: "✅ Runway ML API connection successful!",
                                    variant: "default",
                                  })
                                } else {
                                  toast({
                                    title: "API Connection Test",
                                    description: `❌ Connection failed: ${result.error}`,
                                    variant: "destructive",
                                  })
                                }
                              } catch (error) {
                                console.error('🧪 Runway ML API test error:', error)
                                toast({
                                  title: "API Connection Test",
                                  description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                  variant: "destructive",
                                })
                              }
                            }}
                            className="mt-2 text-xs"
                          >
                            Test API Connection
                          </Button>
                        </div>
                      )}
                      
                      {selectedModel === "Kling" && !userApiKeys.kling_api_key && (
                        <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                          <p className="text-sm text-orange-600">
                            <AlertCircle className="h-4 w-4 inline mr-2" />
                            Kling API key required. <Link href="/setup-ai" className="underline">Configure now</Link>
                          </p>
                        </div>
                      )}
                      
                      {selectedModel === "Kling" && userApiKeys.kling_api_key && (
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <p className="text-sm text-blue-600">
                            <CheckCircle className="h-4 w-4 inline mr-2" />
                            Kling API key configured
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                console.log('🧪 Testing Kling API connection...')
                                const { KlingService } = await import('@/lib/ai-services')
                                const result = await KlingService.testApiConnection(userApiKeys.kling_api_key!)
                                
                                if (result.success) {
                                  toast({
                                    title: "API Connection Test",
                                    description: "✅ Kling API connection successful!",
                                    variant: "default",
                                  })
                                } else {
                                  toast({
                                    title: "API Connection Test",
                                    description: `❌ Connection failed: ${result.error}`,
                                    variant: "destructive",
                                  })
                                }
                              } catch (error) {
                                console.error('🧪 Kling API test error:', error)
                                toast({
                                  title: "API Connection Test",
                                  description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                  variant: "destructive",
                                })
                              }
                            }}
                            className="mt-2 text-xs"
                          >
                            Test API Connection
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show locked model info if tab is locked */}
                  {isCurrentTabLocked() && (
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        AI Online
                      </p>
                    </div>
                  )}

                  {/* Show Runway sub-options when Runway ML is locked */}
                  {isCurrentTabLocked() && getCurrentTabLockedModel() === "Runway ML" && (
                    <div className="grid gap-2">
                      <Label>Model</Label>
                      <Select value={selectedRunwayModel} onValueChange={setSelectedRunwayModel}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select Runway model" />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          <SelectItem value="act_two">Act-Two (Video → Video, up to 30s, 720p)</SelectItem>
                          <SelectItem value="gen3a_turbo">Gen-3A Turbo (Text/Image → Video, 5s/10s, 720p)</SelectItem>
                          <SelectItem value="gen4_turbo">Gen-4 Turbo (Text/Image → Video, 5s/10s, 720p)</SelectItem>
                          <SelectItem value="gen4_aleph">Gen-4 Aleph (Text/Image → Video, 5s/10s, 720p)</SelectItem>
                          <SelectItem value="upscale_v1">Upscale (Video → 4K, up to 30s)</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Pricing display */}
                      <div className="text-xs text-muted-foreground">
                        {selectedRunwayModel === "gen4_turbo" && "5 credits per second"}
                        {selectedRunwayModel === "gen4_aleph" && "5 credits per second"}
                        {selectedRunwayModel === "gen3a_turbo" && "5 credits per second"}
                        {selectedRunwayModel === "act_two" && "5 credits per second"}
                        {selectedRunwayModel === "upscale_v1" && "2 credits per second"}
                      </div>
                    </div>
                  )}

                  {/* Resolution - Show for Runway models */}
                  {(selectedModel.startsWith("Runway") || selectedModel === "Runway ML") && (
                    <div className="grid gap-2">
                      <Label>Resolution</Label>
                      <Select value={selectedResolution} onValueChange={setSelectedResolution}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select resolution" />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          {/* Gen-4 Turbo and Aleph resolutions */}
                          {(selectedRunwayModel === "gen4_turbo" || selectedRunwayModel === "gen4_aleph" || selectedRunwayModel === "gen3a_turbo") && (
                            <>
                              <SelectItem value="1280x720">16:9 (1280x720)</SelectItem>
                              <SelectItem value="720x1280">9:16 (720x1280)</SelectItem>
                              <SelectItem value="1104x832">4:3 (1104x832)</SelectItem>
                              <SelectItem value="832x1104">3:4 (832x1104)</SelectItem>
                              <SelectItem value="960x960">1:1 (960x960)</SelectItem>
                              <SelectItem value="1584x672">21:9 (1584x672)</SelectItem>
                            </>
                          )}
                          
                          {/* Act-Two resolutions - may have different supported resolutions */}
                          {selectedRunwayModel === "act_two" && (
                            <>
                              <SelectItem value="1280x720">16:9 (1280x720)</SelectItem>
                              <SelectItem value="720x1280">9:16 (720x1280)</SelectItem>
                              <SelectItem value="1104x832">4:3 (1104x832)</SelectItem>
                              <SelectItem value="832x1104">3:4 (832x1104)</SelectItem>
                              <SelectItem value="960x960">1:1 (960x960)</SelectItem>
                              <SelectItem value="1584x672">21:9 (1584x672)</SelectItem>
                            </>
                          )}
                          
                          {/* Upscale - no resolution selection needed */}
                          {selectedRunwayModel === "upscale_v1" && (
                            <SelectItem value="auto">Auto (Upscales to 4K)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label>Prompt</Label>
                    <Textarea
                      id="video-prompt"
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      placeholder="Describe the video you want to generate..."
                      className="bg-input border-border min-h-32"
                    />
                  </div>

                  {isGenerating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Generating...</span>
                        <span>{generationProgress}%</span>
                      </div>
                      <Progress value={generationProgress} className="w-full" />
                    </div>
                  )}

                  <Button
                    onClick={() => {
                      console.log('🎬 Video generation button clicked')
                      console.log('🎬 Current state:', {
                        isGenerating,
                        videoPrompt: videoPrompt?.length || 0,
                        selectedModel,
                        hasRunwayKey: !!userApiKeys.runway_api_key,
                        hasKlingKey: !!userApiKeys.kling_api_key,
                        runwayKeyLength: userApiKeys.runway_api_key?.length || 0,
                        klingKeyLength: userApiKeys.kling_api_key?.length || 0,
                        runwayKeyPrefix: userApiKeys.runway_api_key?.substring(0, 10) + '...',
                        klingKeyPrefix: userApiKeys.kling_api_key?.substring(0, 10) + '...'
                      })
                      
                      // Validate form before submission
                      if (!videoPrompt) {
                        toast({
                          title: "Missing Prompt",
                          description: "Please enter a video prompt",
                          variant: "destructive",
                        })
                        return
                      }
                      
                      if (!selectedModel) {
                        toast({
                          title: "Missing Model",
                          description: "Please select an AI model",
                          variant: "destructive",
                        })
                        return
                      }
                      
                      if ((selectedModel.startsWith("Runway") || selectedModel === "Runway ML") && !userApiKeys.runway_api_key) {
                        toast({
                          title: "Missing API Key",
                          description: "Please configure your Runway ML API key",
                          variant: "destructive",
                        })
                        return
                      }
                      
                      if (selectedModel === "Kling" && !userApiKeys.kling_api_key) {
                        toast({
                          title: "Missing API Key",
                          description: "Please configure your Kling API key",
                          variant: "destructive",
                        })
                        return
                      }
                      
                      handleGenerate("video")
                    }}
                    disabled={
                      isGenerating || 
                      !videoPrompt || 
                      !selectedModel ||
                      ((selectedModel.startsWith("Runway") || selectedModel === "Runway ML") && !userApiKeys.runway_api_key) ||
                      (selectedModel === "Kling" && !userApiKeys.kling_api_key)
                    }
                    className="w-full gradient-button text-white"
                  >
                    {isGenerating ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate Video
                  </Button>
                  

                </CardContent>
              </Card>

              {/* Generated Videos */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Generated Videos</CardTitle>
                  <CardDescription>Your recent video generations</CardDescription>
                  {selectedProject && (
                    <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
                      ✅ Will save to project: <strong>{movies.find((m) => m.id.toString() === selectedProject)?.name}</strong>
                    </div>
                  )}
                  {!selectedProject && (
                    <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-2">
                      ⚠️ Select a project above to save videos to your library
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {generatedContent
                      .filter(item => item.type === 'video')
                      .map((video) => (
                      <Card key={video.id} className="bg-muted/50 border-border">
                        <CardContent className="p-4">
                          <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-muted flex items-center justify-center">
                            {video.url ? (
                              <video 
                                src={video.url} 
                                className="w-full h-full object-cover"
                                controls
                                preload="metadata"
                              />
                            ) : video.status === 'processing' ? (
                              <div className="text-center">
                                <RefreshCw className="h-8 w-8 text-blue-500 mx-auto mb-2 animate-spin" />
                                <p className="text-sm text-blue-500">Generating Video...</p>
                              </div>
                            ) : (
                              <div className="text-center">
                                <Play className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Video Preview</p>
                              </div>
                            )}
                          </div>
                          <h4 className="text-sm font-medium mb-1">{video.title}</h4>
                          <p className="text-xs text-muted-foreground mb-2">{video.prompt}</p>
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline" className="text-xs">
                              {video.duration}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {video.model}
                            </Badge>
                          </div>

                          {selectedProject && scenes.length > 0 && (
                            <div className="mb-3">
                              <label className="text-xs font-medium mb-1 block">Link to Scene:</label>
                              <Select 
                                value={video.scene_id || selectedScene !== 'none' ? selectedScene : 'none'} 
                                onValueChange={(sceneId) => handleLinkToScene(video, "video", sceneId)}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Link to scene" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none" className="text-xs">
                                    No specific scene
                                  </SelectItem>
                                  {scenes.map((scene) => (
                                    <SelectItem key={scene.id} value={scene.id} className="text-xs">
                                      Scene {scene.start_time_seconds}s: {scene.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs bg-transparent"
                              onClick={() => video.url && window.open(video.url, '_blank')}
                              disabled={!video.url}
                            >
                              <Play className="mr-1 h-3 w-3" />
                              Play
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs bg-transparent"
                              onClick={() => video.url && handleDownloadVideo(video.url, video.title)}
                              disabled={!video.url}
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </Button>
                            {video.saved ? (
                              <Button size="sm" variant="outline" className="text-xs bg-green-500/20 text-green-500 border-green-500/30" disabled>
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Saved
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveToLibrary(video, "video")}
                                className="text-xs"
                              >
                                <Save className="mr-1 h-3 w-3" />
                                Save
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Audio Generation */}
          <TabsContent value="audio" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Generation Panel */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Audio Generator</CardTitle>
                  <CardDescription>Create music, sound effects, and audio tracks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Audio Type</Label>
                    <Select value={selectedAudioType} onValueChange={setSelectedAudioType}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Choose audio type" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="music">Background Music</SelectItem>
                        <SelectItem value="sfx">Sound Effects</SelectItem>
                        <SelectItem value="ambient">Ambient Sounds</SelectItem>
                        <SelectItem value="dialogue">Voice Generation</SelectItem>
                        <SelectItem value="score">Film Score</SelectItem>
                        <SelectItem value="foley">Foley Sounds</SelectItem>
                        <SelectItem value="atmosphere">Atmospheric Audio</SelectItem>
                        <SelectItem value="transition">Audio Transitions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Scene Scripts Dropdown - Only show if scene is selected */}
                  {selectedScene && selectedScene !== 'none' && (
                    <div className="grid gap-2">
                      <Label>Scene Scripts</Label>
                      <Select value={selectedSceneScript} onValueChange={setSelectedSceneScript}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select a script to reference..." />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          {isLoadingSceneScripts ? (
                            <SelectItem value="loading" disabled>
                              <div className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Loading scripts...
                              </div>
                            </SelectItem>
                          ) : sceneScripts.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No scripts found in this scene
                            </SelectItem>
                          ) : (
                            <>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">No script selected</span>
                              </SelectItem>
                              {sceneScripts.map((script) => (
                                <SelectItem key={script.id} value={script.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{script.title}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {script.version_name || `Version ${script.version}`} • {new Date(script.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      
                      {/* Show selected script preview */}
                      {selectedSceneScript && sceneScripts.find(s => s.id === selectedSceneScript) && (
                        <div className="p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Selected Script:</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedSceneScript("none")}
                              className="h-6 px-2 text-xs"
                            >
                              Clear
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground max-h-16 overflow-y-auto">
                            {sceneScripts.find(s => s.id === selectedSceneScript)?.content?.substring(0, 150)}
                            {sceneScripts.find(s => s.id === selectedSceneScript)?.content && 
                             sceneScripts.find(s => s.id === selectedSceneScript)?.content.length > 150 && '...'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Model Selection - Only show if not locked */}
                  {!isCurrentTabLocked() && (
                    <div className="grid gap-2">
                      <Label>AI Model</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select AI model" />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          {aiModels.audio.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Show locked model info if tab is locked */}
                  {isCurrentTabLocked() && (
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        AI Online
                      </p>
                    </div>
                  )}

                  {selectedModel === "ElevenLabs" && !userApiKeys.elevenlabs_api_key && (
                    <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <p className="text-sm text-orange-600">
                        <AlertCircle className="h-4 w-4 inline mr-2" />
                        ElevenLabs API key required. <Link href="/setup-ai" className="underline">Configure now</Link> or <Link href="https://elevenlabs.io/" target="_blank" className="underline">get your API key</Link>
                      </p>
                    </div>
                  )}
                  
                  {selectedModel === "ElevenLabs" && userApiKeys.elevenlabs_api_key && (
                    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <p className="text-sm text-blue-600">
                        <CheckCircle className="h-4 w-4 inline mr-2" />
                        ElevenLabs API key configured
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            console.log('🧪 Testing ElevenLabs API connection...')
                            const { ElevenLabsService } = await import('@/lib/ai-services')
                            const result = await ElevenLabsService.testApiConnection(userApiKeys.elevenlabs_api_key!)
                            
                            if (result.success) {
                              toast({
                                title: "API Connection Test",
                                description: "✅ ElevenLabs API connection successful!",
                                variant: "default",
                              })
                            } else {
                              toast({
                                title: "API Connection Test",
                                description: `❌ Connection failed: ${result.error}`,
                                variant: "destructive",
                              })
                            }
                          } catch (error) {
                            console.error('🧪 ElevenLabs API test error:', error)
                            toast({
                              title: "API Connection Test",
                              description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                              variant: "destructive",
                            })
                          }
                        }}
                        className="mt-2 text-xs"
                      >
                        Test API Connection
                          </Button>
                        </div>
                      )}

                  {selectedModel === "Suno AI" && !userApiKeys.openai_api_key && (
                    <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <p className="text-sm text-orange-600">
                        <AlertCircle className="h-4 w-4 inline mr-2" />
                        Suno AI API key required. <Link href="/setup-ai" className="underline">Configure now</Link> or <Link href="https://suno.ai/" target="_blank" className="underline">get your API key</Link>
                      </p>
                    </div>
                  )}
                  
                  {selectedModel === "Suno AI" && userApiKeys.openai_api_key && (
                    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <p className="text-sm text-blue-600">
                        <CheckCircle className="h-4 w-4 inline mr-2" />
                        Suno AI API key configured (using OpenAI key)
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            console.log('🧪 Testing Suno AI API connection...')
                            const { SunoAIService } = await import('@/lib/ai-services')
                            const result = await SunoAIService.testApiConnection(userApiKeys.openai_api_key!)
                            
                            if (result.success) {
                              toast({
                                title: "API Connection Test",
                                description: "✅ Suno AI API connection successful!",
                                variant: "default",
                              })
                            } else {
                              toast({
                                title: "API Connection Test",
                                description: `❌ Connection failed: ${result.error}`,
                                variant: "destructive",
                              })
                            }
                          } catch (error) {
                            console.error('🧪 Suno AI API test error:', error)
                            toast({
                              title: "API Connection Test",
                              description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                              variant: "destructive",
                            })
                          }
                        }}
                        className="mt-2 text-xs"
                      >
                        Test API Connection
                      </Button>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label>Duration</Label>
                    <Select value={selectedAudioDuration} onValueChange={setSelectedAudioDuration}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="15s">15 seconds</SelectItem>
                        <SelectItem value="30s">30 seconds</SelectItem>
                        <SelectItem value="1m">1 minute</SelectItem>
                        <SelectItem value="2m">2 minutes</SelectItem>
                        <SelectItem value="5m">5 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedModel === "ElevenLabs" && (
                    <div className="grid gap-2">
                      <Label>Voice</Label>
                      <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select voice" />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          <SelectItem value="21m00Tcm4TlvDq8ikWAM">Rachel (Female, Warm)</SelectItem>
                          <SelectItem value="AZnzlk1XvdvUeBnXmlld">Domi (Female, Strong)</SelectItem>
                          <SelectItem value="EXAVITQu4vr4xnSDxMaL">Bella (Female, Soft)</SelectItem>
                          <SelectItem value="VR6AewLTigWG4xSOukaG">Arnold (Male, Deep)</SelectItem>
                          <SelectItem value="pNInz6obpgDQGcFmaJgB">Adam (Male, Clear)</SelectItem>
                          <SelectItem value="yoZ06aMxZJJ28mfd3POQ">Josh (Male, Casual)</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Voice Preview Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVoicePreview(selectedVoice)}
                        className="text-xs"
                        disabled={false}
                      >
                        <Play className="mr-1 h-3 w-3" />
                        Preview Voice
                      </Button>
                    </div>
                  )}

                  {/* Voice Cloning Section */}
                  {selectedModel === "ElevenLabs" && (
                    <div className="border border-border rounded-lg p-4 bg-muted/30">
                      <Label className="text-sm font-medium mb-2 block">Voice Cloning</Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Create a custom voice by uploading audio samples (5-10 seconds each, clear speech)
                      </p>
                      
                      <div className="space-y-3">
                        <Input
                          placeholder="Voice name (e.g., 'My Character')"
                          value={cloningVoiceName}
                          onChange={(e) => setCloningVoiceName(e.target.value)}
                          className="text-xs"
                        />
                        <Input
                          placeholder="Voice description (e.g., 'Young female protagonist')"
                          value={cloningVoiceDescription}
                          onChange={(e) => setCloningVoiceDescription(e.target.value)}
                          className="text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="audio/*"
                            multiple
                            onChange={(e) => setCloningVoiceFiles(Array.from(e.target.files || []))}
                            className="text-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCloneVoice}
                            disabled={!cloningVoiceName || cloningVoiceFiles.length === 0 || false}
                            className="text-xs"
                          >
                            <Bot className="mr-1 h-3 w-3" />
                            Clone Voice
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custom Voices Management */}
                  {selectedModel === "ElevenLabs" && (
                    <div className="border border-border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-sm font-medium">Your Custom Voices</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRefreshCustomVoices}
                          className="text-xs"
                          disabled={false}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Refresh
                        </Button>
                      </div>
                      
                      {customVoices.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No custom voices yet. Create one above!
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {customVoices.map((voice) => (
                            <div key={voice.voice_id} className="flex items-center justify-between p-2 bg-background/50 rounded border">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{voice.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{voice.description}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVoicePreview(voice.voice_id)}
                                  className="text-xs h-6 px-2"
                                >
                                  <Play className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteCustomVoice(voice.voice_id)}
                                  className="text-xs h-6 px-2 text-red-500 hover:text-red-600"
                                >
                                  <AlertCircle className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label>Prompt</Label>
                    <Textarea
                      id="audio-prompt"
                      value={audioPrompt}
                      onChange={(e) => setAudioPrompt(e.target.value)}
                      placeholder="Describe the audio you want to generate..."
                      className="bg-input border-border min-h-32"
                    />
                  </div>

                  {isGenerating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Generating...</span>
                        <span>{generationProgress}%</span>
                      </div>
                      <Progress value={generationProgress} className="w-full" />
                    </div>
                  )}

                  <Button
                    onClick={() => handleGenerate("audio")}
                    disabled={
                      isGenerating || 
                      !audioPrompt || 
                      !selectedProject || 
                      !selectedModel ||
                      (selectedModel === "ElevenLabs" && false) ||
                      (selectedModel === "Suno AI" && false)
                    }
                    className="w-full gradient-button text-white"
                  >
                    {isGenerating ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate Audio
                  </Button>
                </CardContent>
              </Card>

              {/* Generated Audio */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Generated Audio</CardTitle>
                  <CardDescription>Your recent audio generations</CardDescription>
                  {selectedProject && (
                    <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
                      ✅ Will save to project: <strong>{movies.find((m) => m.id.toString() === selectedProject)?.name}</strong>
                    </div>
                  )}
                  {!selectedProject && (
                    <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-2">
                      ⚠️ Select a project above to save audio to your library
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {generatedContent
                      .filter(item => item.type === 'audio')
                      .map((audio) => (
                      <Card key={audio.id} className="bg-muted/50 border-border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium">
                              {audio.title}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {audio.model}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            {audio.prompt}
                          </p>
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant="outline" className="text-xs">
                              {audio.duration}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {audio.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs bg-transparent"
                              onClick={() => {
                                if (audio.url) {
                                  const audioElement = new Audio(audio.url)
                                  audioElement.play().catch(e => console.log('Play failed:', e))
                                }
                              }}
                            >
                              <Play className="mr-1 h-3 w-3" />
                              Play
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs bg-transparent"
                              onClick={() => {
                                if (audio.url) {
                                  // Create a download link for the audio
                                  const link = document.createElement('a')
                                  link.href = audio.url
                                  link.download = `${audio.title || 'generated-audio'}.mp3`
                                  document.body.appendChild(link)
                                  link.click()
                                  document.body.removeChild(link)
                                }
                              }}
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </Button>
                            {audio.saved ? (
                              <Button size="sm" variant="outline" className="text-xs bg-green-500/20 text-green-500 border-green-500/30" disabled>
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Saved
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveToLibrary(audio, "audio")}
                                className="text-xs"
                              >
                                <Save className="mr-1 h-3 w-3" />
                                Save
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Save Confirmation Modal */}
        <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save to Library</DialogTitle>
              <DialogDescription>
                Save this content to your asset library.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmSave} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Content Violation Dialog */}
        <ContentViolationDialog
          isOpen={showContentViolationDialog}
          onClose={() => setShowContentViolationDialog(false)}
          onTryDifferentPrompt={handleTryDifferentPrompt}
          onTryDifferentAI={handleTryDifferentAI}
          contentType={contentViolationData?.type || 'script'}
          originalPrompt={contentViolationData?.prompt || ''}
        />
      </main>
    </div>
  )
}
