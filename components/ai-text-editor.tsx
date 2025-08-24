"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Bot, Sparkles, RotateCcw, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context-fixed"

interface AITextEditorProps {
  isOpen: boolean
  onClose: () => void
  selectedText: string
  fullContent: string
  sceneContext?: string
  onTextReplace: (newText: string) => void
  contentType?: 'script' | 'description' | 'dialogue' | 'action'
}

interface AIGenerationRequest {
  prompt: string
  selectedText: string
  fullContent: string
  sceneContext?: string
  contentType: string
  service: 'openai' | 'anthropic'
  apiKey: string
}

export default function AITextEditor({
  isOpen,
  onClose,
  selectedText,
  fullContent,
  sceneContext,
  onTextReplace,
  contentType = 'script'
}: AITextEditorProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [prompt, setPrompt] = useState("")
  const [selectedService, setSelectedService] = useState<'openai' | 'anthropic'>('openai')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus the prompt textarea when dialog opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPrompt("")
      setGeneratedText("")
      setError(null)
      setShowPreview(false)
    }
  }, [isOpen])

  // Check if user has required API key
  const hasRequiredApiKey = () => {
    if (selectedService === 'openai') {
      return !!user?.openaiApiKey
    } else if (selectedService === 'anthropic') {
      return !!user?.anthropicApiKey
    }
    return false
  }

  // Get the API key for the selected service
  const getApiKey = () => {
    if (selectedService === 'openai') {
      return user?.openaiApiKey
    } else if (selectedService === 'anthropic') {
      return user?.anthropicApiKey
    }
    return null
  }

  // Generate AI text
  const generateText = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a prompt describing how you want to modify the selected text.",
        variant: "destructive",
      })
      return
    }

    if (!hasRequiredApiKey()) {
      toast({
        title: "API Key Required",
        description: `Please configure your ${selectedService === 'openai' ? 'OpenAI' : 'Anthropic'} API key first.`,
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const apiKey = getApiKey()
      if (!apiKey) throw new Error("API key not available")

      const request: AIGenerationRequest = {
        prompt: prompt.trim(),
        selectedText,
        fullContent,
        sceneContext,
        contentType,
        service: selectedService,
        apiKey
      }

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate text')
      }

      if (result.success && result.text) {
        setGeneratedText(result.text)
        setShowPreview(true)
        toast({
          title: "Text Generated!",
          description: `AI has generated new text using ${result.service}.`,
        })
      } else {
        throw new Error('No text was generated')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate text'
      setError(errorMessage)
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Apply the generated text
  const applyGeneratedText = () => {
    if (generatedText.trim()) {
      onTextReplace(generatedText)
      onClose()
      toast({
        title: "Text Applied!",
        description: "The AI-generated text has been applied to your selection.",
      })
    }
  }

  // Regenerate text with the same prompt
  const regenerateText = () => {
    setGeneratedText("")
    setShowPreview(false)
    setError(null)
    generateText()
  }

  // Get service display name
  const getServiceDisplayName = (service: string) => {
    return service === 'openai' ? 'ChatGPT (GPT-4)' : 'Claude (Claude 3)'
  }

  // Get content type suggestions
  const getContentTypeSuggestions = () => {
    switch (contentType) {
      case 'script':
        return [
          "Make this dialogue more natural and conversational",
          "Add more emotional depth to this scene",
          "Make this action description more cinematic",
          "Improve the pacing and rhythm of this section",
          "Add more visual details and atmosphere"
        ]
      case 'description':
        return [
          "Make this description more vivid and engaging",
          "Add more sensory details",
          "Make this more cinematic and visual",
          "Improve the mood and atmosphere"
        ]
      case 'dialogue':
        return [
          "Make this dialogue more natural",
          "Add more emotion and subtext",
          "Make this more authentic to the character",
          "Improve the rhythm and flow"
        ]
      case 'action':
        return [
          "Make this action more dynamic",
          "Add more visual detail",
          "Improve the pacing",
          "Make this more cinematic"
        ]
      default:
        return [
          "Improve the writing quality",
          "Make this more engaging",
          "Add more detail and depth",
          "Improve the flow and readability"
        ]
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Text Editor
          </DialogTitle>
          <DialogDescription>
            Use AI to modify your selected text. The AI will consider the full context of your scene.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Service Selection */}
          <div className="space-y-3">
            <Label>AI Service</Label>
            <div className="flex gap-3">
              <Select value={selectedService} onValueChange={(value: 'openai' | 'anthropic') => setSelectedService(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">
                    <div className="flex items-center gap-2">
                      <span>ChatGPT (GPT-4)</span>
                      {user?.openaiApiKey ? (
                        <Badge variant="secondary" className="text-xs">✓ Available</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-red-400">No API Key</Badge>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="anthropic">
                    <div className="flex items-center gap-2">
                      <span>Claude (Claude 3)</span>
                      {user?.anthropicApiKey ? (
                        <Badge variant="secondary" className="text-xs">✓ Available</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-red-400">No API Key</Badge>
                      )}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {!hasRequiredApiKey() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/setup-ai', '_blank')}
                  className="text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                >
                  Setup API Key
                </Button>
              )}
            </div>
          </div>

          {/* Selected Text Display */}
          <div className="space-y-3">
            <Label>Selected Text ({selectedText.length} characters)</Label>
            <div className="p-3 bg-muted/20 rounded-lg border border-border">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {selectedText || 'No text selected'}
              </p>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="space-y-3">
            <Label>AI Prompt</Label>
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Describe how you want to modify the selected text...`}
              className="min-h-[100px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  generateText()
                }
              }}
            />
            
            {/* Quick Prompt Suggestions */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick Suggestions:</Label>
              <div className="flex flex-wrap gap-2">
                {getContentTypeSuggestions().map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setPrompt(suggestion)}
                    className="text-xs h-7 px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Scene Context (if available) */}
          {sceneContext && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Scene Context (AI will use this for better understanding)
              </Label>
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-sm text-blue-400 max-h-32 overflow-y-auto">
                  {sceneContext}
                </p>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-center">
            <Button
              onClick={generateText}
              disabled={!prompt.trim() || !hasRequiredApiKey() || isGenerating}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 min-w-[200px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate with AI
                </>
              )}
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Generated Text Preview */}
          {showPreview && generatedText && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Generated Text</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regenerateText}
                    disabled={isGenerating}
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Regenerate
                  </Button>
                </div>
              </div>
              
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {generatedText}
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={applyGeneratedText}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Apply Changes
                </Button>
              </div>
            </div>
          )}
        </div>

        {!showPreview && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
