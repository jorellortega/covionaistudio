import { getSupabaseClient } from './supabase'
import { sortShotListRows } from './shot-list-order'

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
  location_id?: string | null
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
  location_id?: string | null
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
        character_id: storyboardData.character_id || null,
        location_id: storyboardData.location_id || null,
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
      console.log('🎬 StoryboardsService.getStoryboardsByScene - sceneId:', sceneId)
      
      // Try querying by scene_id first (proper way)
      const { data: dataBySceneId, error: errorBySceneId } = await getSupabaseClient()
        .from('storyboards')
        .select('*')
        .eq('scene_id', sceneId)
        .order('shot_number', { ascending: true })

      console.log('🎬 Storyboards by scene_id:', dataBySceneId?.length || 0, dataBySceneId)

      if (dataBySceneId && dataBySceneId.length > 0) {
        return dataBySceneId
      }

      // Only try fallback if no storyboards found by scene_id
      // Try to get the scene to find its timeline_id, order_index, and metadata
      let scene = null
      let projectId: string | null = null
      try {
        const { data: sceneData, error: sceneError } = await getSupabaseClient()
          .from('scenes')
          .select('id, order_index, metadata, timeline_id')
          .eq('id', sceneId)
          .single()

        if (!sceneError && sceneData) {
          scene = sceneData
          console.log('🎬 Scene data:', scene)
          
          // Get project_id from timeline (scenes don't have project_id directly)
          if (scene.timeline_id) {
            const { data: timeline, error: timelineError } = await getSupabaseClient()
              .from('timelines')
              .select('project_id')
              .eq('id', scene.timeline_id)
              .single()
            
            if (timelineError) {
              console.log('🎬 Could not fetch timeline (non-critical):', timelineError.message)
            } else if (timeline) {
              projectId = timeline.project_id
              console.log('🎬 Project ID from timeline:', projectId)
            }
          }
        } else if (sceneError) {
          console.log('🎬 Could not fetch scene (non-critical):', sceneError.message)
        }
      } catch (err) {
        console.log('🎬 Error fetching scene (non-critical):', err)
      }

      // If no storyboards found by scene_id, try fallback methods
      if (scene && projectId) {

        console.log('🎬 Trying fallback: project_id', { project_id: projectId })

        if (projectId) {
          // Get all storyboards for the project
          const { data: dataByProject, error: errorByProject } = await getSupabaseClient()
            .from('storyboards')
            .select('*')
            .eq('project_id', projectId)
            .order('scene_number', { ascending: true })
            .order('shot_number', { ascending: true })

          console.log('🎬 Storyboards by project_id:', dataByProject?.length || 0, dataByProject)

          if (dataByProject && dataByProject.length > 0) {
            // Try to match by scene_number from metadata or order_index
            const sceneNumber = (scene.metadata as any)?.sceneNumber || 
                               (scene.metadata as any)?.scene_number ||
                               scene.order_index?.toString()
            
            console.log('🎬 Trying to match by scene_number:', sceneNumber, 'order_index:', scene.order_index)

            if (sceneNumber) {
              // Try to match storyboards by scene_number
              const sceneNum = typeof sceneNumber === 'string' ? parseInt(sceneNumber) : sceneNumber
              const filtered = dataByProject.filter(s => {
                const storyboardSceneNum = typeof s.scene_number === 'string' 
                  ? parseInt(s.scene_number) 
                  : s.scene_number
                return storyboardSceneNum === sceneNum || 
                       storyboardSceneNum === scene.order_index ||
                       s.scene_number === sceneNumber
              })
              console.log('🎬 Filtered by scene_number:', filtered.length, filtered)
              
              if (filtered.length > 0) {
                return filtered
              }
            }
            
            // If no match by scene_number, return all storyboards for the project
            // (user can filter manually)
            console.log('🎬 Returning all storyboards for project (no scene_number match)')
            return dataByProject
          }
        }
      }

      if (errorBySceneId) {
        console.error('Error fetching storyboards by scene:', errorBySceneId)
        throw errorBySceneId
      }

      console.log('🎬 No storyboards found for scene')
      return []
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

      return sortShotListRows(data || [])
    } catch (error) {
      console.error('Error in getStoryboardsBySceneOrdered:', error)
      throw error
    }
  }

  /** After sync — align sequence_order with shot_number so grid order matches Shot # badges */
  static async alignSequenceOrderToShotNumbers(
    sceneId: string,
    storyboards?: Storyboard[]
  ): Promise<number> {
    let rows = storyboards
    if (!rows) {
      const { data, error } = await getSupabaseClient()
        .from('storyboards')
        .select('*')
        .eq('scene_id', sceneId)
      if (error) throw error
      rows = data || []
    }

    let fixed = 0
    for (const sb of rows ?? []) {
      const target = Number(sb.shot_number)
      const current = Number(sb.sequence_order ?? sb.shot_number)
      if (current === target) continue
      const { error } = await getSupabaseClient()
        .from('storyboards')
        .update({ sequence_order: target })
        .eq('id', sb.id)
      if (error) {
        console.error('Error aligning storyboard sequence_order:', error)
        throw error
      }
      fixed++
    }
    return fixed
  }

  /** Apply new 1..n order without violating unique scene_id + shot_number / sequence_order */
  private static async applyStoryboardRenumbering(reordered: Storyboard[]): Promise<void> {
    if (reordered.length === 0) return

    for (let i = 0; i < reordered.length; i++) {
      const temp = -(i + 1)
      const { error } = await getSupabaseClient()
        .from('storyboards')
        .update({ shot_number: temp, sequence_order: temp })
        .eq('id', reordered[i].id)
      if (error) {
        console.error('Error staging storyboard renumber (pass 1):', error)
        throw error
      }
    }

    for (let i = 0; i < reordered.length; i++) {
      const newNum = i + 1
      const { error } = await getSupabaseClient()
        .from('storyboards')
        .update({ shot_number: newNum, sequence_order: newNum })
        .eq('id', reordered[i].id)
      if (error) {
        console.error('Error applying storyboard renumber (pass 2):', error)
        throw error
      }
    }
  }

  /** Move one storyboard to a new position; others shift (11 → 2 pushes 2–10 down to 3–11). */
  static async moveStoryboardToShotNumber(
    sceneId: string,
    storyboardId: string,
    targetShotNumber: number
  ): Promise<void> {
    const storyboards = sortShotListRows(await this.getStoryboardsBySceneOrdered(sceneId))
    const fromIdx = storyboards.findIndex((sb) => sb.id === storyboardId)
    if (fromIdx === -1) {
      throw new Error('Storyboard not found in this scene')
    }

    const target = Math.max(1, Math.min(Math.round(targetShotNumber), storyboards.length))
    const toIdx = target - 1
    if (fromIdx === toIdx) return

    const reordered = [...storyboards]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    await this.applyStoryboardRenumbering(reordered)
  }

  // Insert a shot between two existing shots
  static async insertShotBetween(
    sceneId: string,
    beforeShotId: string,
    afterShotId: string,
    newShotData: CreateStoryboardData
  ): Promise<Storyboard> {
    try {
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
      const newSequenceOrder = beforeSequence + (afterSequence - beforeSequence) / 2

      const shotWithSequence = {
        ...newShotData,
        sequence_order: newSequenceOrder,
      }

      const newShot = await this.createStoryboard(shotWithSequence)
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
      const shots = await this.getStoryboardsBySceneOrdered(sceneId)
      await this.applyStoryboardRenumbering(shots)
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
