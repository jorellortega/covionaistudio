"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import AITextEditor from "@/components/ai-text-editor"

export default function TestAIEditorPage() {
  const [text, setText] = useState(`INT. COFFEE SHOP - DAY

Sarah sits at a corner table, nervously tapping her fingers on the table. She glances at her watch every few seconds.

SARAH
(whispering to herself)
Come on, come on...

The door chimes and Mark enters, looking around the crowded shop. Sarah waves him over.

SARAH
Mark! Over here!

Mark spots her and makes his way through the tables. He looks tired but relieved to see her.

MARK
Sorry I'm late. Traffic was a nightmare.

SARAH
No worries. I was just getting worried something happened.

They sit in comfortable silence for a moment, both processing the weight of their meeting.`)

  const [selectedText, setSelectedText] = useState("")
  const [showAIEditor, setShowAIEditor] = useState(false)

  const handleTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    const selection = target.value.substring(target.selectionStart, target.selectionEnd)
    setSelectedText(selection)
  }

  const handleAITextReplace = (newText: string) => {
    if (selectedText) {
      const target = document.querySelector('textarea') as HTMLTextAreaElement
      if (target) {
        const start = target.selectionStart
        const end = target.selectionEnd
        const newValue = target.value.substring(0, start) + newText + target.value.substring(end)
        setText(newValue)
        setSelectedText("")
      }
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">AI Text Editor Test</h1>
          <p className="text-muted-foreground">
            Select text in the script below and use AI to edit it. The AI will consider the full context of your scene.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Script Content</label>
            <p className="text-xs text-muted-foreground mb-2">
              Select any text and use the AI editor to modify it
            </p>
          </div>
          
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onSelect={handleTextSelection}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Enter your script here..."
          />

          {selectedText && (
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-400">
                  Selected Text ({selectedText.length} characters)
                </span>
                <Button
                  size="sm"
                  onClick={() => setShowAIEditor(true)}
                  className="bg-purple-500 hover:bg-purple-600"
                >
                  Edit with AI
                </Button>
              </div>
              <p className="text-sm text-foreground bg-background p-2 rounded border">
                {selectedText}
              </p>
            </div>
          )}
        </div>

        {/* AI Text Editor */}
        {showAIEditor && (
          <AITextEditor
            isOpen={showAIEditor}
            onClose={() => setShowAIEditor(false)}
            selectedText={selectedText}
            fullContent={text}
            sceneContext="This is a scene where Sarah and Mark meet in a coffee shop. Sarah is anxious and waiting for Mark, who arrives late due to traffic. They seem to have an important meeting."
            onTextReplace={handleAITextReplace}
            contentType="script"
          />
        )}
      </div>
    </div>
  )
}
