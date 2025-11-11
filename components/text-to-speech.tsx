"use client"
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, Pause, Volume2, Download, RefreshCw, Headphones } from 'lucide-react'
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
}

export default function TextToSpeech({ text, title = "Script", className = "", projectId, sceneId, treatmentId, onAudioSaved }: TextToSpeechProps) {
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
    if (!userId) {
      console.log('No userId available, skipping API key load')
      return
    }

    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('elevenlabs_api_key')
        .eq('id', userId)
        .single()

      if (error) throw error
      
      if (data?.elevenlabs_api_key) {
        setElevenLabsApiKey(data.elevenlabs_api_key)
      } else {
        toast({
          title: "ElevenLabs Not Configured",
          description: "To use text-to-speech, please configure your ElevenLabs API key in settings.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error loading API key:', error)
      toast({
        title: "Error",
        description: "Failed to load AI settings.",
        variant: "destructive",
      })
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

  const downloadAudio = () => {
    if (audioUrl) {
      const link = document.createElement('a')
      link.href = audioUrl
      link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_speech.mp3`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
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
        setSavedAudioFiles(result.data.audioFiles)
        if (options?.showToast !== false) {
          toast({
            title: "Audio Loaded",
            description: `Found ${result.data.count} saved audio files.`,
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

      const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_speech`
      console.log('💾 Saving audio with filename:', fileName)

      const saveResponse = await fetch('/api/ai/save-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBlob: base64Audio,
          fileName: fileName,
          projectId,
          sceneId: sceneId || null,
          treatmentId: treatmentId || null,
          userId: user?.id
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

  const previewVoice = async () => {
    if (!selectedVoice) {
      toast({
        title: "Cannot Preview",
        description: "Please select a voice first.",
        variant: "destructive",
      })
      return
    }

    setIsPreviewingVoice(true)
    try {
      // Stop any currently playing preview
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }

      // Check if voice has a preview_url (from ElevenLabs API)
      const voice = voices.find(v => v.voice_id === selectedVoice)
      if (voice?.preview_url) {
        // Use the preview URL directly from ElevenLabs
        const audio = new Audio(voice.preview_url)
        previewAudioRef.current = audio
        
        audio.onended = () => {
          setIsPreviewingVoice(false)
          previewAudioRef.current = null
        }
        
        audio.onerror = (e) => {
          console.error('Preview URL failed, generating preview instead:', e)
          setIsPreviewingVoice(false)
          // If preview_url fails, try generating a preview
          generateVoicePreview().catch(err => {
            console.error('Failed to generate preview:', err)
            setIsPreviewingVoice(false)
          })
        }
        
        try {
          await audio.play()
          toast({
            title: "Voice Preview",
            description: "Playing voice preview...",
          })
          return
        } catch (playError) {
          console.error('Failed to play preview URL:', playError)
          // Fall through to generate preview
        }
      }

      // If no preview_url or preview_url failed, generate a preview via API
      await generateVoicePreview()
    } catch (error) {
      console.error('Error previewing voice:', error)
      toast({
        title: "Preview Failed",
        description: error instanceof Error ? error.message : "Failed to preview voice",
        variant: "destructive",
      })
      setIsPreviewingVoice(false)
    }
  }

  const generateVoicePreview = async () => {
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
        body: JSON.stringify({ voiceId: selectedVoice })
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
                <SelectItem key={voice.voice_id} value={voice.voice_id}>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate text-xs">{voice.name}</span>
                    {voice.description && (
                      <span className="text-xs text-muted-foreground truncate">{voice.description}</span>
                    )}
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
          <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 hidden sm:flex">
            {voices.find(v => v.voice_id === selectedVoice)?.category || 'premade'}
          </Badge>
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

      {/* Saved Audio Files Section - Compact & Collapsible */}
      {(sceneId || treatmentId) && savedAudioFiles.length > 0 && (
        <details className="mt-2 pt-2 border-t border-border/50">
          <summary className="text-xs font-medium text-muted-foreground cursor-pointer flex items-center gap-2 hover:text-foreground">
            <span>Saved Audio ({savedAudioFiles.length})</span>
            <RefreshCw 
              className="h-3 w-3 hover:text-blue-400" 
              onClick={(e) => {
                e.preventDefault()
                fetchSavedAudio()
              }}
            />
          </summary>
          <div className="space-y-2 mt-2">
            {savedAudioFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-muted/20 rounded border border-border/50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <audio
                  src={file.public_url}
                  controls
                  className="h-8 w-32"
                  preload="none"
                />
                <Button
                  onClick={() => window.open(file.public_url, '_blank')}
                  variant="outline"
                  size="sm"
                  className="border-green-500/30 text-green-400 hover:bg-green-500/10 h-7 w-7 p-0"
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  onClick={() => deleteAudioFile(file)}
                  disabled={isDeletingAudio === file.id}
                  variant="outline"
                  size="sm"
                  className="border-gray-500/30 text-gray-400 hover:bg-gray-500/10 h-7 w-7 p-0"
                >
                  {isDeletingAudio === file.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    '×'
                  )}
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
