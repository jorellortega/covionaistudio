"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ChevronDown, Link2, Loader2, Trash2 } from "lucide-react"

export interface LinkedAudioOption {
  id: string
  label: string
}

interface LinkedAudioPickerProps {
  options: LinkedAudioOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onDelete?: (optionId: string) => void
  deletingOptionId?: string | null
  compact?: boolean
}

export function LinkedAudioPicker({
  options,
  selectedIds,
  onChange,
  onDelete,
  deletingOptionId,
  compact = false,
}: LinkedAudioPickerProps) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((value) => value !== id))
      return
    }
    onChange([...selectedIds, id])
  }

  if (options.length === 0) return null

  return (
    <div className={cn("space-y-1", compact && "max-h-40 overflow-y-auto pr-1")}>
      {options.map((option) => (
        <div
          key={option.id}
          className="flex items-start gap-2 rounded-md px-1 py-0.5 hover:bg-muted/50 group"
        >
          <Checkbox
            checked={selectedIds.includes(option.id)}
            onCheckedChange={() => toggle(option.id)}
            className="mt-0.5"
          />
          <button
            type="button"
            className="flex-1 text-left text-xs leading-snug"
            onClick={() => toggle(option.id)}
          >
            {option.label}
          </button>
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100 hover:text-destructive"
              disabled={deletingOptionId === option.id}
              onClick={(event) => {
                event.stopPropagation()
                onDelete(option.id)
              }}
              title="Delete clip"
            >
              {deletingOptionId === option.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

interface LinkAudioPanelProps {
  options: LinkedAudioOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onDelete?: (optionId: string) => void
  deletingOptionId?: string | null
  compact?: boolean
}

export function LinkAudioPanel({
  options,
  selectedIds,
  onChange,
  onDelete,
  deletingOptionId,
  compact = false,
}: LinkAudioPanelProps) {
  if (options.length === 0) return null

  const linkedCount = selectedIds.filter((id) => options.some((option) => option.id === id)).length

  return (
    <Collapsible defaultOpen={false} className="rounded-lg border border-border/60 bg-muted/20">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors rounded-lg data-[state=open]:rounded-b-none">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("font-medium", compact ? "text-[11px]" : "text-sm")}>Link Audio</span>
          {linkedCount > 0 ? (
            <span className="text-[10px] text-muted-foreground">({linkedCount} linked)</span>
          ) : null}
          <span className="text-[10px] text-muted-foreground">· {options.length} clips</span>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-1 space-y-2 border-t border-border/40">
        <p className="text-xs text-muted-foreground">
          Select clips for this shot. Preview plays them together; export mixes into one file (video is not
          re-encoded).
        </p>
        <LinkedAudioPicker
          options={options}
          selectedIds={selectedIds}
          onChange={onChange}
          onDelete={onDelete}
          deletingOptionId={deletingOptionId}
          compact={compact}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}
