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
import { useAuth } from "@/lib/auth-context-fixed"
import { OpenAIService } from "@/lib/openai-service"
import { MovieService, Movie } from "@/lib/movie-service"
import { TimelineService } from "@/lib/timeline-service"
import { AssetService } from "@/lib/asset-service"
import { AISettingsService, AISetting } from "@/lib/ai-settings-service"
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
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"

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
}

const aiModels = {
  script: ["ChatGPT", "Claude", "GPT-4", "Gemini", "Custom"],
  image: ["OpenArt", "DALL-E 3", "Midjourney", "Stable Diffusion", "Custom"],
  video: ["Kling", "Runway ML", "Pika Labs", "Stable Video", "LumaAI"],
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

const handleLinkToScene = (item: any, type: string, sceneId: string) => {
  console.log(`Linking ${item.title} to scene ${sceneId}`)
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
  const [selectedDuration, setSelectedDuration] = useState("10s")
  const [selectedVideoStyle, setSelectedVideoStyle] = useState("cinematic")
  const [selectedCameraMovement, setSelectedCameraMovement] = useState("static")
  const [selectedLighting, setSelectedLighting] = useState("natural")
  const [selectedResolution, setSelectedResolution] = useState("1024x576")
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

  const { toast } = useToast()

  // Real data state
  const [movies, setMovies] = useState<Movie[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  const { user } = useAuth()

  // Debug logging
  console.log("AI Studio - User:", user)
  console.log("AI Studio - OpenAI API Key:", user?.openaiApiKey ? "Available" : "Not available")

  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!user) return
      
      try {
        const settings = await AISettingsService.getUserSettings(user.id)
        
        // Ensure default settings exist for all tabs
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'scripts'),
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'images'),
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'videos'),
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'audio')
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
  }, [user])

  // Auto-select locked models when AI settings change
  useEffect(() => {
    if (aiSettings.length > 0 && activeTab) {
      const currentSetting = aiSettings.find(setting => setting.tab_type === activeTab)
      if (currentSetting?.is_locked) {
        console.log(`Setting locked model for ${activeTab}:`, currentSetting.locked_model)
        setSelectedModel(currentSetting.locked_model)
      }
    }
  }, [aiSettings, activeTab])

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
    setSelectedDuration("10s")
    setSelectedVideoStyle("cinematic")
    setSelectedCameraMovement("static")
    setSelectedLighting("natural")
    setSelectedResolution("1024x576")
    setSelectedAudioType("music")
    setSelectedAudioDuration("30s")
    setSelectedVoice("21m00Tcm4TlvDq8ikWAM")
    setCloningVoiceName("")
    setCloningVoiceDescription("")
    setCloningVoiceFiles([])
    setCustomVoices([])
  }, [activeTab])

  // Load real data from database
  useEffect(() => {
    const loadData = async () => {
      if (!user) return
      
      try {
        setIsLoadingData(true)
        
        // Load user's movies
        const userMovies = await MovieService.getMovies()
        setMovies(userMovies)
        
        // Load generated content (we'll implement this later)
        setGeneratedContent([
          {
            id: "1",
            title: "Sample Script - Opening Scene",
            content: "FADE IN:\n\nEXT. NEO TOKYO STREETS - NIGHT\n\nNeon lights reflect off wet pavement as a lone figure walks through the rain...",
            prompt: "Write an opening scene for a cyberpunk movie",
            type: 'script',
            model: 'ChatGPT',
            created_at: new Date().toISOString(),
          },
          {
            id: "2", 
            title: "Sample Image - Cyberpunk City",
            prompt: "Futuristic cyberpunk city at night with neon lights and flying cars",
            type: 'image',
            model: 'DALL-E 3',
            created_at: new Date().toISOString(),
            url: "/cyberpunk-city-concept.png"
          }
        ])
        
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadData()
  }, [user])

  // Load scenes when project is selected
  useEffect(() => {
    const loadScenes = async () => {
      if (!selectedProject || !user) return
      
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
  }, [selectedProject, user])

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
    if (!user) {
      alert("Please log in to use AI features")
      return
    }
    
    if (type === "script" && selectedModel === "ChatGPT" && !user.openaiApiKey) {
      alert("Please set up your OpenAI API key first")
      return
    }
    
    if (type === "image" && selectedModel === "DALL-E 3" && !user.openaiApiKey) {
      alert("Please set up your OpenAI API key first")
      return
    }
    
    if (type === "video" && selectedModel === "Runway ML" && !user.runwayApiKey) {
      alert("Please set up your Runway ML API key first")
      return
    }
    
    if (type === "video" && selectedModel === "Kling" && !user.klingApiKey) {
      alert("Please set up your Kling API key first")
      return
    }
    
    if (type === "audio" && selectedModel === "ElevenLabs" && !user.elevenlabsApiKey) {
      alert("Please set up your ElevenLabs API key first")
      return
    }
    
    if (type === "audio" && selectedModel === "Suno AI" && !user.sunoApiKey) {
      alert("Please set up your Suno AI API key first")
      return
    }

    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      if (type === "script" && selectedModel === "ChatGPT") {
        console.log('Attempting to generate script with:', {
          prompt: scriptPrompt,
          template: selectedTemplate || "Write a creative script based on:",
          apiKeyLength: user.openaiApiKey?.length || 0,
          apiKeyPrefix: user.openaiApiKey?.substring(0, 7) || 'None'
        })
        
        // First validate the API key
        console.log('Validating API key...')
        const isValid = await OpenAIService.validateApiKey(user.openaiApiKey!)
        console.log('API key validation result:', isValid)
        
        if (!isValid) {
          alert('Your OpenAI API key appears to be invalid. Please check your setup.')
          setIsGenerating(false)
          return
        }
        
                  const response = await OpenAIService.generateScript({
            prompt: scriptPrompt,
            template: selectedTemplate || "Write a creative script based on:",
            apiKey: user.openaiApiKey!,
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
          alert(`Error generating script: ${response.error}`)
        }
      } else if (type === "image" && selectedModel === "DALL-E 3") {
        console.log('Attempting to generate image with:', {
          prompt: imagePrompt,
          style: selectedStyle || "Cinematic",
          apiKeyLength: user.openaiApiKey?.length || 0,
          apiKeyPrefix: user.openaiApiKey?.substring(0, 7) || 'None'
        })
        
        // First validate the API key
        console.log('Validating API key for image generation...')
        const isValid = await OpenAIService.validateApiKey(user.openaiApiKey!)
        console.log('API key validation result:', isValid)
        
        if (!isValid) {
          alert('Your OpenAI API key appears to be invalid. Please check your setup.')
          setIsGenerating(false)
          return
        }
        
        const response = await OpenAIService.generateImage({
          prompt: imagePrompt,
          style: selectedStyle || "Cinematic",
          apiKey: user.openaiApiKey!,
        })

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
            url: response.data.data?.[0]?.url,
          }
          
          setGeneratedContent(prev => [newContent, ...prev])
          setImagePrompt("") // Clear the prompt after successful generation
        } else {
          alert(`Error generating image: ${response.error}`)
        }
              } else if (type === "video" && selectedModel === "Runway ML") {
          console.log('Attempting to generate video with Runway ML:', {
            prompt: videoPrompt,
            duration: "10s", // Default duration
            apiKeyLength: user.runwayApiKey?.length || 0,
            apiKeyPrefix: user.runwayApiKey?.substring(0, 7) || 'None'
          })
          
          // Import the RunwayML service
          const { RunwayMLService } = await import('@/lib/ai-services')
          
          // First validate the API key
          console.log('Validating Runway ML API key...')
          const isValid = await RunwayMLService.validateApiKey(user.runwayApiKey!)
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
          
          // Build enhanced prompt with all the selected options
          let enhancedPrompt = videoPrompt
          if (selectedVideoStyle !== "cinematic") {
            enhancedPrompt += `, ${selectedVideoStyle} style`
          }
          if (selectedCameraMovement !== "static") {
            enhancedPrompt += `, camera ${selectedCameraMovement}`
          }
          if (selectedLighting !== "natural") {
            enhancedPrompt += `, ${selectedLighting} lighting`
          }
          
          console.log('Enhanced prompt for Runway ML:', enhancedPrompt)
          
          const response = await RunwayMLService.generateVideo({
            prompt: enhancedPrompt,
            duration: selectedDuration,
            model: selectedModel,
            apiKey: user.runwayApiKey!,
            resolution: selectedResolution,
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
            
            // Show success toast
            toast({
              title: "Video Generated!",
              description: "Your video has been created successfully.",
              variant: "default",
            })
          } else {
            console.error('Runway ML video generation failed:', response.error)
            toast({
              title: "Video Generation Failed",
              description: `Error: ${response.error}. Please check your Runway ML API key and try again.`,
              variant: "destructive",
            })
          }
        } else if (type === "video" && selectedModel === "Kling") {
          console.log('Attempting to generate video with Kling:', {
            prompt: videoPrompt,
            duration: "10s", // Default duration
            apiKeyLength: user.klingApiKey?.length || 0,
            apiKeyPrefix: user.klingApiKey?.substring(0, 7) || 'None'
          })
          
          // Import the Kling service
          const { KlingService } = await import('@/lib/ai-services')
          
          const response = await KlingService.generateVideo({
            prompt: videoPrompt,
            duration: "10s",
            model: selectedModel,
            apiKey: user.klingApiKey!,
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
            alert(`Error generating video: ${response.error}`)
          }
        } else if (type === "audio" && selectedModel === "ElevenLabs") {
          console.log('Attempting to generate audio with ElevenLabs:', {
            prompt: audioPrompt,
            type: selectedAudioType,
            duration: selectedAudioDuration,
            voice: selectedVoice,
            apiKeyLength: user.elevenlabsApiKey?.length || 0,
            apiKeyPrefix: user.elevenlabsApiKey?.substring(0, 7) || 'None'
          })
          
          // Import the ElevenLabs service
          const { ElevenLabsService } = await import('@/lib/ai-services')
          
          // First validate the API key
          console.log('Validating ElevenLabs API key...')
          const isValid = await ElevenLabsService.validateApiKey(user.elevenlabsApiKey!)
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
          
          // Build enhanced prompt based on audio type
          let enhancedPrompt = audioPrompt
          if (selectedAudioType === "music") {
            enhancedPrompt = `Background music: ${audioPrompt}`
          } else if (selectedAudioType === "sfx") {
            enhancedPrompt = `Sound effect: ${audioPrompt}`
          } else if (selectedAudioType === "ambient") {
            enhancedPrompt = `Ambient sound: ${audioPrompt}`
          } else if (selectedAudioType === "dialogue") {
            enhancedPrompt = audioPrompt // Keep original for voice generation
          } else if (selectedAudioType === "score") {
            enhancedPrompt = `Film score: ${audioPrompt}`
          }
          
          console.log('Enhanced prompt for ElevenLabs:', enhancedPrompt)
          
          const response = await ElevenLabsService.generateAudio({
            prompt: enhancedPrompt,
            type: selectedAudioType,
            model: selectedModel,
            apiKey: user.elevenlabsApiKey!,
            voiceId: selectedVoice,
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
            console.error('ElevenLabs audio generation failed:', response.error)
            toast({
              title: "Audio Generation Failed",
              description: `Error: ${response.error}. Please check your ElevenLabs API key and try again.`,
              variant: "destructive",
            })
          }
        } else if (type === "audio" && selectedModel === "Suno AI") {
          console.log('Attempting to generate audio with Suno AI:', {
            prompt: audioPrompt,
            type: selectedAudioType,
            duration: selectedAudioDuration,
            apiKeyLength: user.sunoApiKey?.length || 0,
            apiKeyPrefix: user.sunoApiKey?.substring(0, 7) || 'None'
          })
          
          // Import the Suno AI service
          const { SunoAIService } = await import('@/lib/ai-services')
          
          // First validate the API key
          console.log('Validating Suno AI API key...')
          const isValid = await SunoAIService.validateApiKey(user.sunoApiKey!)
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
          
          // Build enhanced prompt based on audio type
          let enhancedPrompt = audioPrompt
          if (selectedAudioType === "music") {
            enhancedPrompt = `Music: ${audioPrompt}`
          } else if (selectedAudioType === "sfx") {
            enhancedPrompt = `Sound effect: ${audioPrompt}`
          } else if (selectedAudioType === "ambient") {
            enhancedPrompt = `Ambient: ${audioPrompt}`
          } else if (selectedAudioType === "score") {
            enhancedPrompt = `Film score: ${audioPrompt}`
          }
          
          console.log('Enhanced prompt for Suno AI:', enhancedPrompt)
          
          const response = await SunoAIService.generateAudio({
            prompt: enhancedPrompt,
            type: selectedAudioType,
            model: selectedModel,
            apiKey: user.sunoApiKey!,
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
            toast({
              title: "Audio Generation Failed",
              description: `Error: ${response.error}. Please check your Suno AI API key and try again.`,
              variant: "destructive",
            })
          }
        } else {
          // For other models, show a message that they're not implemented yet
          alert(`${selectedModel} is not yet implemented. Please use ChatGPT for scripts, DALL-E 3 for images, or Runway ML/Kling for videos.`)
          setIsGenerating(false)
          return
        }

      setGenerationProgress(100)
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
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
    if (!user?.elevenlabsApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key first.",
        variant: "destructive",
      })
      return
    }

    try {
      const { ElevenLabsService } = await import('@/lib/ai-services')
      const response = await ElevenLabsService.getVoicePreview(user.elevenlabsApiKey, voiceId)
      
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
    if (!user?.elevenlabsApiKey) {
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
        user.elevenlabsApiKey,
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
    if (!user?.elevenlabsApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key first.",
        variant: "destructive",
      })
      return
    }

    try {
      const { ElevenLabsService } = await import('@/lib/ai-services')
      const response = await ElevenLabsService.getAvailableVoices(user.elevenlabsApiKey)
      
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
    if (!user?.elevenlabsApiKey) {
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
      const response = await ElevenLabsService.deleteVoice(user.elevenlabsApiKey, voiceId)
      
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
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-muted/50">
            <TabsTrigger value="scripts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Scripts
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Images
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
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
                              isReady = !!user?.openaiApiKey
                              statusText = isReady ? "Ready" : "OpenAI API Key Required"
                            } else if (model === "Claude") {
                              isReady = !!user?.anthropicApiKey
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
                      
                      {selectedModel === "ChatGPT" && !user?.openaiApiKey && (
                        <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                          <p className="text-sm text-orange-600">
                            <AlertCircle className="h-4 w-4 inline mr-2" />
                            OpenAI API key required. <Link href="/setup-ai" className="underline">Configure now</Link>
                          </p>
                        </div>
                      )}
                      
                      {selectedModel === "Claude" && !user?.anthropicApiKey && (
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
                      (selectedModel === "ChatGPT" && !user?.openaiApiKey) ||
                      (selectedModel === "Claude" && !user?.anthropicApiKey)
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
                  {isLoadingData ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">Loading...</p>
                    </div>
                  ) : generatedContent.filter(item => item.type === 'script').length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No scripts generated yet</p>
                      <p className="text-xs text-muted-foreground">Use the generator on the left to create your first script</p>
                    </div>
                  ) : (
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
                                  <Select onValueChange={(sceneId) => handleLinkToScene(script, "script", sceneId)}>
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
                  )}
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
                              isReady = !!user?.openaiApiKey
                              statusText = isReady ? "Ready" : "OpenAI API Key Required"
                            } else if (model === "OpenArt") {
                              isReady = !!user?.openartApiKey
                              statusText = isReady ? "Ready" : "API Key Required"
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
                      
                      {selectedModel === "DALL-E 3" && !user?.openaiApiKey && (
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

                  <div className="grid gap-2">
                    <Label>Prompt</Label>
                    <Textarea
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
                      (selectedModel === "DALL-E 3" && !user?.openaiApiKey) ||
                      (selectedModel === "OpenArt" && !user?.openartApiKey)
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
                          
                          {/* Storage Status Indicator */}
                          <div className="mb-2">
                            {image.url && image.url.includes('supabase.co') ? (
                              <Badge variant="default" className="text-xs bg-green-500/20 text-green-600 border-green-500/30">
                                ✅ Stored in Supabase
                              </Badge>
                            ) : image.url && image.url.includes('oaidalleapiprodscus.blob.core.windows.net') ? (
                              <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-600 border-orange-500/30">
                                ⚠️ OpenAI URL (Save to upload to Supabase)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                ❓ No URL
                              </Badge>
                            )}
                          </div>

                          {selectedProject && scenes.length > 0 && (
                            <div className="mb-2">
                              <Select onValueChange={(sceneId) => handleLinkToScene(image, "image", sceneId)}>
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
                        <SelectItem value="15s">15 seconds</SelectItem>
                        <SelectItem value="30s">30 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedModel === "Runway ML" && (
                    <>
                      <div className="grid gap-2">
                        <Label>Video Style</Label>
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
                      </div>

                      <div className="grid gap-2">
                        <Label>Camera Movement</Label>
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
                      </div>

                      <div className="grid gap-2">
                        <Label>Lighting</Label>
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
                      </div>

                      <div className="grid gap-2">
                        <Label>Resolution</Label>
                        <Select value={selectedResolution} onValueChange={setSelectedResolution}>
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue placeholder="Select resolution" />
                          </SelectTrigger>
                          <SelectContent className="cinema-card border-border">
                            <SelectItem value="1024x576">16:9 (1024x576)</SelectItem>
                            <SelectItem value="1024x1024">1:1 (1024x1024)</SelectItem>
                            <SelectItem value="1024x768">4:3 (1024x768)</SelectItem>
                            <SelectItem value="1280x720">HD (1280x720)</SelectItem>
                            <SelectItem value="1920x1080">Full HD (1920x1080)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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
                            
                            if (model === "Runway ML") {
                              isReady = !!user?.runwayApiKey
                              statusText = isReady ? "Ready" : "API Key Required"
                            } else if (model === "Kling") {
                              isReady = !!user?.klingApiKey
                              statusText = isReady ? "Ready" : "API Key Required"
                            } else {
                              isReady = true
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
                      
                      {selectedModel === "Runway ML" && !user?.runwayApiKey && (
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
                      
                      {selectedModel === "Kling" && !user?.klingApiKey && (
                        <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                          <p className="text-sm text-orange-600">
                            <AlertCircle className="h-4 w-4 inline mr-2" />
                            Kling API key required. <Link href="/setup-ai" className="underline">Configure now</Link>
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
                    onClick={() => handleGenerate("video")}
                    disabled={
                      isGenerating || 
                      !videoPrompt || 
                      !selectedModel ||
                      (selectedModel === "Runway ML" && !user?.runwayApiKey) ||
                      (selectedModel === "Kling" && !user?.klingApiKey)
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
                            <div className="text-center">
                              <Play className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">Video Preview</p>
                            </div>
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
                              <Select onValueChange={(sceneId) => handleLinkToScene(video, "video", sceneId)}>
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
                            <Button size="sm" variant="outline" className="text-xs bg-transparent">
                              <Play className="mr-1 h-3 w-3" />
                              Play
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs bg-transparent">
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

                  {selectedModel === "ElevenLabs" && !user?.elevenlabsApiKey && (
                    <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <p className="text-sm text-orange-600">
                        <AlertCircle className="h-4 w-4 inline mr-2" />
                        ElevenLabs API key required. <Link href="/setup-ai" className="underline">Configure now</Link> or <Link href="https://elevenlabs.io/" target="_blank" className="underline">get your API key</Link>
                      </p>
                    </div>
                  )}

                  {selectedModel === "Suno AI" && !user?.sunoApiKey && (
                    <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <p className="text-sm text-orange-600">
                        <AlertCircle className="h-4 w-4 inline mr-2" />
                        Suno AI API key required. <Link href="/setup-ai" className="underline">Configure now</Link> or <Link href="https://suno.ai/" target="_blank" className="underline">get your API key</Link>
                      </p>
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
                        disabled={!user?.elevenlabsApiKey}
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
                            disabled={!cloningVoiceName || cloningVoiceFiles.length === 0 || !user?.elevenlabsApiKey}
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
                          disabled={!user?.elevenlabsApiKey}
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
                      (selectedModel === "ElevenLabs" && !user?.elevenlabsApiKey) ||
                      (selectedModel === "Suno AI" && !user?.sunoApiKey)
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
      </main>
    </div>
  )
}
