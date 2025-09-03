import { getSupabaseClient } from './supabase'

export interface SavedPrompt {
  id: string
  user_id: string
  project_id?: string | null
  scene_id?: string | null
  title: string
  prompt: string
  type: 'character' | 'environment' | 'prop' | 'color' | 'lighting' | 'style' | 'prompt'
  style?: string
  model?: string
  tags: string[]
  use_count: number
  created_at: string
  updated_at: string
}

export interface CreateSavedPromptData {
  project_id?: string | null
  scene_id?: string | null
  title: string
  prompt: string
  type: 'character' | 'environment' | 'prop' | 'color' | 'lighting' | 'style' | 'prompt'
  style?: string
  model?: string
  tags?: string[]
}

export class SavedPromptsService {
  static async getSavedPrompts(userId: string, projectId?: string | null): Promise<SavedPrompt[]> {
    try {
      const supabase = getSupabaseClient()
      
      let query = supabase
        .from('saved_prompts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      // If projectId is specified, filter by it or show universal prompts (null)
      // If projectId is null, only show universal prompts (project_id IS NULL)
      if (projectId) {
        query = query.or(`project_id.eq.${projectId},project_id.is.null`)
        console.log('🔍 SavedPromptsService: Loading prompts for project', projectId, 'or universal')
      } else {
        // When no project is selected, only show universal prompts
        query = query.is('project_id', null)
        console.log('🔍 SavedPromptsService: Loading only universal prompts (no project)')
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching saved prompts:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getSavedPrompts:', error)
      throw error
    }
  }

  static async createSavedPrompt(userId: string, promptData: CreateSavedPromptData): Promise<SavedPrompt> {
    try {
      const supabase = getSupabaseClient()
      
      const { data, error } = await supabase
        .from('saved_prompts')
        .insert({
          user_id: userId,
          ...promptData,
          tags: promptData.tags || []
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating saved prompt:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in createSavedPrompt:', error)
      throw error
    }
  }

  static async updateSavedPrompt(promptId: string, updates: Partial<CreateSavedPromptData>): Promise<SavedPrompt> {
    try {
      const supabase = getSupabaseClient()
      
      const { data, error } = await supabase
        .from('saved_prompts')
        .update(updates)
        .eq('id', promptId)
        .select()
        .single()

      if (error) {
        console.error('Error updating saved prompt:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in updateSavedPrompt:', error)
      throw error
    }
  }

  static async deleteSavedPrompt(promptId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      
      const { error } = await supabase
        .from('saved_prompts')
        .delete()
        .eq('id', promptId)

      if (error) {
        console.error('Error deleting saved prompt:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteSavedPrompt:', error)
      throw error
    }
  }

  static async incrementUseCount(promptId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      
      // First get the current use_count
      const { data: currentData, error: fetchError } = await supabase
        .from('saved_prompts')
        .select('use_count')
        .eq('id', promptId)
        .single()

      if (fetchError) {
        console.error('Error fetching current use count:', fetchError)
        throw fetchError
      }

      // Then update with the incremented value
      const { error } = await supabase
        .from('saved_prompts')
        .update({ use_count: (currentData.use_count || 0) + 1 })
        .eq('id', promptId)

      if (error) {
        console.error('Error incrementing use count:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in incrementUseCount:', error)
      throw error
    }
  }
}
