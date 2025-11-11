# AI Text Editor Implementation Guide

This document provides complete instructions for rebuilding the AI-powered text editor feature from the cinema platform on another website.

## Table of Contents
1. [Overview](#overview)
2. [Core Components](#core-components)
3. [API Endpoints](#api-endpoints)
4. [Features & Functionality](#features--functionality)
5. [Step-by-Step Implementation](#step-by-step-implementation)
6. [Key Files Reference](#key-files-reference)
7. [Environment Variables](#environment-variables)
8. [Database Schema](#database-schema)
9. [Testing](#testing)

---

## Overview

The AI Text Editor is a feature-rich inline text editing system with AI-powered rewriting capabilities. It allows users to:

- **Select text** in a textarea and edit it inline
- **Use AI** (OpenAI GPT-4 or Anthropic Claude) to rewrite/modify selected text
- **Maintain context** with the full document while editing snippets
- **Customize prompts** with quick suggestions
- **Track versions** of edits
- **Keyboard shortcuts** for efficient editing

---

## Core Components

### 1. AITextEditor Component (`components/ai-text-editor.tsx`)

The main modal/dialog component that handles AI text generation.

**Key Props:**
```typescript
interface AITextEditorProps {
  isOpen: boolean
  onClose: () => void
  selectedText: string
  fullContent: string
  sceneContext?: string
  onTextReplace: (newText: string) => void
  contentType?: 'script' | 'description' | 'dialogue' | 'action'
  customGenerateFunction?: (prompt: string, selectedText: string, service: 'openai' | 'anthropic') => Promise<string | null>
}
```

**Key Features:**
- AI service selection (OpenAI/Anthropic)
- Customizable quick suggestions
- Context-aware editing
- Preview before apply
- Regenerate with same prompt
- Keyboard shortcut: Ctrl/Cmd + Shift + A

### 2. Text Selection Handler

Captures text selection and enables inline editing:

```typescript
const handleTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
  e.stopPropagation()
  e.preventDefault()
  
  const target = e.target as HTMLTextAreaElement
  let selection = ''
  
  // Desktop: use standard selection properties
  selection = target.value.substring(target.selectionStart, target.selectionEnd)
  
  if (selection.length > 0) {
    // Store selection for context menu actions
    setInlineEditing(prev => prev ? { ...prev, selection } : null)
  } else {
    // Clear selection
    setInlineEditing(prev => prev ? { ...prev, selection: undefined } : null)
  }
}
```

### 3. Inline Editing State

```typescript
const [inlineEditing, setInlineEditing] = useState<{
  assetId: string;
  field: 'title' | 'content' | 'version_name';
  value: string;
  selection?: string;
} | null>(null)
```

### 4. AI Text Replacement Handler

```typescript
const handleAITextReplace = (newText: string) => {
  if (!aiEditData || !inlineEditing) return
  
  const target = document.querySelector('textarea') as HTMLTextAreaElement
  if (target) {
    const start = target.selectionStart
    const end = target.selectionEnd
    const currentValue = target.value
    const newValue = currentValue.substring(0, start) + newText + currentValue.substring(end)
    
    // Update the inline editing value
    handleInlineEditChange(newValue)
  }
}
```

---

## API Endpoints

### 1. Generate Text API (`/api/ai/generate-text/route.ts`)

**Endpoint:** `POST /api/ai/generate-text`

**Request Body:**
```typescript
{
  prompt: string                    // User's editing request
  selectedText: string              // The text to be modified
  fullContent: string               // Complete document content for context
  sceneContext?: string             // Additional context/metadata
  contentType: string               // Type of content being edited
  service: 'openai' | 'anthropic'  // AI service to use
  apiKey: string                    // User's API key (can be "use_env_vars")
}
```

**System Prompt (for context-aware editing):**
```
You are a professional screenwriter and editor. Your task is to modify a specific portion of text within a larger script or scene.

CONTEXT:
- Full Scene Content: {fullContent}
- Scene Context: {sceneContext}
- Content Type: {contentType}

TASK:
- Original Selected Text: "{selectedText}"
- User Request: "{prompt}"

INSTRUCTIONS:
1. Generate ONLY the replacement text for the selected portion
2. Maintain consistency with the surrounding content and style
3. Ensure the new text flows naturally with the rest of the scene
4. Keep the same approximate length unless specifically requested otherwise
5. Preserve any formatting, dialogue tags, or script conventions
6. Do NOT include the full scene or surrounding text - only the replacement

RESPONSE FORMAT:
Return ONLY the new text that should replace the selected portion, nothing else.
```

**Response:**
```typescript
{
  success: true,
  text: string,    // Generated replacement text
  service: string  // "OPENAI" or "CLAUDE"
}
```

---

## Features & Functionality

### 1. Text Selection UI

When text is selected in the textarea, show:

```
┌─────────────────────────────────────────────┐
│ Selected: 156 characters                    │
│ 💡 Use Ctrl/Cmd + Shift + A for quick AI   │
└─────────────────────────────────────────────┘

[Copy] [Clear] [Paste]

┌─────────────────────────────────────────────┐
│ 🤖 AI-Powered Text Editing                  │
│                                             │
│ Use AI to rewrite, improve, or modify your │
│ selected text while maintaining context.    │
│                                             │
│ [Edit with AI]                              │
└─────────────────────────────────────────────┘
```

### 2. Quick Suggestions

Default suggestions based on content type:

**For Scripts:**
- "Make this dialogue more natural and conversational"
- "Add more emotional depth to this scene"
- "Make this action description more cinematic"
- "Improve the pacing and rhythm of this section"
- "Add more visual details and atmosphere"

**For Descriptions:**
- "Make this description more vivid and engaging"
- "Add more sensory details"
- "Make this more cinematic and visual"
- "Improve the mood and atmosphere"

### 3. AI Service Selection

If not locked, show dropdown:
```
AI Service: [ChatGPT (GPT-4) ✓ Available]
           [Claude (Claude 3) ✓ Available]
           
[Setup API Key] (if needed)
```

If locked, show:
```
┌─────────────────────────────────────────────┐
│ ✓ AI Online                                 │
└─────────────────────────────────────────────┘
```

### 4. Custom Suggestions Editor

Allow users to edit their quick suggestions:
- Add new suggestions
- Remove existing suggestions
- Reset to defaults
- Save changes to database

### 5. Preview & Apply Workflow

1. User enters prompt
2. Click "Generate with AI"
3. Show loading spinner
4. Display generated text in preview area
5. Show "Regenerate" and "Apply Changes" buttons
6. On apply: replace selected text and close modal

---

## Step-by-Step Implementation

### Step 1: Set Up Dependencies

```bash
npm install openai anthropic
```

Or if using environment variables:
```typescript
// lib/ai-services.ts
export class OpenAIService {
  static async generateScript(request: GenerateScriptRequest): Promise<AIResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          { role: "system", content: `You are a professional screenwriter. ${request.template}` },
          { role: "user", content: request.prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })
    // ... error handling
  }
}
```

### Step 2: Create the AI Text Editor Component

Copy `components/ai-text-editor.tsx` from the codebase and adapt:

**Key functions to implement:**
- `generateText()` - Calls API to generate text
- `applyGeneratedText()` - Replaces selected text
- `regenerateText()` - Regenerates with same prompt
- `getQuickSuggestions()` - Returns suggestions based on content type
- `loadAISettings()` - Loads user preferences

### Step 3: Create the Text Selection UI

In your main page component:

```typescript
// State
const [inlineEditing, setInlineEditing] = useState<{
  assetId: string;
  field: 'content';
  value: string;
  selection?: string;
} | null>(null)

const [aiEditData, setAiEditData] = useState<{
  selectedText: string;
  fullContent: string;
  assetId: string;
  field: 'content';
} | null>(null)

const [showAITextEditor, setShowAITextEditor] = useState(false)

// Handlers
const handleTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
  // ... selection capture logic
}

const handleAITextEdit = (selectedText: string, fullContent: string, assetId: string) => {
  setAiEditData({ selectedText, fullContent, assetId, field: 'content' })
  setShowAITextEditor(true)
}

const handleAITextReplace = (newText: string) => {
  if (!aiEditData || !inlineEditing) return
  // ... text replacement logic
}
```

### Step 4: Implement the Textarea with Selection

```typescript
<Textarea
  value={inlineEditing.value}
  onChange={(e) => handleInlineEditChange(e.target.value)}
  className="w-full h-96 p-4 border border-primary/30"
  autoFocus
  onSelect={handleTextSelection}
  onKeyDown={(e) => {
    // Ctrl/Cmd + Shift + A for AI edit
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
      e.preventDefault()
      if (inlineEditing?.selection && inlineEditing.assetId) {
        handleAITextEdit(
          inlineEditing.selection,
          fullContent,
          inlineEditing.assetId
        )
      }
    }
  }}
/>

{/* Selection Actions */}
{inlineEditing?.selection && (
  <div className="space-y-3">
    {/* Selection info */}
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
      <span className="text-xs">Selected: {inlineEditing.selection.length} characters</span>
      <span className="text-xs text-blue-400">
        💡 Use Ctrl/Cmd + Shift + A for quick AI editing
      </span>
    </div>
    
    {/* Action buttons */}
    <div className="flex gap-1">
      <Button size="sm" onClick={copySelection}>Copy</Button>
      <Button size="sm" onClick={clearSelection}>Clear</Button>
      <Button size="sm" onClick={pasteFromClipboard}>Paste</Button>
    </div>
    
    {/* AI Edit Section */}
    <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
      <Button onClick={handleAIEditClick}>
        <Bot className="h-4 w-4 mr-2" />
        Edit with AI
      </Button>
    </div>
  </div>
)}
```

### Step 5: Add the AI Text Editor Modal

```typescript
{showAITextEditor && aiEditData && (
  <AITextEditor
    isOpen={showAITextEditor}
    onClose={() => {
      setShowAITextEditor(false)
      setAiEditData(null)
    }}
    selectedText={aiEditData.selectedText}
    fullContent={aiEditData.fullContent}
    sceneContext={sceneContext}
    onTextReplace={handleAITextReplace}
    contentType="script"
  />
)}
```

### Step 6: Create the API Route

```typescript
// app/api/ai/generate-text/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, AnthropicService } from '@/lib/ai-services'

export async function POST(request: NextRequest) {
  try {
    const { prompt, selectedText, fullContent, sceneContext, contentType, service, apiKey } = await request.json()

    // Get actual API keys from environment variables if needed
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

    const systemPrompt = `You are a professional screenwriter and editor...
[See full prompt above]`

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
      generatedText = openaiResponse.data.choices[0].message.content
    } else if (service === 'anthropic') {
      const claudeResponse = await AnthropicService.generateScript({
        prompt: userPrompt,
        template: systemPrompt,
        model: 'claude-3-sonnet-20240229',
        apiKey: actualApiKey
      })
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

## Key Files Reference

### Components
1. **`components/ai-text-editor.tsx`** - Main AI editor modal (741 lines)
   - AI service selection
   - Quick suggestions
   - Generate/preview/apply workflow
   - Custom suggestions editor

2. **`components/ui/dialog.tsx`** - Base dialog component (shadcn/ui)
3. **`components/ui/textarea.tsx`** - Textarea component (shadcn/ui)
4. **`components/ui/button.tsx`** - Button component (shadcn/ui)

### Services
1. **`lib/ai-services.ts`** - AI API integrations
   - `OpenAIService.generateScript()`
   - `AnthropicService.generateScript()`

2. **`lib/ai-settings-service.ts`** - AI settings management
   - `getUserSettings()`
   - `getTabSetting()`
   - `updateQuickSuggestions()`

### API Routes
1. **`app/api/ai/generate-text/route.ts`** - Text generation endpoint

### Main Integration
1. **`app/(protected)/timeline-scene/[id]/page.tsx`** - Main page integration
   - Lines 610-649: Text selection handler
   - Lines 652-681: AI text edit handlers
   - Lines 878-952: Save inline edit functions
   - Lines 1808-1974: Textarea with selection UI
   - Lines 3997-4011: AI Text Editor modal integration

---

## Environment Variables

Add to your `.env.local`:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Supabase (if using database for settings)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Database Schema

### ai_settings Table (Optional)

If you want to persist user preferences:

```sql
CREATE TABLE ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tab_type TEXT NOT NULL CHECK (tab_type IN ('scripts', 'images', 'videos', 'audio', 'timeline')),
  locked_model TEXT NOT NULL,
  is_locked BOOLEAN DEFAULT false,
  quick_suggestions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tab_type)
);

CREATE INDEX idx_ai_settings_user_tab ON ai_settings(user_id, tab_type);
```

---

## Testing

### Manual Testing Checklist

1. **Text Selection**
   - ✅ Select text in textarea
   - ✅ Selection info appears
   - ✅ Copy/Clear/Paste buttons work
   - ✅ AI edit button appears

2. **Keyboard Shortcuts**
   - ✅ Ctrl/Cmd + Shift + A opens AI editor
   - ✅ Ctrl/Cmd + Enter saves changes

3. **AI Editor**
   - ✅ Modal opens with selected text
   - ✅ Service selection works
   - ✅ Quick suggestions populate prompt
   - ✅ Generate button works
   - ✅ Loading state displays
   - ✅ Preview shows generated text
   - ✅ Regenerate works
   - ✅ Apply replaces selected text
   - ✅ Cancel closes modal

4. **Error Handling**
   - ✅ Invalid API key shows error
   - ✅ Network errors are caught
   - ✅ Empty selections are prevented

### Sample Test Cases

**Test 1: Basic Rewrite**
```
Selected Text: "He walked to the door."
Prompt: "Make this action more cinematic and add tension"
Expected: Text describing walking with cinematic details and tension
```

**Test 2: Context-Aware Edit**
```
Full Content: "INT. LIVING ROOM - NIGHT
John sits in a chair. He walked to the door."

Selected Text: "He walked to the door."
Prompt: "Make this match the mood of the scene"
Expected: Walking description that matches nighttime interior mood
```

**Test 3: Dialogue Improvement**
```
Selected Text: "I don't know."
Prompt: "Make this dialogue more natural and specific to show internal struggle"
Expected: More natural, emotionally specific dialogue
```

---

## Quick Start Command

Provide this to the AI to build the feature:

```
I need to build an AI-powered text editor with the following features:

1. Text Selection UI
   - Show selection info (character count)
   - Quick action buttons (Copy, Clear, Paste)
   - AI edit button
   - Keyboard shortcut: Ctrl/Cmd + Shift + A

2. AI Text Editor Modal
   - AI service selection (OpenAI GPT-4 or Anthropic Claude)
   - Context-aware editing (uses full document for context)
   - Customizable quick suggestions
   - Preview before applying
   - Regenerate functionality

3. API Integration
   - POST /api/ai/generate-text
   - Supports both OpenAI and Anthropic
   - System prompt for context-aware editing
   - Returns only replacement text (not full document)

4. Key Components Needed
   - AITextEditor.tsx: Main modal component
   - Text selection handler: Captures textarea selections
   - AI text replacement handler: Injects generated text back
   - Save functionality: Creates new versions with edits

5. Environment Variables
   - OPENAI_API_KEY
   - ANTHROPIC_API_KEY

Please build this using the AI_TEXT_EDITOR_IMPLEMENTATION_GUIDE.md as reference.
```

---

## Additional Features (Optional)

### Version Control
- Save edits as new versions
- Compare versions side-by-side
- Rollback to previous versions

### Custom Suggestions Management
- Let users edit their quick suggestions
- Save to database per user
- Reset to defaults

### Content Type Optimization
- Different default suggestions per content type
- Type-specific system prompts
- Better context understanding

### Advanced AI Features
- Tone adjustment
- Length control
- Style templates
- Batch editing

---

## Support & Troubleshooting

### Common Issues

**API Key Not Working**
- Check environment variables are loaded
- Verify API keys are valid
- Check network connectivity

**Text Replacement Not Working**
- Ensure textarea is properly selected
- Check selection boundaries
- Verify textarea ref is accessible

**AI Generating Full Text**
- Verify system prompt is correct
- Check that instruction "only replacement" is clear
- Adjust temperature if needed

**Selection Not Capturing**
- Check onSelect handler is attached
- Verify desktop vs mobile handling
- Check event propagation

---

## License & Credits

This implementation guide is based on the cinema-platform codebase. Adapt as needed for your project.

