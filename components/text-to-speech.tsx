"use client"
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, Pause, Volume2, Download, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuthReady } from '@/components/auth-hooks'
import { AISettingsService } from '@/lib/ai-settings-service'
import { getSupabaseClient } from '@/lib/supabase'

interface Voice {
  voice_id: string
  name: string
  category: string
  description?: string
}

interface TextToSpeechProps {
  text: string
  title?: string
  className?: string
  projectId?: string
  sceneId?: string
}

export default function TextToSpeech({ text, title = "Script", className = "", projectId, sceneId }: TextToSpeechProps) {
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
  useEffect(() => {
    if (projectId && sceneId) {
      fetchSavedAudio()
    }
  }, [projectId, sceneId])

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

  const fetchSavedAudio = async () => {
    if (!projectId) return

    setIsLoadingSavedAudio(true)
    try {
      const response = await fetch('/api/ai/get-scene-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sceneId: sceneId || null, userId: user?.id })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch saved audio')
      }

      const result = await response.json()
      if (result.success) {
        setSavedAudioFiles(result.data.audioFiles)
        toast({
          title: "Audio Loaded",
          description: `Found ${result.data.count} saved audio files.`,
        })
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

  const saveToBucket = async () => {
    if (!audioUrl || !projectId || !user?.id) {
      toast({
        title: "Cannot Save",
        description: "Missing project information for saving.",
        variant: "destructive",
      })
      return
    }

    setIsSavingToBucket(true)
    try {
      // Convert audio URL to blob
      const response = await fetch(audioUrl)
      const audioBlob = await response.blob()

      // Convert blob to base64 for transmission
      const reader = new FileReader()
      reader.readAsDataURL(audioBlob)
      reader.onloadend = async () => {
        const base64Audio = reader.result as string

        const saveResponse = await fetch('/api/ai/save-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBlob: base64Audio,
            fileName: `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_speech`,
            projectId,
            sceneId: sceneId || null,
            userId: user?.id
          })
        })

        if (!saveResponse.ok) {
          throw new Error('Failed to save audio to bucket')
        }

        const result = await saveResponse.json()
        
        if (result.success) {
          setSavedAssetId(result.data.asset.id)
                  toast({
          title: "Audio Saved!",
          description: `Audio file has been saved as an asset in your project.`,
        })
        } else {
          throw new Error(result.error || 'Unknown error')
        }
      }
    } catch (error) {
      console.error('Error saving to bucket:', error)
      toast({
        title: "Save Failed",
        description: "Failed to save audio to bucket. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingToBucket(false)
    }
  }

  const getSelectedVoiceName = () => {
    return voices.find(v => v.voice_id === selectedVoice)?.name || 'Select Voice'
  }

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
      <div className="flex items-center gap-2">
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
          <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 hidden sm:flex">
            {voices.find(v => v.voice_id === selectedVoice)?.category || 'premade'}
          </Badge>
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
          
          <div className="flex gap-1 flex-wrap">
            <Button
              onClick={downloadAudio}
              variant="outline"
              size="sm"
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 h-7 text-xs px-2"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>

            {/* Save to Bucket Button */}
            {projectId && (
              <Button
                onClick={saveToBucket}
                disabled={isSavingToBucket || !!savedAssetId}
                variant="outline"
                size="sm"
                className={`h-7 text-xs px-2 ${
                  savedAssetId 
                    ? 'border-green-500/30 text-green-400 bg-green-500/10' 
                    : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
                }`}
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
                    <span className="mr-1">☁️</span>
                    Save
                  </>
                )}
              </Button>
            )}
            {savedAssetId && (
              <span className="text-xs text-green-400 flex items-center">
                ✓ Saved to project
              </span>
            )}
          </div>
        </div>
      )}

      {/* Saved Audio Files Section - Compact & Collapsible */}
      {projectId && savedAudioFiles.length > 0 && (
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
