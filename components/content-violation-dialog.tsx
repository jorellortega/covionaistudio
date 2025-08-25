"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, Lightbulb, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ContentViolationDialogProps {
  isOpen: boolean
  onClose: () => void
  onTryDifferentPrompt: () => void
  onTryDifferentAI: () => void
  contentType: 'script' | 'image' | 'video' | 'audio'
  originalPrompt: string
}

export function ContentViolationDialog({
  isOpen,
  onClose,
  onTryDifferentPrompt,
  onTryDifferentAI,
  contentType,
  originalPrompt
}: ContentViolationDialogProps) {
  const getContentTypeInfo = () => {
    switch (contentType) {
      case 'script':
        return {
          title: 'Script Generation Blocked',
          description: 'The AI detected content that may violate safety policies.',
          suggestion: 'Try rephrasing your prompt or use a different AI model.'
        }
      case 'image':
        return {
          title: 'Image Generation Blocked',
          description: 'DALL-E 3 detected content that may violate safety policies.',
          suggestion: 'Try a different prompt or switch to OpenArt/Midjourney.'
        }
      case 'video':
        return {
          title: 'Video Generation Blocked',
          description: 'The AI detected content that may violate safety policies.',
          suggestion: 'Try rephrasing your prompt or use a different video AI.'
        }
      case 'audio':
        return {
          title: 'Audio Generation Blocked',
          description: 'The AI detected content that may violate safety policies.',
          suggestion: 'Try rephrasing your prompt or use a different audio AI.'
        }
      default:
        return {
          title: 'Content Generation Blocked',
          description: 'The AI detected content that may violate safety policies.',
          suggestion: 'Try rephrasing your prompt or use a different AI model.'
        }
    }
  }

  const info = getContentTypeInfo()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <DialogTitle className="text-xl font-semibold text-white">
            {info.title}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {info.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* What Happened */}
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">What Happened?</span>
            </div>
            <p className="text-sm text-blue-700">
              AI safety filters detected potentially sensitive content in your script or prompt. 
              This is common with themes like violence, dark content, or specific keywords.
            </p>
          </div>

          {/* Suggestions */}
          <div className="rounded-lg bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-900">Quick Solutions</span>
            </div>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Try rephrasing your prompt</li>
              <li>• Use different AI models</li>
              <li>• Simplify the script context</li>
              <li>• Focus on visual/creative elements</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onTryDifferentPrompt}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Different Prompt
          </Button>
          <Button
            variant="outline"
            onClick={onTryDifferentAI}
            className="w-full sm:w-auto"
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            Try Different AI
          </Button>
          <Button
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Got It
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
