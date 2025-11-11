# Complete Code for AI Text Editor

This document contains all the code needed to implement the AI text editor feature.

---

## 1. AI Services (`lib/ai-services.ts`)

```typescript
// Base interfaces
interface AIResponse {
  success: boolean
  data?: any
  error?: string
}

interface GenerateScriptRequest {
  prompt: string
  template: string
  model: string
  apiKey: string
}

// OpenAI Service
export class OpenAIService {
  static async generateScript(request: GenerateScriptRequest): Promise<AIResponse> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: "system", content: request.template },
            { role: "user", content: request.prompt }
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      })

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`)
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// Anthropic Service
export class AnthropicService {
  static async generateScript(request: GenerateScriptRequest): Promise<AIResponse> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': request.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          messages: [
            { role: "user", content: `${request.template}\n\n${request.prompt}` }
          ],
        }),
      })

      if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`)
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        }),
      })
      return response.status === 200 || response.status === 400
    } catch {
      return false
    }
  }
}
```

---

## 2. API Route (`app/api/ai/generate-text/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, AnthropicService } from '@/lib/ai-services'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, selectedText, fullContent, sceneContext, contentType, service, apiKey } = body

    if (!prompt || !service) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, service' },
        { status: 400 }
      )
    }

    // Get actual API keys from environment variables
    let actualApiKey = apiKey
    if (apiKey === 'use_env_vars' || !apiKey) {
      if (service === 'openai') {
        actualApiKey = process.env.OPENAI_API_KEY
      } else if (service === 'anthropic') {
        actualApiKey = process.env.ANTHROPIC_API_KEY
      }
    }

    if (!actualApiKey) {
      return NextResponse.json(
        { error: `API key not configured for ${service}` },
        { status: 400 }
      )
    }

    const systemPrompt = `You are a professional screenwriter and editor. Your task is to modify a specific portion of text within a larger script or scene.

CONTEXT:
- Full Scene Content: ${fullContent}
${sceneContext ? `- Scene Context: ${sceneContext}` : ''}
- Content Type: ${contentType || 'script'}

TASK:
- Original Selected Text: "${selectedText}"
- User Request: "${prompt}"

INSTRUCTIONS:
1. Generate ONLY the replacement text for the selected portion
2. Maintain consistency with the surrounding content and style
3. Ensure the new text flows naturally with the rest of the scene
4. Keep the same approximate length unless specifically requested otherwise
5. Preserve any formatting, dialogue tags, or script conventions
6. Do NOT include the full scene or surrounding text - only the replacement

RESPONSE FORMAT:
Return ONLY the new text that should replace the selected portion, nothing else.`

    const userPrompt = `Please modify this text: "${selectedText}"

User's request: ${prompt}

Generate only the replacement text:`

    let generatedText = ""

    if (service === 'openai') {
      const openaiResponse = await OpenAIService.generateScript({
        prompt: userPrompt,
        template: systemPrompt,
        model: 'gpt-4',
        apiKey: actualApiKey
      })
      
      if (!openaiResponse.success) {
        throw new Error(openaiResponse.error || 'OpenAI API failed')
      }
      
      generatedText = openaiResponse.data.choices[0].message.content
    } else if (service === 'anthropic') {
      const claudeResponse = await AnthropicService.generateScript({
        prompt: userPrompt,
        template: systemPrompt,
        model: 'claude-3-sonnet-20240229',
        apiKey: actualApiKey
      })
      
      if (!claudeResponse.success) {
        throw new Error(claudeResponse.error || 'Claude API failed')
      }
      
      generatedText = claudeResponse.data.content[0].text
    }

    return NextResponse.json({ 
      success: true, 
      text: generatedText,
      service: service.toUpperCase()
    })

  } catch (error) {
    console.error('AI text generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    )
  }
}
```

---

## 3. AI Text Editor Component (`components/ai-text-editor.tsx`)

```typescript
"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Bot, Sparkles, RotateCcw, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AITextEditorProps {
  isOpen: boolean
  onClose: () => void
  selectedText: string
  fullContent: string
  sceneContext?: string
  onTextReplace: (newText: string) => void
  contentType?: 'script' | 'description' | 'dialogue' | 'action'
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
  const [prompt, setPrompt] = useState("")
  const [selectedService, setSelectedService] = useState<'openai' | 'anthropic'>('openai')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setPrompt("")
      setGeneratedText("")
      setError(null)
      setShowPreview(false)
    }
  }, [isOpen])

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
          "Add more detail and depth"
        ]
    }
  }

  const generateText = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a prompt describing how you want to modify the selected text.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          selectedText,
          fullContent,
          sceneContext,
          contentType,
          service: selectedService,
          apiKey: "use_env_vars"
        }),
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

  const regenerateText = () => {
    setGeneratedText("")
    setShowPreview(false)
    setError(null)
    generateText()
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
          {/* AI Service Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">AI Service</label>
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
          </div>

          {/* Selected Text Display */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Selected Text ({selectedText.length} characters)</label>
            <div className="p-3 bg-muted/20 rounded-lg border border-border">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {selectedText || 'No text selected'}
              </p>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium">AI Prompt</label>
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe how you want to modify the selected text..."
              className="min-h-[100px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  generateText()
                }
              }}
            />
            
            {/* Quick Prompt Suggestions */}
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

          {/* Scene Context */}
          {sceneContext && (
            <div className="space-y-3">
              <label className="text-xs text-muted-foreground">
                Scene Context (AI will use this for better understanding)
              </label>
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
              disabled={!prompt.trim() || isGenerating}
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
                <label className="text-lg font-semibold">Generated Text</label>
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
```

---

## 4. Main Page Integration

```typescript
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Copy, Trash2, Upload, Bot } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import AITextEditor from "@/components/ai-text-editor"

export default function MyPage() {
  const { toast } = useToast()
  const [content, setContent] = useState("")
  const [showAITextEditor, setShowAITextEditor] = useState(false)
  const [aiEditData, setAiEditData] = useState<{
    selectedText: string
    fullContent: string
  } | null>(null)

  // Handle text selection
  const handleTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    const selection = target.value.substring(target.selectionStart, target.selectionEnd)
    
    setSelectedText(selection)
  }

  // Handle AI text edit
  const handleAITextEdit = (selectedText: string) => {
    setAiEditData({ selectedText, fullContent: content })
    setShowAITextEditor(true)
  }

  // Handle AI text replacement
  const handleAITextReplace = (newText: string) => {
    const target = document.querySelector('textarea') as HTMLTextAreaElement
    if (target) {
      const start = target.selectionStart
      const end = target.selectionEnd
      const currentValue = target.value
      const newValue = currentValue.substring(0, start) + newText + currentValue.substring(end)
      
      setContent(newValue)
    }
  }

  // Copy selection
  const copySelection = () => {
    navigator.clipboard.writeText(selectedText)
    toast({ title: "Copied!", description: "Selected text copied to clipboard" })
  }

  // Clear selection
  const clearSelection = () => {
    const target = document.querySelector('textarea') as HTMLTextAreaElement
    if (target) {
      const start = target.selectionStart
      const end = target.selectionEnd
      const newValue = target.value.substring(0, start) + target.value.substring(end)
      setContent(newValue)
      setSelectedText("")
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">My Text Editor</h1>
      
      <div className="space-y-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start typing..."
          className="min-h-[400px]"
          onSelect={handleTextSelection}
          onKeyDown={(e) => {
            // Ctrl/Cmd + Shift + A for AI edit
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
              e.preventDefault()
              if (selectedText) {
                handleAITextEdit(selectedText)
              }
            }
          }}
        />

        {/* Selection Actions */}
        {selectedText && (
          <div className="space-y-3">
            {/* Selection Info */}
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
              <span className="text-xs">
                Selected: {selectedText.length} characters
              </span>
              <span className="text-xs text-blue-400">
                💡 Use Ctrl/Cmd + Shift + A for quick AI editing
              </span>
            </div>
            
            {/* Quick Action Buttons */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copySelection}>
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
              <Button size="sm" variant="outline" onClick={clearSelection}>
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
            
            {/* AI Edit Section */}
            <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-purple-400">
                  🤖 AI-Powered Text Editing
                </span>
                <Button size="sm" variant="outline" onClick={() => handleAITextEdit(selectedText)}>
                  <Bot className="h-3 w-3 mr-1" />
                  Edit with AI
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use AI to rewrite, improve, or modify your selected text.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* AI Text Editor Modal */}
      {showAITextEditor && aiEditData && (
        <AITextEditor
          isOpen={showAITextEditor}
          onClose={() => {
            setShowAITextEditor(false)
            setAiEditData(null)
          }}
          selectedText={aiEditData.selectedText}
          fullContent={aiEditData.fullContent}
          onTextReplace={handleAITextReplace}
          contentType="script"
        />
      )}
    </div>
  )
}
```

---

## 5. Environment Variables (`.env.local`)

```bash
# Required
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 6. Dependencies (`package.json`)

```json
{
  "dependencies": {
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "lucide-react": "^0.294.0"
  }
}
```

---

## Testing Checklist

- [ ] Text selection works
- [ ] Selection UI appears
- [ ] Copy/Clear buttons work
- [ ] AI button opens modal
- [ ] Ctrl/Cmd + Shift + A shortcut works
- [ ] AI service selection works
- [ ] Quick suggestions populate
- [ ] Generate button works
- [ ] Loading state shows
- [ ] Preview displays generated text
- [ ] Regenerate works
- [ ] Apply replaces text correctly
- [ ] Error handling works
- [ ] Cancel closes modal

---

## Key Points

1. **API Keys**: Use environment variables
2. **Context**: Always pass full document content
3. **Replacements**: Return only the replacement text
4. **Keyboard Shortcuts**: Implement Ctrl/Cmd + Shift + A
5. **Mobile Support**: Handle selection differently on mobile
6. **Error Handling**: Show user-friendly errors
7. **Loading States**: Provide visual feedback

---

That's it! You now have all the code needed to implement the AI text editor feature.

