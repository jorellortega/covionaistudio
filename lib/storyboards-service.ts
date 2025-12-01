import { getSupabaseClient } from './supabase'

export interface Storyboard {
  id: string
  user_id: string
  title: string
  description: string
  scene_number: number
  shot_number: number // Now supports decimals like 1.2, 2.5, etc.
  shot_type: string
  camera_angle: string
  movement: string
  dialogue?: string
  action?: string
  visual_notes?: string
  image_url?: string
  ai_generated: boolean
  project_id?: string
  scene_id?: string
  character_id?: string | null
  script_text_start?: number
  script_text_end?: number
  script_text_snippet?: string
  sequence_order?: number
  status: 'draft' | 'in-progress' | 'review' | 'approved' | 'rejected' | 'completed'
  created_at: string
  updated_at: string
}

export interface CreateStoryboardData {
  title: string
  description: string
  scene_number: number
  shot_number: number // Now supports decimals like 1.2, 2.5, etc.
  shot_type: string
  camera_angle: string
  movement: string
  dialogue?: string
  action?: string
  visual_notes?: string
  image_url?: string
  project_id?: string
  scene_id?: string
  character_id?: string | null
  script_text_start?: number
  script_text_end?: number
  script_text_snippet?: string
  sequence_order?: number
  status?: 'draft' | 'in-progress' | 'review' | 'approved' | 'rejected' | 'completed'
}

export interface UpdateStoryboardData extends Partial<CreateStoryboardData> {
  ai_generated?: boolean
}

