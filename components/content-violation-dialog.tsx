"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, Lightbulb, Wand2, Loader2 } from "lucide-react"
import { sanitizeImagePrompt } from "@/lib/sanitize-image-prompt-client"

interface ContentViolationDialogProps {
  isOpen: boolean
  onClose: () => void
  onTryDifferentPrompt?: () => void
  onTryDifferentAI?: () => void
  onRetryWithPrompt?: (prompt: string) => void | Promise<void>
  onPromptUpdated?: (prompt: string) => void
  contentType: "script" | "image" | "video" | "audio"
  originalPrompt: string
}

export function ContentViolationDialog({
  isOpen,
  onClose,
  onTryDifferentPrompt,
  onTryDifferentAI,
  onRetryWithPrompt,
  onPromptUpdated,
  contentType,
  originalPrompt,
}: ContentViolationDialogProps) {
  const [sanitizedPrompt, setSanitizedPrompt] = useState<string | null>(null)
  const [isSanitizing, setIsSanitizing] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [sanitizeError, setSanitizeError] = useState<string | null>(null)

  const resetState = () => {
    setSanitizedPrompt(null)
    setSanitizeError(null)
    setIsSanitizing(false)
    setIsRetrying(false)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const getContentTypeInfo = () => {
    switch (contentType) {
      case "script":
        return {
          title: "Content Blocked",
          description: "The AI safety filter blocked this script. Try rephrasing or use a different model.",
        }
      case "image":
        return {
          title: "Content Blocked",
          description:
            "The image AI blocked this prompt. Rephrase it to remove suggestive, violent, or explicit details — or let AI rewrite it for you.",
        }
      case "video":
        return {
          title: "Content Blocked",
          description: "The video AI blocked this prompt. Try rephrasing or use a different model.",
        }
      case "audio":
        return {
          title: "Content Blocked",
          description: "The audio AI blocked this prompt. Try rephrasing or use a different model.",
        }
      default:
        return {
          title: "Content Blocked",
          description: "The AI safety filter blocked this content. Try rephrasing your prompt.",
        }
    }
  }

  const info = getContentTypeInfo()

  const handleMakeAppropriate = async (andRetry: boolean) => {
    if (!originalPrompt.trim()) return

    setIsSanitizing(true)
    setSanitizeError(null)

    try {
      const rewritten = await sanitizeImagePrompt(originalPrompt)
      setSanitizedPrompt(rewritten)
      onPromptUpdated?.(rewritten)

      if (andRetry && onRetryWithPrompt) {
        setIsRetrying(true)
        handleClose()
        await onRetryWithPrompt(rewritten)
      }
    } catch (error) {
      setSanitizeError(
        error instanceof Error ? error.message : "Failed to rewrite prompt",
      )
    } finally {
      setIsSanitizing(false)
      setIsRetrying(false)
    }
  }

  const showImageActions = contentType === "image"

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent className="sm:max-w-lg bg-gray-900 border-gray-700">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <DialogTitle className="text-xl font-semibold text-white">
            {info.title}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {info.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-200">What happened?</span>
            </div>
            <p className="text-sm text-blue-100/80">
              AI safety filters flagged words or themes in your prompt — often intimate clothing,
              suggestive scenes, violence, or explicit content. A small wording change usually fixes it.
            </p>
          </div>

          {originalPrompt && (
            <div className="rounded-lg bg-gray-800/80 border border-gray-700 p-3">
              <p className="text-xs font-medium text-gray-400 mb-1">Your prompt</p>
              <p className="text-sm text-gray-200 line-clamp-4">{originalPrompt}</p>
            </div>
          )}

          {sanitizedPrompt && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <p className="text-xs font-medium text-emerald-300 mb-1">AI-appropriate version</p>
              <p className="text-sm text-emerald-50">{sanitizedPrompt}</p>
            </div>
          )}

          {sanitizeError && (
            <p className="text-sm text-red-400">{sanitizeError}</p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {showImageActions && onRetryWithPrompt && (
            <Button
              onClick={() => handleMakeAppropriate(true)}
              disabled={isSanitizing || isRetrying}
              className="w-full sm:w-auto"
            >
              {isSanitizing || isRetrying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Make AI Appropriate & Retry
            </Button>
          )}

          {showImageActions && !onRetryWithPrompt && (
            <Button
              onClick={() => handleMakeAppropriate(false)}
              disabled={isSanitizing}
              className="w-full sm:w-auto"
            >
              {isSanitizing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Make AI Appropriate
            </Button>
          )}

          {onTryDifferentPrompt && (
            <Button
              variant="outline"
              onClick={() => {
                handleClose()
                onTryDifferentPrompt()
              }}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Edit Prompt
            </Button>
          )}

          {onTryDifferentAI && (
            <Button
              variant="outline"
              onClick={() => {
                handleClose()
                onTryDifferentAI()
              }}
              className="w-full sm:w-auto"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Try Different AI
            </Button>
          )}

          <Button variant="secondary" onClick={handleClose} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
