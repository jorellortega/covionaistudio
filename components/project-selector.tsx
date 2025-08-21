"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Film } from "lucide-react"

// Mock movies data - in a real app this would come from a context or API
const mockMovies = [
  { id: 1, title: "Neon Dreams", status: "In Progress", scenes: 24 },
  { id: 2, title: "The Last Symphony", status: "Pre-Production", scenes: 18 },
  { id: 3, title: "Quantum Heist", status: "Post-Production", scenes: 32 },
  { id: 4, title: "Digital Ghosts", status: "Completed", scenes: 28 },
]

interface ProjectSelectorProps {
  selectedProject?: string
  onProjectChange?: (projectId: string) => void
  showCreateNew?: boolean
  placeholder?: string
}

export function ProjectSelector({ selectedProject, onProjectChange, showCreateNew = false, placeholder = "Select a movie project" }: ProjectSelectorProps) {
  const [selected, setSelected] = useState(selectedProject || "")

  const handleChange = (value: string) => {
    setSelected(value)
    onProjectChange?.(value)
  }

  const selectedMovie = mockMovies.find((m) => m.id.toString() === selected)

  return (
    <div className="space-y-2">
      <Select value={selected} onValueChange={handleChange}>
        <SelectTrigger className="w-full bg-input border-border">
          <SelectValue placeholder={placeholder}>
            {selectedMovie && (
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                <span>{selectedMovie.title}</span>
                <Badge variant="outline" className="text-xs">
                  {selectedMovie.scenes} scenes
                </Badge>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="cinema-card border-border">
          {mockMovies.map((movie) => (
            <SelectItem key={movie.id} value={movie.id.toString()}>
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                <span>{movie.title}</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {movie.scenes} scenes
                </Badge>
              </div>
            </SelectItem>
          ))}
          {showCreateNew && (
            <SelectItem value="new">
              <div className="flex items-center gap-2 text-blue-500">
                <Film className="h-4 w-4" />
                <span>Create New Project</span>
              </div>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
