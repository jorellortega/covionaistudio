import { supabase } from './supabase'

export interface Storyboard {
  id: string
  user_id: string
  title: string
  description: string
  scene_number: number
  shot_type: string
  camera_angle: string
  movement: string
  dialogue?: string
  action?: string
  visual_notes?: string
  image_url?: string
  ai_generated: boolean
  project_id?: string
  created_at: string
  updated_at: string
}

export interface CreateStoryboardData {
  title: string
  description: string
  scene_number: number
  shot_type: string
  camera_angle: string
  movement: string
  dialogue?: string
  action?: string
  visual_notes?: string
  image_url?: string
  project_id?: string
}

export interface UpdateStoryboardData extends Partial<CreateStoryboardData> {
  ai_generated?: boolean
}

export class StoryboardsService {
  // Get all storyboards for the current user
  static async getStoryboards(): Promise<Storyboard[]> {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .select('*')
        .order('scene_number', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching storyboards:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getStoryboards:', error)
      throw error
    }
  }

  // Get storyboard by ID
  static async getStoryboard(id: string): Promise<Storyboard | null> {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching storyboard:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in getStoryboard:', error)
      throw error
    }
  }

  // Create a new storyboard
  static async createStoryboard(storyboardData: CreateStoryboardData): Promise<Storyboard> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const storyboardWithUserId = {
        user_id: user.id,
        title: storyboardData.title,
        description: storyboardData.description,
        scene_number: storyboardData.scene_number,
        shot_type: storyboardData.shot_type,
        camera_angle: storyboardData.camera_angle,
        movement: storyboardData.movement,
        dialogue: storyboardData.dialogue || null,
        action: storyboardData.action || null,
        visual_notes: storyboardData.visual_notes || null,
        image_url: storyboardData.image_url || null,
        project_id: storyboardData.project_id || null,
        ai_generated: false
      }

      const { data, error } = await supabase
        .from('storyboards')
        .insert([storyboardWithUserId])
        .select()
        .single()

      if (error) {
        console.error('Error creating storyboard:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in createStoryboard:', error)
      throw error
    }
  }

  // Update an existing storyboard
  static async updateStoryboard(id: string, storyboardData: UpdateStoryboardData): Promise<Storyboard> {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .update(storyboardData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating storyboard:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in updateStoryboard:', error)
      throw error
    }
  }

  // Delete a storyboard
  static async deleteStoryboard(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('storyboards')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting storyboard:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteStoryboard:', error)
      throw error
    }
  }

  // Get storyboards by project
  static async getStoryboardsByProject(projectId: string): Promise<Storyboard[]> {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .select('*')
        .eq('project_id', projectId)
        .order('scene_number', { ascending: true })

      if (error) {
        console.error('Error fetching storyboards by project:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getStoryboardsByProject:', error)
      throw error
    }
  }

  // Get storyboards by shot type
  static async getStoryboardsByShotType(shotType: string): Promise<Storyboard[]> {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .select('*')
        .eq('shot_type', shotType)
        .order('scene_number', { ascending: true })

      if (error) {
        console.error('Error fetching storyboards by shot type:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getStoryboardsByShotType:', error)
      throw error
    }
  }

  // Get AI-generated storyboards
  static async getAIGeneratedStoryboards(): Promise<Storyboard[]> {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .select('*')
        .eq('ai_generated', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching AI-generated storyboards:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getAIGeneratedStoryboards:', error)
      throw error
    }
  }

  // Search storyboards
  static async searchStoryboards(query: string): Promise<Storyboard[]> {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .select('*')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,dialogue.ilike.%${query}%,action.ilike.%${query}%`)
        .order('scene_number', { ascending: true })

      if (error) {
        console.error('Error searching storyboards:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in searchStoryboards:', error)
      throw error
    }
  }

  // Get storyboards count
  static async getStoryboardsCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('storyboards')
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.error('Error getting storyboards count:', error)
        throw error
      }

      return count || 0
    } catch (error) {
      console.error('Error in getStoryboardsCount:', error)
      throw error
    }
  }

  // Mark storyboard as AI generated
  static async markAsAIGenerated(id: string): Promise<Storyboard> {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .update({ ai_generated: true })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error marking storyboard as AI generated:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in markAsAIGenerated:', error)
      throw error
    }
  }

  // Update storyboard image
  static async updateStoryboardImage(id: string, imageUrl: string): Promise<Storyboard> {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .update({ image_url: imageUrl })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating storyboard image:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in updateStoryboardImage:', error)
      throw error
    }
  }
}
