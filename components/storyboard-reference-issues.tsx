"use client"

import { AlertTriangle, X } from "lucide-react"
import {
  humanizeReferenceLoadError,
  type StoryboardReferenceLoadFailure,
} from "@/lib/storyboard-image-generation"

interface StoryboardReferenceIssuesProps {
  issues: StoryboardReferenceLoadFailure[]
  onDismiss?: () => void
}

export function StoryboardReferenceIssues({
  issues,
  onDismiss,
}: StoryboardReferenceIssuesProps) {
  if (issues.length === 0) return null

  return (
    <div className="rounded-md border border-amber-500/35 bg-amber-500/10 p-3 text-xs space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              {issues.length} reference image{issues.length === 1 ? "" : "s"} couldn&apos;t load
            </p>
            <p className="text-amber-800/80 dark:text-amber-200/80 mt-0.5">
              Generation continued without {issues.length === 1 ? "it" : "them"}. Fix the links below for better likeness.
            </p>
          </div>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-100"
            aria-label="Dismiss reference image warnings"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <ul className="space-y-2">
        {issues.map((issue) => (
          <li
            key={`${issue.url}-${issue.label}`}
            className="rounded border border-amber-500/20 bg-background/50 p-2.5"
          >
            <p className="font-medium text-foreground">{issue.label}</p>
            <p className="text-muted-foreground mt-0.5">
              {humanizeReferenceLoadError(issue.error)}
              {issue.filename ? ` · ${issue.filename}` : ""}
            </p>
            <p className="text-amber-800 dark:text-amber-200 mt-1">{issue.fixHint}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
