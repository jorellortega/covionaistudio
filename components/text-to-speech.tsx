"use client"
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, Pause, Volume2, Download, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-context-fixed'

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
  const { user } = useAuth()
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
  const audioRef = useRef<HTMLAudioElement>(null)

  // Load available voices when component mounts
  useEffect(() => {
    if (user?.elevenlabsApiKey) {
      loadVoices()
    }
  }, [user?.elevenlabsApiKey])

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

  const loadVoices = async () => {
    if (!user?.elevenlabsApiKey) {
      toast({
        title: "API Key Required",
        description: "Please set up your ElevenLabs API key in settings.",
        variant: "destructive",
      })
      return
    }

    setIsLoadingVoices(true)
    try {
      const response = await fetch('/api/ai/get-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: user.elevenlabsApiKey })
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
    if (!user?.elevenlabsApiKey) {
      toast({
        title: "API Key Required",
        description: "Please set up your ElevenLabs API key in settings.",
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
      console.log('🎵 Client: API Key (first 10 chars):', user.elevenlabsApiKey.substring(0, 10) + '...')
      console.log('🎵 Client: Request URL:', '/api/ai/text-to-speech')
      
      const requestBody = {
        text: text.trim(),
        voiceId: selectedVoice,
        apiKey: user.elevenlabsApiKey
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
        body: JSON.stringify({ projectId, sceneId: sceneId || null, userId: user.id })
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
            userId: user.id
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

  if (!user?.elevenlabsApiKey) {
    return (
      <Card className={`bg-card border-orange-500/20 ${className}`}>
        <CardHeader>
          <CardTitle className="text-orange-500">ElevenLabs Not Configured</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            To use text-to-speech, please configure your ElevenLabs API key in settings.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            onClick={() => window.location.href = '/settings'}
          >
            Go to Settings
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`bg-card border-blue-500/20 ${className}`}>
      <CardHeader>
        <CardTitle className="text-blue-500 flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Text to Speech
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Select Voice</label>
          <Select value={selectedVoice} onValueChange={setSelectedVoice}>
            <SelectTrigger className="bg-card border-blue-500/30">
              <SelectValue placeholder="Loading voices..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-blue-500/30">
              {isLoadingVoices ? (
                <div className="flex items-center gap-2 p-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading voices...</span>
                </div>
              ) : (
                voices.map((voice) => (
                  <SelectItem key={voice.voice_id} value={voice.voice_id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{voice.name}</span>
                      {voice.description && (
                        <span className="text-xs text-muted-foreground">{voice.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {selectedVoice && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                {getSelectedVoiceName()}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {voices.find(v => v.voice_id === selectedVoice)?.category || 'Unknown'}
              </Badge>
            </div>
          )}
        </div>

        {/* Generate Speech Button */}
        <Button
          onClick={generateSpeech}
          disabled={isLoading || !selectedVoice || !text.trim()}
          className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Speech...
            </>
          ) : (
            <>
              <Volume2 className="h-4 w-4 mr-2" />
              Generate Speech
            </>
          )}
        </Button>
        

        
        {/* No Audio Generated Yet */}
        {!audioUrl && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <div className="mb-2">🎤 Ready to generate speech</div>
            <div className="text-xs">Select a voice and click "Generate Speech" to get started</div>
          </div>
        )}

        {/* Audio Player */}
        {audioUrl && (
          <div className="space-y-3 p-4 bg-muted/20 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-foreground">Generated Audio</h4>
              <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                Ready to Play
              </Badge>
            </div>
            
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={handleAudioEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full"
            />
            
            <div className="flex gap-2">
              <Button
                onClick={playAudio}
                variant="outline"
                size="sm"
                className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Play
                  </>
                )}
              </Button>
              
              <Button
                onClick={downloadAudio}
                variant="outline"
                size="sm"
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>

              {/* Save to Bucket Button */}
              {projectId && (
                <Button
                  onClick={saveToBucket}
                  disabled={isSavingToBucket || !!savedAssetId}
                  variant="outline"
                  size="sm"
                  className={`${
                    savedAssetId 
                      ? 'border-green-500/30 text-green-400 bg-green-500/10' 
                      : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
                  }`}
                >
                  {isSavingToBucket ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : savedAssetId ? (
                    <>
                      <span className="mr-2">✓</span>
                      Saved
                    </>
                  ) : (
                    <>
                      <span className="mr-2">☁️</span>
                      Save
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Success Indicator */}
        {savedAssetId && (
          <div className="text-xs text-green-400 text-center mt-2">
            ✓ Audio saved as asset #{savedAssetId.slice(0, 8)}...
          </div>
        )}

        {/* Saved Audio Files Section */}
        {projectId && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground">Saved Audio</h4>
              <Button
                onClick={fetchSavedAudio}
                disabled={isLoadingSavedAudio}
                variant="outline"
                size="sm"
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                {isLoadingSavedAudio ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
            </div>

            {savedAudioFiles.length > 0 ? (
              <div className="space-y-2">
                {savedAudioFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/20 rounded border border-border">
                    <div className="flex-1 min-w-0">
                      {editingAudioId === file.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingAudioName}
                            onChange={(e) => setEditingAudioName(e.target.value)}
                            className="text-sm font-medium text-foreground bg-background border border-border rounded px-2 py-1 flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveEditedAudioName(file)
                              } else if (e.key === 'Escape') {
                                cancelEditingAudioName()
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            onClick={() => saveEditedAudioName(file)}
                            disabled={isRenamingAudio === file.id}
                            size="sm"
                            className="h-6 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                          >
                            {isRenamingAudio === file.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              '✓'
                            )}
                          </Button>
                          <Button
                            onClick={cancelEditingAudioName}
                            size="sm"
                            className="h-6 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <p 
                            className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-blue-400 transition-colors"
                            onClick={() => startEditingAudioName(file)}
                            title="Click to rename"
                          >
                            {file.name}
                          </p>
                          <Button
                            onClick={() => startEditingAudioName(file)}
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 hover:text-blue-300"
                          >
                            ✏️
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <audio
                        src={file.public_url}
                        controls
                        className="h-8"
                        preload="none"
                      />
                      <Button
                        onClick={() => window.open(file.public_url, '_blank')}
                        variant="outline"
                        size="sm"
                        className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => deleteAudioFile(file)}
                        disabled={isDeletingAudio === file.id}
                        variant="outline"
                        size="sm"
                        className="border-gray-500/30 text-gray-400 hover:bg-gray-500/10"
                      >
                        {isDeletingAudio === file.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          '×'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                {isLoadingSavedAudio ? 'Loading saved audio...' : 'No saved audio files yet'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
