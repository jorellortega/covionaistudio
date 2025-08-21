"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Film, Plus, Loader2 } from "lucide-react"
import { MovieService, Movie } from "@/lib/movie-service"
import { useRouter } from "next/navigation"

interface ProjectSelectorProps {
  selectedProject?: string
  onProjectChange?: (projectId: string) => void
  showCreateNew?: boolean
  placeholder?: string
}

export function ProjectSelector({ selectedProject, onProjectChange, showCreateNew = false, placeholder = "Select a movie project" }: ProjectSelectorProps) {
  const [selected, setSelected] = useState(selectedProject || "")
  const [projects, setProjects] = useState<Movie[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Load real projects from database
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoading(true)
        const userProjects = await MovieService.getMovies()
        setProjects(userProjects)
      } catch (error) {
        console.error('Error loading projects:', error)
        setProjects([])
      } finally {
        setIsLoading(false)
      }
    }

    loadProjects()
  }, [])

  const handleChange = (value: string) => {
    if (value === "new") {
      router.push("/dashboard") // Navigate to dashboard to create new project
      return
    }
    setSelected(value)
    onProjectChange?.(value)
  }

  const selectedMovie = projects.find((m) => m.id === selected)

  if (isLoading) {
    return (
      <div className="w-full bg-input border-border rounded-md px-3 py-2 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">Loading projects...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Select value={selected} onValueChange={handleChange}>
        <SelectTrigger className="w-full bg-input border-border">
          <SelectValue placeholder={placeholder}>
            {selectedMovie && (
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                <span>{selectedMovie.name}</span>
                <Badge variant="outline" className="text-xs">
                  {selectedMovie.status}
                </Badge>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="cinema-card border-border">
          {projects.length === 0 ? (
            <SelectItem value="no-projects" disabled>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Film className="h-4 w-4" />
                <span>No projects found</span>
              </div>
            </SelectItem>
          ) : (
            projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  <span>{project.name}</span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {project.status}
                  </Badge>
                </div>
              </SelectItem>
            ))
          )}
          {showCreateNew && (
            <SelectItem value="new">
              <div className="flex items-center gap-2 text-blue-500">
                <Plus className="h-4 w-4" />
                <span>Create New Project</span>
              </div>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
