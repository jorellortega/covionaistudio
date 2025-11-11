# Quick Instructions for Building AI Text Editor

## Give this to the AI:

---

I need to build an AI-powered text editor with inline editing capabilities. Here are the requirements:

## Core Features

### 1. Text Selection & Inline Editing
- Users can select text in a `<textarea>` element
- When text is selected, show:
  - Character count: "Selected: 156 characters"
  - Quick actions: Copy, Clear, Paste buttons
  - AI button: "Edit with AI"
  - Hint: "💡 Use Ctrl/Cmd + Shift + A for quick AI editing"

### 2. AI Text Editor Modal
- Opens when user clicks "Edit with AI" or presses Ctrl/Cmd + Shift + A
- Shows:
  - AI Service selection dropdown (OpenAI GPT-4 or Anthropic Claude)
  - Selected text preview
  - Prompt textarea
  - Quick suggestion buttons
  - "Generate with AI" button
  - Preview area (shows generated text)
  - "Regenerate" and "Apply Changes" buttons

### 3. AI Generation
- Uses full document content for context
- Returns ONLY the replacement text (not full document)
- Shows loading spinner during generation
- Displays errors if generation fails

### 4. Apply Changes
- Replaces selected text with AI-generated text
- Closes modal after applying
- Shows success toast notification

## Technical Requirements

### State Management
```typescript
const [inlineEditing, setInlineEditing] = useState<{
  value: string
  selection?: string
} | null>(null)

const [aiEditData, setAiEditData] = useState<{
  selectedText: string
  fullContent: string
} | null>(null)

const [showAITextEditor, setShowAITextEditor] = useState(false)
```

### Text Selection Handler
```typescript
const handleTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
  const target = e.target as HTMLTextAreaElement
  const selection = target.value.substring(target.selectionStart, target.selectionEnd)
  
  if (selection.length > 0) {
    setInlineEditing(prev => prev ? { ...prev, selection } : null)
  }
}
```

### AI Text Replacement
```typescript
const handleAITextReplace = (newText: string) => {
  const target = document.querySelector('textarea') as HTMLTextAreaElement
  const start = target.selectionStart
  const end = target.selectionEnd
  const newValue = target.value.substring(0, start) + newText + target.value.substring(end)
  
  setInlineEditing(prev => prev ? { ...prev, value: newValue } : null)
}
```

### API Endpoint
```
POST /api/ai/generate-text

Request Body:
{
  prompt: string              // User's editing request
  selectedText: string        // The text to be modified
  fullContent: string         // Complete document for context
  contentType: string         // "script", "description", etc.
  service: "openai" | "anthropic"
}

System Prompt:
"""
You are a professional screenwriter and editor. Your task is to modify a specific portion of text within a larger document.

CONTEXT:
- Full Content: {fullContent}
- Content Type: {contentType}

TASK:
- Original Selected Text: "{selectedText}"
- User Request: "{prompt}"

INSTRUCTIONS:
1. Generate ONLY the replacement text for the selected portion
2. Maintain consistency with surrounding content and style
3. Ensure the new text flows naturally with the rest
4. Keep similar length unless requested otherwise
5. Do NOT include the full document - only the replacement

RESPONSE FORMAT:
Return ONLY the new text that should replace the selected portion, nothing else.
"""

Response:
{
  success: true,
  text: string
}
```

### Environment Variables
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Dependencies
```json
{
  "openai": "^4.x.x",
  "@anthropic-ai/sdk": "^0.x.x"
}
```

## UI Components Needed

1. **Textarea** with:
   - `onSelect={handleTextSelection}`
   - `onKeyDown` for Ctrl/Cmd + Shift + A shortcut

2. **Selection Actions Bar** (appears when text selected):
   ```
   ┌─────────────────────────────────────────┐
   │ Selected: 156 characters                │
   │ 💡 Use Ctrl/Cmd + Shift + A for quick  │
   └─────────────────────────────────────────┘
   [Copy] [Clear] [Paste]
   
   ┌─────────────────────────────────────────┐
   │ 🤖 AI-Powered Text Editing              │
   │ Use AI to rewrite your selected text    │
   │ [Edit with AI]                          │
   └─────────────────────────────────────────┘
   ```

3. **AI Editor Modal**:
   ```
   ┌─────────────────────────────────────────┐
   │ 🤖 AI Text Editor                       │
   ├─────────────────────────────────────────┤
   │ AI Service: [ChatGPT ✓] [Claude ✓]     │
   │                                         │
   │ Selected Text (156 chars)               │
   │ ┌─────────────────────────────────────┐ │
   │ │ "He walked to the door."            │ │
   │ └─────────────────────────────────────┘ │
   │                                         │
   │ Prompt                                  │
   │ ┌─────────────────────────────────────┐ │
   │ │ Make this more cinematic...         │ │
   │ └─────────────────────────────────────┘ │
   │                                         │
   │ Quick Suggestions:                      │
   │ [Make more vivid] [Add emotion]        │
   │                                         │
   │ [✨ Generate with AI]                   │
   │                                         │
   │ Generated Text:                         │
   │ ┌─────────────────────────────────────┐ │
   │ │ "His footsteps echoed through the   │ │
   │ │  empty hallway as he approached..." │ │
   │ └─────────────────────────────────────┘ │
   │                                         │
   │ [⟳ Regenerate] [✓ Apply Changes]       │
   └─────────────────────────────────────────┘
   ```

## Quick Suggestions (Default)

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

**For Dialogue:**
- "Make this dialogue more natural"
- "Add more emotion and subtext"
- "Make this more authentic to the character"

## File Structure

```
components/
  ├── ai-text-editor.tsx       # Main modal component
  └── ui/
      ├── dialog.tsx            # Modal wrapper
      ├── textarea.tsx          # Text input
      └── button.tsx            # Buttons

lib/
  ├── ai-services.ts            # OpenAI & Anthropic clients
  └── ai-settings-service.ts    # User preferences (optional)

app/api/ai/
  └── generate-text/
      └── route.ts              # API endpoint

app/
  └── timeline-scene/
      └── [id]/
          └── page.tsx          # Main integration
```

## Key Functions to Implement

1. `handleTextSelection()` - Capture text selection
2. `handleAITextEdit()` - Open AI editor modal
3. `generateText()` - Call AI API
4. `handleAITextReplace()` - Replace selected text
5. `getQuickSuggestions()` - Return suggestions by type

## Testing

1. Select text in textarea
2. Verify selection UI appears
3. Click "Edit with AI"
4. Enter prompt and generate
5. Apply changes
6. Verify text is replaced correctly

---

**Reference**: See `AI_TEXT_EDITOR_IMPLEMENTATION_GUIDE.md` for complete code examples and detailed implementation.

---

## Deliverable

Build a fully functional AI text editor that:
- ✅ Captures text selections
- ✅ Opens modal with AI options
- ✅ Generates context-aware text replacements
- ✅ Applies changes seamlessly
- ✅ Has keyboard shortcuts
- ✅ Shows loading/error states
- ✅ Uses environment variables for API keys

