import { getSupabaseClient } from './supabase'

export interface Project {
  id: string
  user_id: string
  name: string
  description?: string
  status: 'active' | 'archived' | 'completed'
  project_type: 'general' | 'movie' | 'video' | 'animation'
  genre?: string
  scenes?: number
  duration?: string
  thumbnail?: string
  movie_status?: 'Pre-Production' | 'Production' | 'Post-Production' | 'Distribution'
  created_at: string
  updated_at: string
}

export interface DashboardProject {
  id: string
  title: string
  status: string
  progress: number
  team: number
  lastUpdated: string
  project_type: string
  genre?: string
}

export class ProjectsService {
  // Get all projects for the current user
  static async getProjects(): Promise<Project[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching projects:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getProjects:', error)
      throw error
    }
  }

  // Get recent projects for dashboard (limited to 6)
  static async getRecentProjects(): Promise<DashboardProject[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(6)

      if (error) {
        console.error('Error fetching recent projects:', error)
        throw error
      }

      // Transform to dashboard format
      return (data || []).map(project => ({
        id: project.id,
        title: project.name,
        status: this.mapProjectStatus(project.status, project.movie_status),
        progress: this.calculateProgress(project.status, project.movie_status),
        team: this.getTeamSize(project.project_type), // Mock team size for now
        lastUpdated: this.formatLastUpdated(project.updated_at),
        project_type: project.project_type,
        genre: project.genre
      }))
    } catch (error) {
      console.error('Error in getRecentProjects:', error)
      throw error
    }
  }

  // Get project by ID
  static async getProject(id: string): Promise<Project | null> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching project:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in getProject:', error)
      throw error
    }
  }

  // Create a new project
  static async createProject(projectData: Partial<Project>): Promise<Project> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('projects')
        .insert([projectData])
        .select()
        .single()

      if (error) {
        console.error('Error creating project:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in createProject:', error)
      throw error
    }
  }

  // Update an existing project
  static async updateProject(id: string, projectData: Partial<Project>): Promise<Project> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('projects')
        .update(projectData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating project:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in updateProject:', error)
      throw error
    }
  }

  // Delete a project
  static async deleteProject(id: string): Promise<void> {
    try {
      const { error } = await getSupabaseClient()
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting project:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteProject:', error)
      throw error
    }
  }

  // Get projects by type
  static async getProjectsByType(type: string): Promise<Project[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('projects')
        .select('*')
        .eq('project_type', type)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching projects by type:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getProjectsByType:', error)
      throw error
    }
  }

  // Get projects by status
  static async getProjectsByStatus(status: string): Promise<Project[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('projects')
        .select('*')
        .eq('status', status)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching projects by status:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getProjectsByStatus:', error)
      throw error
    }
  }

  // Helper methods for dashboard formatting
  private static mapProjectStatus(status: string, movieStatus?: string): string {
    if (movieStatus) {
      return movieStatus
    }
    
    switch (status) {
      case 'active': return 'In Progress'
      case 'completed': return 'Completed'
      case 'archived': return 'Archived'
      default: return 'Planning'
    }
  }

  private static calculateProgress(status: string, movieStatus?: string): number {
    if (movieStatus) {
      switch (movieStatus) {
        case 'Pre-Production': return 25
        case 'Production': return 50
        case 'Post-Production': return 75
        case 'Distribution': return 100
        default: return 0
      }
    }
    
    switch (status) {
      case 'active': return 50
      case 'completed': return 100
      case 'archived': return 0
      default: return 25
    }
  }

  private static getTeamSize(projectType: string): number {
    // Mock team sizes based on project type
    switch (projectType) {
      case 'movie': return 6
      case 'video': return 3
      case 'animation': return 4
      default: return 2
    }
  }

  private static formatLastUpdated(updatedAt: string): string {
    const now = new Date()
    const updated = new Date(updatedAt)
    const diffInHours = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
    
    const diffInWeeks = Math.floor(diffInDays / 7)
    if (diffInWeeks < 4) return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`
    
    const diffInMonths = Math.floor(diffInDays / 30)
    return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`
  }
}
