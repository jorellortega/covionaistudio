"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Bot, Sparkles, RotateCcw, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/AuthProvider"
import { AISettingsService, AISetting } from "@/lib/ai-settings-service"

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
  const { user, userId, loading } = useAuth()
  const [prompt, setPrompt] = useState("")
  const [selectedService, setSelectedService] = useState<'openai' | 'anthropic'>('openai')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  
  // Custom suggestions editing state
  const [showEditSuggestions, setShowEditSuggestions] = useState(false)
  const [editingSuggestions, setEditingSuggestions] = useState<string[]>([])
  const [newSuggestion, setNewSuggestion] = useState("")
  const [isSavingSuggestions, setIsSavingSuggestions] = useState(false)
  
  // Quick suggestions visibility state
  const [showQuickSuggestions, setShowQuickSuggestions] = useState(false)

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

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (loading) return
      if (!userId) return
      
      try {
        const settings = await AISettingsService.getUserSettings(userId)
        
        // Get or create default setting for scripts tab
        const defaultSetting = await AISettingsService.getOrCreateDefaultTabSetting(userId, 'scripts')
        
        // Merge with existing setting, preferring existing
        const existingSetting = settings.find(s => s.tab_type === 'scripts')
        const finalSetting = existingSetting || defaultSetting
        
        setAiSettings([finalSetting])
        setAiSettingsLoaded(true)
        
        // Auto-select locked model if available
        if (finalSetting.is_locked && finalSetting.locked_model) {
          if (finalSetting.locked_model === 'ChatGPT') {
            setSelectedService('openai')
          } else if (finalSetting.locked_model === 'Claude') {
            setSelectedService('anthropic')
          }
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
  }, [loading, userId])

  // Check if current content type is locked
  const isCurrentContentTypeLocked = () => {
    const setting = aiSettings.find(s => s.tab_type === 'scripts')
    return setting?.is_locked || false
  }

  // Get the locked model for current content type
  const getCurrentContentTypeLockedModel = () => {
    const setting = aiSettings.find(s => s.tab_type === 'scripts')
    return setting?.locked_model || ""
  }

  // Check if user has required API key
  const hasRequiredApiKey = () => {
    // For now, assume API keys are configured elsewhere
    // This would need to be implemented based on your API key storage strategy
    return true
  }

      // Get the API key for the selected service
    const getApiKey = () => {
        if (selectedService === 'openai') {
          return "configured" // API key would be configured elsewhere
        } else if (selectedService === 'anthropic') {
          return "configured" // API key would be configured elsewhere
        }
      return null
    }

  // Get quick suggestions from AI settings or use defaults
  const getQuickSuggestions = () => {
    // If we have custom suggestions from AI settings, use those
    if (aiSettings.length > 0) {
      const scriptSetting = aiSettings.find(s => s.tab_type === 'scripts')
      if (scriptSetting?.quick_suggestions && scriptSetting.quick_suggestions.length > 0) {
        return scriptSetting.quick_suggestions
      }
    }
    
    // Fallback to default suggestions based on content type
    return getContentTypeSuggestions()
  }

  // Open suggestions editor
  const openSuggestionsEditor = () => {
    const currentSuggestions = getQuickSuggestions()
    setEditingSuggestions([...currentSuggestions])
    setShowEditSuggestions(true)
  }

  // Add new suggestion
  const addSuggestion = () => {
    if (newSuggestion.trim() && !editingSuggestions.includes(newSuggestion.trim())) {
      setEditingSuggestions([...editingSuggestions, newSuggestion.trim()])
      setNewSuggestion("")
    }
  }

  // Remove suggestion
  const removeSuggestion = (index: number) => {
    setEditingSuggestions(editingSuggestions.filter((_, i) => i !== index))
  }

  // Save custom suggestions
  const saveCustomSuggestions = async () => {
    if (!userId) return
    
    try {
      setIsSavingSuggestions(true)
      
      // Update the AI settings with new suggestions
      await AISettingsService.updateQuickSuggestions(
        userId,
        'scripts',
        editingSuggestions
      )
      
      // Refresh AI settings
      const settings = await AISettingsService.getUserSettings(userId)
      setAiSettings(settings)
      
      setShowEditSuggestions(false)
      toast({
        title: "Suggestions Saved!",
        description: "Your custom quick suggestions have been updated.",
      })
    } catch (error) {
      console.error('Error saving suggestions:', error)
      toast({
        title: "Save Failed",
        description: "Failed to save your custom suggestions. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingSuggestions(false)
    }
  }

  // Reset to default suggestions
  const resetToDefaults = () => {
    const defaultSuggestions = getContentTypeSuggestions()
    setEditingSuggestions([...defaultSuggestions])
    toast({
      title: "Reset to Defaults",
      description: "Suggestions have been reset to the default set.",
    })
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
          {/* AI Service Selection - Only show if not locked */}
          {!isCurrentContentTypeLocked() && (
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
                        <Badge variant="secondary" className="text-xs">✓ Available</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="anthropic">
                      <div className="flex items-center gap-2">
                        <span>Claude (Claude 3)</span>
                        <Badge variant="secondary" className="text-xs">✓ Available</Badge>
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
          )}

          {/* Show locked model info if content type is locked */}
          {isCurrentContentTypeLocked() && (
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <p className="text-sm text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                AI Online
              </p>
            </div>
          )}

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
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowQuickSuggestions(!showQuickSuggestions)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <span>Quick Suggestions</span>
                  <span className={`transition-transform duration-200 ${showQuickSuggestions ? 'rotate-90' : ''}`}>
                    &gt;
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openSuggestionsEditor}
                  className="text-xs h-6 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                >
                  Edit
                </Button>
              </div>
              
              {showQuickSuggestions && (
                <div className="flex flex-wrap gap-2">
                  {getQuickSuggestions().map((suggestion, index) => (
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
              )}
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

      {/* Custom Suggestions Editor Modal */}
      <Dialog open={showEditSuggestions} onOpenChange={setShowEditSuggestions}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Quick Suggestions</DialogTitle>
            <DialogDescription>
              Customize your quick suggestions for AI text editing. These will be saved and used whenever you open the AI Text Editor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add New Suggestion */}
            <div className="space-y-2">
              <Label>Add New Suggestion</Label>
              <div className="flex gap-2">
                <Input
                  value={newSuggestion}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSuggestion(e.target.value)}
                  placeholder="Enter a new suggestion..."
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      addSuggestion()
                    }
                  }}
                />
                <Button
                  onClick={addSuggestion}
                  disabled={!newSuggestion.trim() || editingSuggestions.includes(newSuggestion.trim())}
                  size="sm"
                  className="px-4"
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Current Suggestions */}
            <div className="space-y-2">
              <Label>Current Suggestions ({editingSuggestions.length})</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {editingSuggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No suggestions yet. Add some above!
                  </p>
                ) : (
                  editingSuggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg border border-border">
                      <span className="flex-1 text-sm">{suggestion}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSuggestion(index)}
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        ×
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Help Text */}
            <div className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> You can have up to 20 suggestions. Keep them concise and specific to your workflow.
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              disabled={isSavingSuggestions}
              className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            >
              Reset to Defaults
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowEditSuggestions(false)}
              disabled={isSavingSuggestions}
            >
              Cancel
            </Button>
            <Button
              onClick={saveCustomSuggestions}
              disabled={isSavingSuggestions}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {isSavingSuggestions ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Save Suggestions
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
