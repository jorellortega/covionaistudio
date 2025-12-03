"use client"
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2, Play, Pause, Volume2, Download, RefreshCw, Headphones, Edit, Check, X as XIcon, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuthReady } from '@/components/auth-hooks'
import { AISettingsService } from '@/lib/ai-settings-service'
import { getSupabaseClient } from '@/lib/supabase'

interface Voice {
  voice_id: string
  name: string
  category: string
  description?: string
  preview_url?: string
}

interface TextToSpeechProps {
  text: string
  title?: string
  className?: string
  projectId?: string
  sceneId?: string
  treatmentId?: string
  onAudioSaved?: (assetId: string) => void
  metadata?: Record<string, any>
}

export default function TextToSpeech({ text, title = "Script", className = "", projectId, sceneId, treatmentId, onAudioSaved, metadata }: TextToSpeechProps) {
  const { toast } = useToast()
  const { user, userId, ready } = useAuthReady()
  const [voices, setVoices] = useState<Voice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)
  const [isSavingToBucket, setIsSavingToBucket] = useState(false)
  const [savedAssetId, setSavedAssetId] = useState<string | null>(null)
  const [savedAudioFiles, setSavedAudioFiles] = useState<any[]>([])
  const [isLoadingSavedAudio, setIsLoadingSavedAudio] = useState(false)
  
  // Audio editing state
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null)
  const [editingAudioName, setEditingAudioName] = useState("")
  const [isDeletingAudio, setIsDeletingAudio] = useState<string | null>(null)
  const [isRenamingAudio, setIsRenamingAudio] = useState<string | null>(null)
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false)
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // Load available voices when component mounts
  useEffect(() => {
    if (ready && userId) {
      loadApiKey()
    }
  }, [ready, userId])

  // Load voices when API key is available
  useEffect(() => {
    if (elevenLabsApiKey) {
      loadVoices()
    }
  }, [elevenLabsApiKey])

  // Load saved audio files when component mounts
  // Allow loading even without projectId if treatmentId or sceneId is provided
  useEffect(() => {
    if ((projectId || sceneId || treatmentId) && user?.id) {
      fetchSavedAudio()
    }
  }, [projectId, sceneId, treatmentId, user?.id])

  // Set default voice when voices are loaded
  useEffect(() => {
    if (voices.length > 0 && !selectedVoice) {
      // Try to find Rachel voice first, otherwise use the first available
      const rachelVoice = voices.find(v => v.name.toLowerCase().includes('rachel'))
      setSelectedVoice(rachelVoice?.voice_id || voices[0].voice_id)
    }
  }, [voices, selectedVoice])

  const loadApiKey = async () => {
    console.log('🔑 [DEBUG] loadApiKey called, userId:', userId)
    if (!userId) {
      console.log('❌ [DEBUG] No userId available, skipping API key load')
      return
    }

    try {
      const supabase = getSupabaseClient()
      
      // First, try to get user's API key
      console.log('🔑 [DEBUG] Checking user-specific API key...')
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('elevenlabs_api_key')
        .eq('id', userId)
        .maybeSingle()

      console.log('🔑 [DEBUG] User key query result:', {
        hasData: !!userData,
        hasKey: !!userData?.elevenlabs_api_key,
        keyLength: userData?.elevenlabs_api_key?.length || 0,
        error: userError?.message || null
      })

      if (!userError && userData?.elevenlabs_api_key?.trim()) {
        console.log('✅ [DEBUG] Using user-specific ElevenLabs API key')
        setElevenLabsApiKey(userData.elevenlabs_api_key.trim())
        return
      }

      // If no user key, try system-wide key via API route (bypasses RLS)
      console.log('🔑 [DEBUG] No user key found, checking system-wide key via API route...')
      try {
        const response = await fetch('/api/ai/get-system-api-key?type=elevenlabs_api_key')
        console.log('🔑 [DEBUG] API route response status:', response.status, response.statusText)
        
        if (response.ok) {
          const data = await response.json()
          console.log('🔑 [DEBUG] API route response data (full):', JSON.stringify(data, null, 2))
          console.log('🔑 [DEBUG] API route response data (parsed):', {
            hasApiKey: !!data.apiKey,
            apiKeyValue: data.apiKey,
            apiKeyType: typeof data.apiKey,
            apiKeyLength: data.apiKey?.length || 0,
            debug: data.debug,
            allKeys: Object.keys(data)
          })
          
          if (data.apiKey?.trim()) {
            setElevenLabsApiKey(data.apiKey.trim())
            console.log('✅ [DEBUG] Using system-wide ElevenLabs API key')
            return
      } else {
            console.log('❌ [DEBUG] System-wide API key is empty or null', {
              apiKey: data.apiKey,
              trimmed: data.apiKey?.trim(),
              isEmpty: !data.apiKey?.trim()
            })
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error('❌ [DEBUG] API route error:', response.status, errorData)
        }
      } catch (apiError) {
        console.error('❌ [DEBUG] Error fetching system-wide API key:', apiError)
      }

      // No key found - only show error if user tried to use the feature
      // Don't show error on mount, only when they try to use it
      console.log('❌ [DEBUG] ElevenLabs API key not found in user profile or system config')
    } catch (error) {
      console.error('❌ [DEBUG] Error loading API key:', error)
      // Don't show error toast on mount, only log it
    }
  }

  const loadVoices = async () => {
    if (!elevenLabsApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key first.",
        variant: "destructive",
      })
      return
    }

    setIsLoadingVoices(true)
    try {
      const response = await fetch('/api/ai/get-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: elevenLabsApiKey })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch voices')
      }

      const data = await response.json()
      setVoices(data.voices || [])
    } catch (error) {
      console.error('Error loading voices:', error)
      toast({
        title: "Error",
        description: "Failed to load available voices.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingVoices(false)
    }
  }

  const generateSpeech = async () => {
    if (!ready) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to use text-to-speech.",
        variant: "destructive",
      })
      return
    }

    if (!elevenLabsApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key first.",
        variant: "destructive",
      })
      return
    }

    if (!selectedVoice) {
      toast({
        title: "Voice Required",
        description: "Please select a voice first.",
        variant: "destructive",
      })
      return
    }

    if (!text.trim()) {
      toast({
        title: "Text Required",
        description: "No text to convert to speech.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      console.log('🎵 Client: Starting text-to-speech request...')
      console.log('🎵 Client: Text length:', text.trim().length)
      console.log('🎵 Client: Voice ID:', selectedVoice)
      console.log('🎵 Client: API Key configured')
      console.log('🎵 Client: Request URL:', '/api/ai/text-to-speech')
      
      const requestBody = {
        text: text.trim(),
        voiceId: selectedVoice,
        apiKey: elevenLabsApiKey
      }
      console.log('🎵 Client: Request body:', requestBody)
      
      const response = await fetch('/api/ai/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      console.log('🎵 Client: Response received, status:', response.status)
      console.log('🎵 Client: Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        console.log('🎵 Client: Response not OK, trying to parse error...')
        const errorData = await response.json().catch(() => ({}))
        console.log('🎵 Client: Error data:', errorData)
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate speech`)
      }

      console.log('🎵 Client: Response OK, processing audio blob...')
      const audioBlob = await response.blob()
      console.log('🎵 Client: Audio blob received, size:', audioBlob.size, 'bytes')
      const url = URL.createObjectURL(audioBlob)
      setAudioUrl(url)
      
      // Reset savedAssetId when new audio is generated (user can save the new audio)
      setSavedAssetId(null)

      toast({
        title: "Speech Generated",
        description: "Your script has been converted to speech successfully!",
      })
    } catch (error) {
      console.error('Error generating speech:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const playAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  const handleAudioEnded = () => {
    setIsPlaying(false)
  }

  const downloadAudio = async () => {
    if (!audioUrl) return

    try {
      // Fetch the audio as a blob to force download
      const response = await fetch(audioUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch audio')
      }
      
      const blob = await response.blob()
      
      // Generate download filename matching the save format
      let downloadFileName: string
      const titleLower = title.toLowerCase()
      
      if (titleLower.includes('synopsis')) {
        // Extract movie title (everything before " - Synopsis")
        const movieTitle = title.split(' - Synopsis')[0].trim()
        downloadFileName = `${movieTitle} - Synopsis audio.mp3`
      } else if (titleLower.includes('treatment')) {
        // Extract movie title (everything before " - Treatment")
        const movieTitle = title.split(' - Treatment')[0].trim()
        downloadFileName = `${movieTitle} - Treatment audio.mp3`
      } else if (titleLower.includes('scene page')) {
        // Extract page number from "Scene Page X Audio"
        const pageMatch = title.match(/scene\s+page\s+(\d+)/i)
        if (pageMatch) {
          const pageNumber = pageMatch[1]
          downloadFileName = `Scene Page ${pageNumber} Audio.mp3`
        } else {
          downloadFileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_speech.mp3`
        }
      } else {
        // For other cases, use the original logic
        downloadFileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_speech.mp3`
      }
      
      // Create blob URL directly from the blob to force download
      const blobUrl = window.URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = downloadFileName
      link.style.display = 'none'
      link.setAttribute('download', downloadFileName) // Force download attribute
      // Don't set target - let download attribute handle it
      document.body.appendChild(link)
      
      // Trigger download - use click() directly
      link.click()
      
      // Clean up immediately
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link)
        }
        window.URL.revokeObjectURL(blobUrl)
      }, 100)
    } catch (error) {
      console.error('Error downloading audio:', error)
      toast({
        title: "Download Failed",
        description: "Failed to download audio. Please try again.",
        variant: "destructive",
      })
    }
  }

  const fetchSavedAudio = async (options?: { showToast?: boolean }) => {
    // Require at least one of projectId, sceneId, or treatmentId
    if (!projectId && !sceneId && !treatmentId) return

    setIsLoadingSavedAudio(true)
    try {
      const response = await fetch('/api/ai/get-scene-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId: projectId || null, 
          sceneId: sceneId || null, 
          treatmentId: treatmentId || null,
          userId: user?.id 
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch saved audio')
      }

      const result = await response.json()
      if (result.success) {
        // Filter audio files based on the title prop to separate synopsis, treatment, and page audio
        // The title prop contains either "Synopsis", "Treatment", or "Page X Audio" to distinguish them
        let filteredAudioFiles = result.data.audioFiles
        
        if (title) {
          // Extract the type from title (e.g., "Movie Title - Synopsis" -> "Synopsis")
          const titleLower = title.toLowerCase()
          if (titleLower.includes('synopsis')) {
            // Only show audio files that contain "synopsis" in their name
            filteredAudioFiles = result.data.audioFiles.filter((file: any) => 
              file.name.toLowerCase().includes('synopsis')
            )
          } else if (titleLower.includes('treatment')) {
            // Only show audio files that contain "treatment" in their name (but not "synopsis")
            filteredAudioFiles = result.data.audioFiles.filter((file: any) => 
              file.name.toLowerCase().includes('treatment') && !file.name.toLowerCase().includes('synopsis')
            )
          } else if (titleLower.includes('scene page')) {
            // Extract page number from title (e.g., "Scene Page 1 Audio" -> "1")
            const pageMatch = title.match(/scene\s+page\s+(\d+)/i)
            if (pageMatch) {
              const pageNumber = pageMatch[1]
              // Only show audio files that match this specific page number
              filteredAudioFiles = result.data.audioFiles.filter((file: any) => {
                const fileName = file.name.toLowerCase()
                // Match "scene page X" or "scene_page_X" patterns
                const filePageMatch = fileName.match(/scene[\s_]+page[\s_]+(\d+)/i)
                return filePageMatch && filePageMatch[1] === pageNumber
              })
            }
          } else if (titleLower.includes('page')) {
            // Handle legacy "Page X Audio" format (without "Scene" prefix)
            const pageMatch = title.match(/page\s+(\d+)/i)
            if (pageMatch) {
              const pageNumber = pageMatch[1]
              // Only show audio files that match this specific page number
              filteredAudioFiles = result.data.audioFiles.filter((file: any) => {
                const fileName = file.name.toLowerCase()
                // Match "page X" or "page_X" patterns (but not "scene page X")
                const filePageMatch = fileName.match(/page[\s_]+(\d+)/i)
                const hasScenePrefix = fileName.includes('scene')
                return filePageMatch && filePageMatch[1] === pageNumber && !hasScenePrefix
              })
            }
          }
        }
        
        setSavedAudioFiles(filteredAudioFiles)
        if (options?.showToast !== false) {
          toast({
            title: "Audio Loaded",
            description: `Found ${filteredAudioFiles.length} saved audio files.`,
          })
        }
      }
    } catch (error) {
      console.error('Error fetching saved audio:', error)
      toast({
        title: "Error",
        description: "Failed to load saved audio files.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingSavedAudio(false)
    }
  }

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve(reader.result as string)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

  const saveToBucket = async () => {
    if (!audioUrl) {
      toast({
        title: "Cannot Save",
        description: "No audio generated yet. Please generate audio first.",
        variant: "destructive",
      })
      return
    }

    if (!user?.id) {
      toast({
        title: "Cannot Save",
        description: "You must be logged in to save audio.",
        variant: "destructive",
      })
      return
    }

    // Require at least one of projectId, sceneId, or treatmentId
    if (!projectId && !sceneId && !treatmentId) {
      toast({
        title: "Cannot Save",
        description: "Cannot save: No project, scene, or treatment specified.",
        variant: "destructive",
      })
      return
    }

    setIsSavingToBucket(true)
    try {
      console.log('💾 Starting save process...', {
        hasAudioUrl: !!audioUrl,
        projectId,
        treatmentId,
        sceneId,
        userId: user?.id
      })

      // Convert audio URL to blob
      const response = await fetch(audioUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch audio blob')
      }
      
      const audioBlob = await response.blob()
      console.log('💾 Audio blob fetched, size:', audioBlob.size, 'bytes')

      // Convert blob to base64 for transmission
      const base64Audio = await blobToBase64(audioBlob)
      console.log('💾 Audio converted to base64, length:', base64Audio.length)

      // Generate appropriate filename based on title
      // Extract the movie/treatment name from title (e.g., "Movie Title - Synopsis" -> "Movie Title")
      let fileName: string
      let audioTitle: string // For the database title
      const titleLower = title.toLowerCase()
      
      if (titleLower.includes('synopsis')) {
        // Extract movie title (everything before " - Synopsis")
        const movieTitle = title.split(' - Synopsis')[0].trim()
        const safeMovieTitle = movieTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        fileName = `${safeMovieTitle}_synopsis_audio`
        audioTitle = `${movieTitle} - Synopsis audio`
      } else if (titleLower.includes('treatment')) {
        // Extract movie title (everything before " - Treatment")
        const movieTitle = title.split(' - Treatment')[0].trim()
        const safeMovieTitle = movieTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        fileName = `${safeMovieTitle}_treatment_audio`
        audioTitle = `${movieTitle} - Treatment audio`
      } else if (titleLower.includes('scene page')) {
        // Extract page number from title (e.g., "Scene Page 1 Audio" -> "scene_page_1_audio")
        const pageMatch = title.match(/scene\s+page\s+(\d+)/i)
        if (pageMatch) {
          const pageNumber = pageMatch[1]
          fileName = `scene_page_${pageNumber}_audio`
          audioTitle = title // Use the full title as-is (e.g., "Scene Page 1 Audio")
        } else {
          // Fallback if page number not found
          fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_speech`
          audioTitle = `${title} audio`
        }
      } else if (titleLower.includes('page')) {
        // Handle legacy "Page X Audio" format (without "Scene" prefix)
        const pageMatch = title.match(/page\s+(\d+)/i)
        if (pageMatch) {
          const pageNumber = pageMatch[1]
          fileName = `page_${pageNumber}_audio`
          audioTitle = title // Use the full title as-is (e.g., "Page 1 Audio")
        } else {
          // Fallback if page number not found
          fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_speech`
          audioTitle = `${title} audio`
        }
      } else {
        // For other cases, use the original logic
        fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_speech`
        audioTitle = `${title} audio`
      }
      console.log('💾 Saving audio with filename:', fileName)
      console.log('💾 Audio title for database:', audioTitle)

      const saveResponse = await fetch('/api/ai/save-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBlob: base64Audio,
          fileName: fileName,
          audioTitle: audioTitle, // Pass the formatted title for the database
          projectId,
          sceneId: sceneId || null,
          treatmentId: treatmentId || null,
          userId: user?.id,
          metadata: metadata || {}
        })
      })

      console.log('💾 Save response status:', saveResponse.status)

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({ error: 'Unknown error' }))
        console.error('💾 Save failed:', errorData)
        throw new Error(errorData.error || 'Failed to save audio to bucket')
      }

      const result = await saveResponse.json()
      console.log('💾 Save result:', result)
      
      if (result.success) {
        const assetId = result.data.asset.id
        setSavedAssetId(assetId)
        toast({
          title: "Audio Saved!",
          description: `Audio file has been saved as an asset in your project.`,
        })
        if (typeof onAudioSaved === 'function') {
          onAudioSaved(assetId)
        }
        // Refresh saved audio list quietly
        await fetchSavedAudio({ showToast: false })
      } else {
        throw new Error(result.error || 'Unknown error')
      }
    } catch (error) {
      console.error('💾 Error saving to bucket:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save audio to bucket. Please try again.'
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSavingToBucket(false)
    }
  }

  const getSelectedVoiceName = () => {
    return voices.find(v => v.voice_id === selectedVoice)?.name || 'Select Voice'
  }

  const previewVoiceById = async (voiceId: string, e?: React.MouseEvent) => {
    // Prevent event propagation if event is provided (when clicking from dropdown)
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }

    setIsPreviewingVoice(true)
    setPreviewingVoiceId(voiceId)
    try {
      // Stop any currently playing preview
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }

      // Check if voice has a preview_url (from ElevenLabs API)
      const voice = voices.find(v => v.voice_id === voiceId)
      if (voice?.preview_url) {
        // Use the preview URL directly from ElevenLabs
        const audio = new Audio(voice.preview_url)
        previewAudioRef.current = audio
        
        audio.onended = () => {
          setIsPreviewingVoice(false)
          setPreviewingVoiceId(null)
          previewAudioRef.current = null
        }
        
        audio.onerror = (e) => {
          console.error('Preview URL failed, generating preview instead:', e)
          setIsPreviewingVoice(false)
          // If preview_url fails, try generating a preview
          generateVoicePreviewById(voiceId).catch(err => {
            console.error('Failed to generate preview:', err)
            setIsPreviewingVoice(false)
            setPreviewingVoiceId(null)
          })
        }
        
        try {
          await audio.play()
          toast({
            title: "Voice Preview",
            description: `Playing preview for ${voice.name}...`,
          })
          return
        } catch (playError) {
          console.error('Failed to play preview URL:', playError)
          // Fall through to generate preview
        }
      }

      // If no preview_url or preview_url failed, generate a preview via API
      await generateVoicePreviewById(voiceId)
    } catch (error) {
      console.error('Error previewing voice:', error)
      toast({
        title: "Preview Failed",
        description: error instanceof Error ? error.message : "Failed to preview voice",
        variant: "destructive",
      })
      setIsPreviewingVoice(false)
      setPreviewingVoiceId(null)
    }
  }

  const previewVoice = async () => {
    if (!selectedVoice) {
      toast({
        title: "Cannot Preview",
        description: "Please select a voice first.",
        variant: "destructive",
      })
      return
    }

    await previewVoiceById(selectedVoice)
  }

  const generateVoicePreviewById = async (voiceId: string) => {
    if (!elevenLabsApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key first.",
        variant: "destructive",
      })
      setIsPreviewingVoice(false)
      return
    }

    try {
      // Get voice preview from API
      const response = await fetch('/api/ai/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId })
      })

      if (!response.ok) {
        throw new Error('Failed to get voice preview')
      }

      // Check if response is JSON (URL) or audio blob
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('audio')) {
        // It's an audio blob
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        setPreviewAudioUrl(audioUrl)
        
        // Create and play audio
        const audio = new Audio(audioUrl)
        previewAudioRef.current = audio
        audio.onended = () => {
          setIsPreviewingVoice(false)
          setPreviewingVoiceId(null)
          setPreviewAudioUrl(null)
          if (previewAudioRef.current) {
            URL.revokeObjectURL(audioUrl)
            previewAudioRef.current = null
          }
        }
        audio.play()
      } else {
        // It's JSON with audioUrl
        const result = await response.json()
        if (result.audioUrl) {
          setPreviewAudioUrl(result.audioUrl)
          
          // Create and play audio
          const audio = new Audio(result.audioUrl)
          previewAudioRef.current = audio
          audio.onended = () => {
            setIsPreviewingVoice(false)
            setPreviewingVoiceId(null)
            setPreviewAudioUrl(null)
            previewAudioRef.current = null
          }
          audio.play()
        } else {
          throw new Error('No audio URL in response')
        }
      }

      toast({
        title: "Voice Preview",
        description: "Playing voice preview...",
      })
    } catch (error) {
      console.error('Error generating voice preview:', error)
      throw error
    }
  }

  // Cleanup preview audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudioUrl) {
        URL.revokeObjectURL(previewAudioUrl)
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
    }
  }, [previewAudioUrl])

  // Start editing audio name
  const startEditingAudioName = (audioFile: any) => {
    setEditingAudioId(audioFile.id)
    setEditingAudioName(audioFile.name)
  }

  // Cancel editing audio name
  const cancelEditingAudioName = () => {
    setEditingAudioId(null)
    setEditingAudioName("")
  }

  // Save edited audio name
  const saveEditedAudioName = async (audioFile: any) => {
    if (!editingAudioName.trim() || editingAudioName === audioFile.name) {
      cancelEditingAudioName()
      return
    }

    setIsRenamingAudio(audioFile.id)
    try {
      // Call API to rename the audio file
      const response = await fetch('/api/ai/rename-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioId: audioFile.id,
          newName: editingAudioName.trim(),
          userId: user?.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to rename audio file')
      }

      const result = await response.json()
      if (result.success) {
        // Update local state
        setSavedAudioFiles(prev => prev.map(file => 
          file.id === audioFile.id 
            ? { ...file, name: editingAudioName.trim() }
            : file
        ))
        
        toast({
          title: "Audio Renamed",
          description: "Audio file name has been updated successfully.",
        })
      } else {
        throw new Error(result.error || 'Failed to rename audio file')
      }
    } catch (error) {
      console.error('Error renaming audio:', error)
      toast({
        title: "Rename Failed",
        description: error instanceof Error ? error.message : "Failed to rename audio file.",
        variant: "destructive",
      })
    } finally {
      setIsRenamingAudio(null)
      cancelEditingAudioName()
    }
  }

  // Delete audio file
  const deleteAudioFile = async (audioFile: any) => {
    if (!confirm(`Are you sure you want to delete "${audioFile.name}"? This action cannot be undone.`)) {
      return
    }

    setIsDeletingAudio(audioFile.id)
    try {
      // Call API to delete the audio file
      const response = await fetch('/api/ai/delete-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioId: audioFile.id,
          userId: user?.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to delete audio file')
      }

      const result = await response.json()
      if (result.success) {
        // Remove from local state
        setSavedAudioFiles(prev => prev.filter(file => file.id !== audioFile.id))
        
        toast({
          title: "Audio Deleted",
          description: "Audio file has been deleted successfully.",
        })
      } else {
        throw new Error(result.error || 'Failed to delete audio file')
      }
    } catch (error) {
      console.error('Error deleting audio:', error)
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete audio file.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingAudio(null)
    }
  }

  if (!elevenLabsApiKey) {
    return (
      <div className={`w-full p-2 bg-orange-500/10 rounded border border-orange-500/20 ${className}`}>
        <p className="text-xs text-orange-400 mb-2">
          ElevenLabs not configured
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 h-7 text-xs"
          onClick={() => window.location.href = '/setup-ai'}
        >
          Setup AI
        </Button>
      </div>
    )
  }

  return (
    <div className={`w-full space-y-2 ${className}`}>
      {/* Compact Voice Selection and Generate Button */}
      <div className="flex items-center gap-2 flex-wrap">
        <Volume2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
          <SelectTrigger className="bg-card border-blue-500/30 h-8 text-xs flex-1 min-w-[150px]">
            <SelectValue placeholder="Select Voice" />
          </SelectTrigger>
          <SelectContent className="bg-card border-blue-500/30 max-h-60 overflow-y-auto">
            {isLoadingVoices ? (
              <div className="flex items-center gap-2 p-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : (
              voices.map((voice) => (
                <SelectItem 
                  key={voice.voice_id} 
                  value={voice.voice_id}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium truncate text-xs">{voice.name}</span>
                      {voice.description && (
                        <span className="text-xs text-muted-foreground truncate">{voice.description}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        previewVoiceById(voice.voice_id, e)
                      }}
                      disabled={isPreviewingVoice}
                      className="flex-shrink-0 p-1 rounded hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      title={`Preview ${voice.name}`}
                      aria-label={`Preview ${voice.name}`}
                    >
                      {isPreviewingVoice && previewingVoiceId === voice.voice_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Headphones className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {selectedVoice && (
          <>
            <Button
              onClick={previewVoice}
              disabled={isPreviewingVoice}
              variant="outline"
              size="sm"
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 h-8 text-xs px-2 flex-shrink-0"
              title="Preview Voice - Listen before generating"
            >
              {isPreviewingVoice ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Headphones className="h-3 w-3" />
              )}
            </Button>
          </>
        )}
        <Button
          onClick={generateSpeech}
          disabled={isLoading || !selectedVoice || !text.trim()}
          size="sm"
          className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90 h-8 text-xs px-3"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Volume2 className="h-3 w-3 mr-1" />
              Generate
            </>
          )}
        </Button>
      </div>
      
      {/* Hidden audio element for preview */}
      {previewAudioUrl && (
        <audio
          ref={previewAudioRef}
          src={previewAudioUrl}
          onEnded={() => {
            setIsPreviewingVoice(false)
            setPreviewAudioUrl(null)
            if (previewAudioRef.current) {
              URL.revokeObjectURL(previewAudioUrl)
              previewAudioRef.current = null
            }
          }}
          className="hidden"
        />
      )}

      {/* No Audio Generated Yet */}
      {!audioUrl && !isLoading && (
        <div className="text-center py-1 text-xs text-muted-foreground">
          🎤 Ready to generate speech
        </div>
      )}

      {/* Audio Player - Compact */}
      {audioUrl && (
        <div className="space-y-2 p-2 bg-muted/20 rounded border border-border">
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={handleAudioEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-8"
            controls
          />
          
          <div className="flex gap-2 flex-wrap items-center">
            {/* Download Button */}
            <Button
              onClick={downloadAudio}
              variant="outline"
              size="sm"
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 h-7 text-xs px-2"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>

            {/* Save Button - Always show when audio is generated */}
            <Button
              onClick={saveToBucket}
              disabled={isSavingToBucket || !!savedAssetId || !user?.id || (!projectId && !sceneId && !treatmentId)}
              variant="default"
              size="sm"
              className={`h-7 text-xs px-3 ${
                savedAssetId 
                  ? 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-green-500/30 cursor-default' 
                  : (!user?.id || (!projectId && !sceneId && !treatmentId))
                  ? 'bg-gray-500/50 border-gray-500/30 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-500 hover:bg-purple-600 text-white border-purple-500'
              }`}
              title={
                !user?.id 
                  ? "Cannot save: User not logged in"
                  : (!projectId && !sceneId && !treatmentId)
                  ? "Cannot save: No project, scene, or treatment specified"
                  : savedAssetId 
                  ? "Audio already saved" 
                  : treatmentId
                  ? `Save audio to treatment${projectId ? ' (with project)' : ' (standalone)'}`
                  : "Save audio to your project"
              }
            >
              {isSavingToBucket ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : savedAssetId ? (
                <>
                  <span className="mr-1">✓</span>
                  Saved
                </>
              ) : (
                <>
                  <span className="mr-1">💾</span>
                  Save
                </>
              )}
            </Button>
            {savedAssetId && (
              <span className="text-xs text-green-400 flex items-center">
                ✓ Saved to project
              </span>
            )}
            {(!user?.id || (!projectId && !sceneId && !treatmentId)) && (
              <span className="text-xs text-yellow-400 flex items-center">
                ⚠ Cannot save: {!user?.id ? 'Not logged in' : 'No project/scene/treatment'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Saved Audio Files Section - Always Visible */}
      {(sceneId || treatmentId) && savedAudioFiles.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-2 mb-2">
            <span>Saved Audio ({savedAudioFiles.length})</span>
            <RefreshCw 
              className="h-3 w-3 hover:text-blue-400 cursor-pointer" 
              onClick={() => fetchSavedAudio()}
              title="Refresh saved audio list"
            />
          </div>
          <div className="space-y-2">
            {savedAudioFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-muted/20 rounded border border-border/50">
                <div className="flex-1 min-w-0">
                  {editingAudioId === file.id ? (
                    <div className="space-y-1">
                      <Input
                        value={editingAudioName}
                        onChange={(e) => setEditingAudioName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveEditedAudioName(file)
                          } else if (e.key === 'Escape') {
                            cancelEditingAudioName()
                          }
                        }}
                        className="h-7 text-xs"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button
                          onClick={() => saveEditedAudioName(file)}
                          disabled={isRenamingAudio === file.id}
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                        >
                          {isRenamingAudio === file.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          onClick={cancelEditingAudioName}
                          disabled={isRenamingAudio === file.id}
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs border-gray-500/30 text-gray-400 hover:bg-gray-500/10"
                        >
                          <XIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </>
                  )}
                </div>
                {editingAudioId !== file.id && (
                  <>
                    <audio
                      src={file.public_url}
                      controls
                      className="h-8 w-32"
                      preload="none"
                    />
                    <Button
                      onClick={() => startEditingAudioName(file)}
                      disabled={editingAudioId !== null}
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 h-7 w-7 p-0"
                      title="Edit audio file name"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      onClick={() => window.open(file.public_url, '_blank')}
                      variant="outline"
                      size="sm"
                      className="border-green-500/30 text-green-400 hover:bg-green-500/10 h-7 w-7 p-0"
                      title="Download audio file"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      onClick={() => deleteAudioFile(file)}
                      disabled={isDeletingAudio === file.id}
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 w-7 p-0"
                      title="Delete audio file"
                    >
                      {isDeletingAudio === file.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

