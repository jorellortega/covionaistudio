"use client"

import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MapPin, Plus, UserCircle } from "lucide-react"

export type AssignmentPickerItem = {
  id: string
  name: string
  subtitle?: string
}

export function AssignmentBadgePicker({
  kind,
  items,
  selectedIds,
  onSelectedIdsChange,
  disabled = false,
}: {
  kind: "character" | "location"
  items: AssignmentPickerItem[]
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  disabled?: boolean
}) {
  if (items.length === 0) return null

  const itemById = new Map(items.map((item) => [item.id, item]))
  const selectedItems = selectedIds
    .map((id) => itemById.get(id))
    .filter((item): item is AssignmentPickerItem => Boolean(item))
  const availableItems = items.filter((item) => !selectedIds.includes(item.id))
  const emptyLabel = kind === "character" ? "No character" : "No location"
  const Icon = kind === "character" ? UserCircle : MapPin
  const assignedVariant = kind === "character" ? "secondary" : "outline"

  const setFirst = (id: string) => onSelectedIdsChange([id])
  const addId = (id: string) => onSelectedIdsChange([...selectedIds, id])
  const updateAt = (index: number, id: string | null) => {
    const next = [...selectedIds]
    if (id === null) {
      next.splice(index, 1)
    } else {
      next[index] = id
    }
    onSelectedIdsChange(next)
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {selectedItems.length === 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <button
              type="button"
              className="inline-flex border-0 bg-transparent p-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Badge
                variant="outline"
                className="text-xs hover:opacity-80 text-muted-foreground border-dashed"
              >
                <Icon className="h-3 w-3 mr-1" />
                {emptyLabel}
              </Badge>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {items.map((item) => (
              <DropdownMenuItem key={item.id} onClick={() => setFirst(item.id)}>
                {item.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        selectedItems.map((item, index) => (
          <DropdownMenu key={`${kind}-${item.id}-${index}`}>
            <DropdownMenuTrigger asChild disabled={disabled}>
              <button
                type="button"
                className="inline-flex border-0 bg-transparent p-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Badge variant={assignedVariant} className="text-xs hover:opacity-80">
                  <Icon className="h-3 w-3 mr-1" />
                  {item.name}
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => updateAt(index, null)}>
                <span className="text-muted-foreground">Remove</span>
              </DropdownMenuItem>
              {items.map((option) => (
                <DropdownMenuItem key={option.id} onClick={() => updateAt(index, option.id)}>
                  {option.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))
      )}

      {selectedItems.length > 0 && availableItems.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <button
              type="button"
              className="inline-flex border-0 bg-transparent p-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              title={kind === "character" ? "Add character" : "Add location"}
            >
              <Badge
                variant="outline"
                className="text-xs hover:opacity-80 text-muted-foreground border-dashed px-1.5"
              >
                <Plus className="h-3 w-3" />
              </Badge>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {availableItems.map((item) => (
              <DropdownMenuItem key={item.id} onClick={() => addId(item.id)}>
                {item.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