export class StoryboardsService {
  // Get all storyboards for the current user
  static async getStoryboards(): Promise<Storyboard[]> {
    try {
      // Get the current user
      const { data: { user } } = await getSupabaseClient().auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await getSupabaseClient()
        .from('storyboards')
        .select('*')
        .eq('user_id', user.id)
        .order('scene_number', { ascending: true })
        .order('shot_number', { ascending: true })
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
      const { data, error } = await getSupabaseClient()
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
      // First try to get the current user
      let { data: { user }, error: userError } = await getSupabaseClient().auth.getUser()
      
      // If no user, try to refresh the session
      if (!user || userError) {
        console.log('🔐 No user found, attempting to refresh session...')
        const { data: { session }, error: sessionError } = await getSupabaseClient().auth.getSession()
        
        if (sessionError || !session?.user) {
          console.error('🔐 Session refresh failed:', sessionError)
          throw new Error('User not authenticated - please refresh the page and try again')
        }
        
        user = session.user
        console.log('🔐 Session refreshed successfully')
      }

      // Ensure shot_number has a default value if not provided
      const shotNumber = storyboardData.shot_number || 1

      // Clean up project_id - if it's an empty string, set to undefined
      const projectId = storyboardData.project_id === '' ? undefined : storyboardData.project_id

      const storyboardWithUserId = {
        user_id: user.id,
        title: storyboardData.title,
        description: storyboardData.description,
        scene_number: storyboardData.scene_number,
        shot_number: shotNumber,
        shot_type: storyboardData.shot_type,
        camera_angle: storyboardData.camera_angle,
        movement: storyboardData.movement,
        dialogue: storyboardData.dialogue || null,
        action: storyboardData.action || null,
        visual_notes: storyboardData.visual_notes || null,
        image_url: storyboardData.image_url || null,
        project_id: projectId,
        scene_id: storyboardData.scene_id,
        script_text_start: storyboardData.script_text_start || null,
        script_text_end: storyboardData.script_text_end || null,
        script_text_snippet: storyboardData.script_text_snippet || null,
        sequence_order: storyboardData.sequence_order || shotNumber, // Use shot_number as sequence_order if not provided
        status: storyboardData.status || 'draft',
        ai_generated: false
      }

      const { data, error } = await getSupabaseClient()
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
      // Clean up the data - ensure project_id is valid UUID or null
      const cleanData = { ...storyboardData }
      
      // Validate project_id - if it's an empty string, set to undefined
      if (cleanData.project_id === '') {
        cleanData.project_id = undefined
      }
      
      // Only include shot_number if it's explicitly provided and not undefined
      const updateData = { ...cleanData }
      if (cleanData.shot_number === undefined) {
        delete updateData.shot_number
      }

      console.log('Updating storyboard with data:', { id, updateData })

      const { data, error } = await getSupabaseClient()
        .from('storyboards')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating storyboard:', error)
        console.error('Update data that caused error:', updateData)
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
      const { error } = await getSupabaseClient()
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
      const { data, error } = await getSupabaseClient()
        .from('storyboards')
        .select('*')
        .eq('project_id', projectId)
        .order('scene_number', { ascending: true })
        .order('shot_number', { ascending: true })

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
      const { data, error } = await getSupabaseClient()
        .from('storyboards')
        .select('*')
        .eq('shot_type', shotType)
        .order('scene_number', { ascending: true })
        .order('shot_number', { ascending: true })

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
      const { data, error } = await getSupabaseClient()
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
      const { data, error } = await getSupabaseClient()
        .from('storyboards')
        .select('*')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,dialogue.ilike.%${query}%,action.ilike.%${query}%`)
        .order('scene_number', { ascending: true })
        .order('shot_number', { ascending: true })

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
      // Get the current user
      const { data: { user } } = await getSupabaseClient().auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const { count, error } = await getSupabaseClient()
        .from('storyboards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

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
      const { data, error } = await getSupabaseClient()
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
      const { data, error } = await getSupabaseClient()
        .from('storyboards')
        .update({ 
          image_url: imageUrl,
          ai_generated: true // Mark as AI-generated when image is added
        })
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

  // Get storyboards by scene
  static async getStoryboardsByScene(sceneId: string): Promise<Storyboard[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('storyboards')
        .select('*')
        .eq('scene_id', sceneId)
        .order('shot_number', { ascending: true })

      if (error) {
        console.error('Error fetching storyboards by scene:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getStoryboardsByScene:', error)
      throw error
    }
  }

  // Get storyboards by timeline (movie)
  static async getStoryboardsByTimeline(timelineId: string): Promise<Storyboard[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('storyboards')
        .select(`
          *,
          scenes!inner(
            timeline_id
          )
        `)
        .eq('scenes.timeline_id', timelineId)
        .order('scenes.start_time_seconds', { ascending: true })
        .order('shot_number', { ascending: true })

      if (error) {
        console.error('Error fetching storyboards by timeline:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getStoryboardsByTimeline:', error)
      throw error
    }
  }

  // Get storyboards for a specific scene with text ranges
  static async getStoryboardsForSceneWithTextRanges(sceneId: string): Promise<Storyboard[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('storyboards')
        .select('*')
        .eq('scene_id', sceneId)
        .not('script_text_start', 'is', null)
        .not('script_text_end', 'is', null)
        .order('sequence_order', { ascending: true })
        .order('shot_number', { ascending: true })

      if (error) {
        console.error('Error fetching storyboards with text ranges:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getStoryboardsForSceneWithTextRanges:', error)
      throw error
    }
  }

  // Get storyboards ordered by sequence_order for proper display
  static async getStoryboardsBySceneOrdered(sceneId: string): Promise<Storyboard[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('storyboards')
        .select('*')
        .eq('scene_id', sceneId)
        .order('sequence_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching storyboards by scene ordered:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getStoryboardsBySceneOrdered:', error)
      throw error
    }
  }

  // Insert a shot between two existing shots
  static async insertShotBetween(
    sceneId: string, 
    beforeShotId: string, 
    afterShotId: string, 
    newShotData: CreateStoryboardData
  ): Promise<Storyboard> {
    try {
      // Get the two shots to calculate the new sequence_order
      const { data: shots, error: fetchError } = await getSupabaseClient()
        .from('storyboards')
        .select('sequence_order')
        .in('id', [beforeShotId, afterShotId])
        .eq('scene_id', sceneId)
        .order('sequence_order', { ascending: true })

      if (fetchError || !shots || shots.length !== 2) {
        throw new Error('Could not fetch shots for sequence calculation')
      }

      const beforeSequence = shots[0].sequence_order || 0
      const afterSequence = shots[1].sequence_order || 0
      
      // Calculate new sequence_order between the two shots
      const newSequenceOrder = beforeSequence + (afterSequence - beforeSequence) / 2

      // Create the new shot with the calculated sequence_order
      const shotWithSequence = {
        ...newShotData,
        sequence_order: newSequenceOrder
      }

      const newShot = await this.createStoryboard(shotWithSequence)

      // Update shot_number to be sequential (1, 2, 3, 4...)
      await this.renumberShotsInScene(sceneId)

      return newShot
    } catch (error) {
      console.error('Error inserting shot between:', error)
      throw error
    }
  }

  // Renumber shots in a scene to maintain sequential shot numbers
  static async renumberShotsInScene(sceneId: string): Promise<void> {
    try {
      // Get all shots for the scene ordered by sequence_order
      const shots = await this.getStoryboardsBySceneOrdered(sceneId)
      
      // Update shot numbers to be sequential
      for (let i = 0; i < shots.length; i++) {
        const newShotNumber = i + 1
        if (shots[i].shot_number !== newShotNumber) {
          await getSupabaseClient()
            .from('storyboards')
            .update({ shot_number: newShotNumber })
            .eq('id', shots[i].id)
        }
      }
    } catch (error) {
      console.error('Error renumbering shots in scene:', error)
      throw error
    }
  }

  // Move a shot to a new position in the sequence
  static async moveShotToPosition(
    shotId: string, 
    newSequenceOrder: number
  ): Promise<void> {
    try {
      const { error } = await getSupabaseClient()
        .from('storyboards')
        .update({ sequence_order: newSequenceOrder })
        .eq('id', shotId)

      if (error) {
        console.error('Error moving shot to new position:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in moveShotToPosition:', error)
      throw error
    }
  }
}
