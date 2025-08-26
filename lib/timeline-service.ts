import { getSupabaseClient } from './supabase'
import { Database } from './supabase'

export type Timeline = Database['public']['Tables']['timelines']['Row']
export type Scene = Database['public']['Tables']['scenes']['Row']

export type CreateTimelineData = Omit<Database['public']['Tables']['timelines']['Insert'], 'id' | 'user_id' | 'project_id' | 'created_at' | 'updated_at'>

export type CreateSceneData = Omit<Database['public']['Tables']['scenes']['Insert'], 'id' | 'user_id' | 'created_at' | 'updated_at'>

export type SceneWithMetadata = Scene & {
  metadata: {
    sceneNumber?: string
    location?: string
    characters?: string[]
    shotType?: string
    mood?: string
    notes?: string
    status?: string
    thumbnail?: string
  }
  notes?: Array<{
    id: string
    type: string
    content: string
    created_at: string
    author: string
  }>
  media?: Array<{
    id: string
    type: string
    url: string
    name: string
    size: string
    created_at: string
  }>
}

export class TimelineService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      console.error('Session error:', error)
      throw new Error('Authentication required')
    }
    
    console.log('Session found:', { 
      user_id: session.user.id, 
      expires_at: session.expires_at,
      access_token_length: session.access_token?.length || 0
    })
    
    // Refresh session if needed
    const { data: { user } } = await getSupabaseClient().auth.getUser()
    if (!user) {
      console.error('User not found in session')
      throw new Error('User not authenticated')
    }
    
    console.log('User authenticated successfully:', user.id)
    return user
  }

  static async getTimelineForMovie(movieId: string): Promise<Timeline | null> {
    try {
      const user = await this.ensureAuthenticated()
      console.log('Fetching timeline for movie:', movieId, 'user:', user.id)
      
      // First try to find ANY existing timeline for this project
      const { data: existingTimelines, error: listError } = await getSupabaseClient()
        .from('timelines')
        .select('*')
        .eq('project_id', movieId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (listError) {
        console.error('Error listing timelines:', listError)
        throw listError
      }

      if (existingTimelines && existingTimelines.length > 0) {
        // Use the first (oldest) timeline to avoid duplicates
        const timeline = existingTimelines[0]
        console.log('Found existing timeline:', timeline.id, 'created:', timeline.created_at)
        
        // If there are multiple timelines, log a warning
        if (existingTimelines.length > 1) {
          console.warn(`Found ${existingTimelines.length} timelines for project ${movieId}. Using the oldest one.`)
        }
        
        return timeline
      }

      console.log('No existing timeline found for project:', movieId)
      return null
    } catch (error) {
      console.error('Error in getTimelineForMovie:', error)
      throw error
    }
  }

  static async createTimelineForMovie(movieId: string, timelineData: CreateTimelineData): Promise<Timeline> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
      .from('timelines')
      .insert({
        ...timelineData,
        project_id: movieId,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating timeline:', error)
      throw error
    }

    return data
  }

  static async getScenesForTimeline(timelineId: string): Promise<SceneWithMetadata[]> {
    try {
      const user = await this.ensureAuthenticated()
      console.log('Fetching scenes for timeline:', timelineId, 'user:', user.id)
      
      // Get all scenes first
      const { data, error } = await getSupabaseClient()
        .from('scenes')
        .select('*')
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching scenes:', error)
        throw error
      }

      // Sort scenes by scene number instead of order_index
      const sortedScenes = data.sort((a, b) => {
        const aNumber = this.parseSceneNumber(a.metadata?.sceneNumber || '')
        const bNumber = this.parseSceneNumber(b.metadata?.sceneNumber || '')
        return aNumber - bNumber
      })

      console.log('Scenes fetched successfully:', sortedScenes.length, 'scenes')
      console.log('Scene order details (sorted by scene number):')
      sortedScenes.forEach((scene, index) => {
        console.log(`  ${index + 1}. Scene "${scene.name}" - Scene Number: "${scene.metadata?.sceneNumber || 'None'}" - Order Index: ${scene.order_index}`)
      })
      
      // Fetch associated assets for all scenes to get latest image URLs
      const sceneIds = sortedScenes.map(scene => scene.id)
      let assets: any[] = []
      
      if (sceneIds.length > 0) {
        try {
          const { data: assetsData, error: assetsError } = await getSupabaseClient()
            .from('assets')
            .select('scene_id, content_url, content_type, title, created_at')
            .in('scene_id', sceneIds)
            .eq('content_type', 'image')
            .order('created_at', { ascending: false }) // Get most recent images first
          
          if (assetsError) {
            console.warn('Error fetching assets for scenes:', assetsError)
          } else {
            assets = assetsData || []
            console.log('Fetched assets for scenes:', assets.length, 'assets')
            
            // Debug: Show what assets we got and their URLs
            if (assets.length > 0) {
              console.log('🔍 Asset details:')
              assets.forEach((asset, index) => {
                const isBucket = asset.content_url?.includes('cinema_files')
                const isDalle = asset.content_url?.includes('oaidalleapiprodscus.blob.core.windows.net')
                console.log(`  ${index + 1}. Scene: ${asset.scene_id}, Title: ${asset.title}, Type: ${asset.content_type}, URL Type: ${isBucket ? 'BUCKET' : isDalle ? 'DALL-E' : 'OTHER'}`)
              })
            }
          }
        } catch (assetsError) {
          console.warn('Failed to fetch assets for scenes:', assetsError)
        }
      }
      
      // Parse metadata for each scene and ensure it's properly typed
      return sortedScenes.map(scene => {
        // Find the best image asset for this scene
        const sceneAssets = assets.filter(asset => asset.scene_id === scene.id)
        
        // ONLY use bucket URLs - ignore temporary DALL-E URLs completely
        const bucketAssets = sceneAssets.filter(asset => 
          asset.content_url && 
          asset.content_url.includes('cinema_files') && 
          !asset.content_url.includes('oaidalleapiprodscus.blob.core.windows.net')
        )
        
        // Log asset counts for debugging
        if (sceneAssets.length > 0) {
          console.log(`Scene "${scene.name}" has ${sceneAssets.length} total assets: ${bucketAssets.length} bucket, ${sceneAssets.length - bucketAssets.length} DALL-E (ignored)`)
        }
        
        // Use ONLY bucket assets - get the most recent one, no fallback to DALL-E
        let bestImageAsset = null
        if (bucketAssets.length > 0) {
          // Sort by created_at to get the most recent bucket image
          const sortedBucketAssets = bucketAssets.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          bestImageAsset = sortedBucketAssets[0]
          console.log(`🎯 Scene "${scene.name}" - Selected most recent bucket asset:`, {
            title: bestImageAsset.title,
            created_at: bestImageAsset.created_at,
            url: bestImageAsset.content_url?.substring(0, 100) + '...'
          })
        }
        
        // Parse existing metadata
        const parsedMetadata = this.parseSceneMetadata(scene.metadata)
        
        // Update thumbnail URL if we have a valid asset
        if (bestImageAsset?.content_url) {
          parsedMetadata.thumbnail = bestImageAsset.content_url
          console.log(`✅ Scene "${scene.name}" thumbnail set from bucket asset:`, bestImageAsset.content_url)
        } else {
          console.log(`❌ Scene "${scene.name}" has no bucket-saved images - no thumbnail available`)
        }
        
        return {
          ...scene,
          metadata: parsedMetadata
        }
      })
    } catch (error) {
      console.error('Error in getScenesForTimeline:', error)
      throw error
    }
  }

  static parseSceneMetadata(metadata: any): SceneWithMetadata['metadata'] {
    if (!metadata || typeof metadata !== 'object') {
      return {}
    }

    return {
      sceneNumber: metadata.sceneNumber || '',
      location: metadata.location || '',
      characters: Array.isArray(metadata.characters) ? metadata.characters : [],
      shotType: metadata.shotType || '',
      mood: metadata.mood || '',
      notes: metadata.notes || '',
      status: metadata.status || 'Planning',
      thumbnail: metadata.thumbnail || undefined
    }
  }

  static async createScene(sceneData: CreateSceneData): Promise<Scene> {
    const user = await this.ensureAuthenticated()
    
    // Get the appropriate order index based on scene number
    const sceneNumber = sceneData.metadata?.sceneNumber || ''
    const orderIndex = await this.getOrderIndexForSceneNumber(sceneData.timeline_id, sceneNumber)
    
    const { data, error } = await getSupabaseClient()
      .from('scenes')
      .insert({
        ...sceneData,
        user_id: user.id,
        order_index: orderIndex,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating scene:', error)
      throw error
    }

    return data
  }

  static async updateScene(sceneId: string, updates: Partial<CreateSceneData>): Promise<Scene> {
    const user = await this.ensureAuthenticated()
    
    // Check if scene number is being updated
    const isSceneNumberChanging = updates.metadata?.sceneNumber !== undefined
    
    if (isSceneNumberChanging) {
      // Get the current scene to compare scene numbers
      const { data: currentScene, error: fetchError } = await getSupabaseClient()
        .from('scenes')
        .select('timeline_id, metadata')
        .eq('id', sceneId)
        .eq('user_id', user.id)
        .single()

      if (fetchError) {
        console.error('Error fetching current scene:', fetchError)
        throw fetchError
      }

      const currentSceneNumber = currentScene.metadata?.sceneNumber || ''
      const newSceneNumber = updates.metadata?.sceneNumber || ''
      
      if (currentSceneNumber !== newSceneNumber) {
        // Scene number changed, we need to completely reorder all scenes
        // This is more reliable than trying to insert at specific positions
        await this.reorderScenesBySceneNumber(currentScene.timeline_id)
      }
    }
    
    const { data, error } = await getSupabaseClient()
      .from('scenes')
      .update(updates)
      .eq('id', sceneId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating scene:', error)
      throw error
    }

    return data
  }

  static async deleteScene(sceneId: string): Promise<void> {
    const user = await this.ensureAuthenticated()
    
    // Get the timeline_id for this scene before deleting
    const { data: scene, error: fetchError } = await getSupabaseClient()
      .from('scenes')
      .select('timeline_id')
      .eq('id', sceneId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      console.error('Error fetching scene timeline_id:', fetchError)
      throw fetchError
    }

    // Use the new reordering method to properly handle scene deletion
    await this.removeSceneAndReorder(scene.timeline_id, sceneId)
  }

  static async refreshSceneThumbnail(sceneId: string): Promise<string | null> {
    try {
      const user = await this.ensureAuthenticated()
      console.log('Refreshing thumbnail for scene:', sceneId, 'user:', user.id)
      
      // Get the most recent image asset for this scene
      const { data: assets, error } = await getSupabaseClient()
        .from('assets')
        .select('content_url, created_at')
        .eq('scene_id', sceneId)
        .eq('content_type', 'image')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No image assets found for scene:', sceneId)
          return null
        }
        console.error('Error fetching scene assets:', error)
        throw error
      }

      if (assets?.content_url) {
        console.log('Found latest image asset for scene:', sceneId, 'URL:', assets.content_url)
        return assets.content_url
      }

      return null
    } catch (error) {
      console.error('Error refreshing scene thumbnail:', error)
      throw error
    }
  }

  static async getSceneById(sceneId: string): Promise<SceneWithMetadata | null> {
    try {
      const user = await this.ensureAuthenticated()
      
      const { data, error } = await getSupabaseClient()
        .from('scenes')
        .select('*')
        .eq('id', sceneId)
        .eq('user_id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // No scene found
        }
        console.error('Error fetching scene:', error)
        throw error
      }

      // Parse metadata if it exists
      let metadata = {}
      try {
        if (data.metadata) {
          metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata
        }
      } catch (e) {
        console.warn('Could not parse scene metadata:', e)
        metadata = {}
      }

      const sceneWithMetadata: SceneWithMetadata = {
        ...data,
        metadata
      }

      return sceneWithMetadata
    } catch (error) {
      console.error('Error in getSceneById:', error)
      throw error
    }
  }

  static async getMovieById(movieId: string) {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
      .from('projects')
      .select('*')
      .eq('id', movieId)
      .eq('user_id', user.id)
      .eq('project_type', 'movie')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // No movie found
      }
      console.error('Error fetching movie:', error)
      throw error
    }

    return data
  }

  static async getMovieScenes(movieId: string): Promise<SceneWithMetadata[]> {
    try {
      // First get or create timeline for the movie
      let timeline = await this.getTimelineForMovie(movieId)
      
      if (!timeline) {
        console.log('No timeline found, creating new one for movie:', movieId)
        // Create a default timeline for the movie
        timeline = await this.createTimelineForMovie(movieId, {
          name: 'Main Timeline',
          description: 'Primary timeline for movie scenes',
          duration_seconds: 0,
          fps: 24,
          resolution_width: 1920,
          resolution_height: 1080,
        })
        console.log('Created new timeline:', timeline.id)
      } else {
        console.log('Found existing timeline:', timeline.id)
      }

      // Get scenes for the timeline
      const scenes = await this.getScenesForTimeline(timeline.id)
      console.log('Retrieved scenes:', scenes.length)
      return scenes
    } catch (error) {
      console.error('Error in getMovieScenes:', error)
      throw error
    }
  }

  // Debug method to help troubleshoot
  static async debugMovieScenes(movieId: string) {
    try {
      console.log('Debugging movie scenes for:', movieId)
      
      const movie = await this.getMovieById(movieId)
      console.log('Movie:', movie)
      
      const timeline = await this.getTimelineForMovie(movieId)
      console.log('Timeline:', timeline)
      
      if (timeline) {
        const scenes = await this.getScenesForTimeline(timeline.id)
        console.log('Scenes:', scenes)
      }
      
      return { movie, timeline, scenes: timeline ? await this.getScenesForTimeline(timeline.id) : [] }
    } catch (error) {
      console.error('Debug error:', error)
      throw error
    }
  }

  // Test method to verify authentication and database access
  static async testDatabaseAccess() {
    try {
      console.log('Testing database access...')
      
      // Test authentication
      const user = await this.ensureAuthenticated()
      console.log('User authenticated:', user.id)
      
      // Test basic table access
      const { data: usersData, error: usersError } = await getSupabaseClient()
        .from('users')
        .select('id, email, name')
        .eq('id', user.id)
        .single()
      
      if (usersError) {
        console.error('Users table access error:', usersError)
        return { success: false, error: 'Users table access failed', details: usersError }
      }
      console.log('Users table access successful:', usersData)
      
      // Test projects table access
      const { data: projectsData, error: projectsError } = await getSupabaseClient()
        .from('projects')
        .select('id, name, user_id')
        .eq('user_id', user.id)
        .limit(1)
      
      if (projectsError) {
        console.error('Projects table access error:', projectsError)
        return { success: false, error: 'Projects table access failed', details: projectsError }
      }
      console.log('Projects table access successful:', projectsData)
      
      // Test timelines table access
      const { data: timelinesData, error: timelinesError } = await getSupabaseClient()
        .from('timelines')
        .select('id, name, user_id')
        .eq('user_id', user.id)
        .limit(1)
      
      if (timelinesError) {
        console.error('Timelines table access error:', timelinesError)
        return { success: false, error: 'Timelines table access failed', details: timelinesError }
      }
      console.log('Timelines table access successful:', timelinesData)
      
      // Test scenes table access
      const { data: scenesData, error: scenesError } = await getSupabaseClient()
        .from('scenes')
        .select('id, name, user_id')
        .eq('user_id', user.id)
        .limit(1)
      
      if (scenesError) {
        console.error('Scenes table access error:', scenesError)
        return { success: false, error: 'Scenes table access failed', details: scenesError }
      }
      console.log('Scenes table access successful:', scenesData)
      
      return { success: true, message: 'All database access tests passed' }
    } catch (error) {
      console.error('Database access test failed:', error)
      return { success: false, error: 'Database access test failed', details: error }
    }
  }

  // Cleanup method to consolidate duplicate timelines
  static async cleanupDuplicateTimelines(movieId: string) {
    try {
      const user = await this.ensureAuthenticated()
      console.log('Cleaning up duplicate timelines for movie:', movieId)
      
      // Get all timelines for this project
      const { data: timelines, error: listError } = await getSupabaseClient()
        .from('timelines')
        .select('*')
        .eq('project_id', movieId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (listError) {
        console.error('Error listing timelines:', listError)
        throw listError
      }

      if (!timelines || timelines.length <= 1) {
        console.log('No duplicate timelines to clean up')
        return { success: true, message: 'No cleanup needed' }
      }

      console.log(`Found ${timelines.length} timelines, consolidating...`)
      
      // Keep the first (oldest) timeline
      const primaryTimeline = timelines[0]
      const duplicateTimelines = timelines.slice(1)
      
      console.log('Primary timeline:', primaryTimeline.id)
      console.log('Duplicate timelines:', duplicateTimelines.map(t => t.id))

      // Move all scenes from duplicate timelines to the primary timeline
      for (const duplicateTimeline of duplicateTimelines) {
        console.log(`Moving scenes from timeline ${duplicateTimeline.id} to ${primaryTimeline.id}`)
        
        const { data: scenes, error: scenesError } = await getSupabaseClient()
          .from('scenes')
          .select('*')
          .eq('timeline_id', duplicateTimeline.id)
          .eq('user_id', user.id)

        if (scenesError) {
          console.error('Error fetching scenes from duplicate timeline:', scenesError)
          continue
        }

        // Update each scene to point to the primary timeline
        for (const scene of scenes) {
          const { error: updateError } = await getSupabaseClient()
            .from('scenes')
            .update({ timeline_id: primaryTimeline.id })
            .eq('id', scene.id)
            .eq('user_id', user.id)

          if (updateError) {
            console.error('Error updating scene:', updateError)
          } else {
            console.log(`Moved scene ${scene.id} to primary timeline`)
          }
        }

        // Delete the duplicate timeline
        const { error: deleteError } = await getSupabaseClient()
          .from('timelines')
          .delete()
          .eq('id', duplicateTimeline.id)
          .eq('user_id', user.id)

        if (deleteError) {
          console.error('Error deleting duplicate timeline:', deleteError)
        } else {
          console.log(`Deleted duplicate timeline ${duplicateTimeline.id}`)
        }
      }

      console.log('Timeline cleanup completed successfully')
      return { 
        success: true, 
        message: `Consolidated ${duplicateTimelines.length} duplicate timelines into 1`,
        primaryTimelineId: primaryTimeline.id
      }
    } catch (error) {
      console.error('Error in cleanupDuplicateTimelines:', error)
      return { success: false, error: 'Timeline cleanup failed', details: error }
    }
  }

  // Scene ordering methods
  static async reorderScenes(timelineId: string, sceneOrder: { id: string; order_index: number }[]): Promise<boolean> {
    try {
      const user = await this.ensureAuthenticated()
      console.log('Reordering scenes for timeline:', timelineId, 'new order:', sceneOrder)
      
      // Update each scene with its new order_index
      for (const sceneUpdate of sceneOrder) {
        const { error } = await getSupabaseClient()
          .from('scenes')
          .update({ order_index: sceneUpdate.order_index })
          .eq('id', sceneUpdate.id)
          .eq('timeline_id', timelineId)
          .eq('user_id', user.id)

        if (error) {
          console.error('Error updating scene order:', error)
          throw error
        }
      }

      console.log('Scene reordering completed successfully')
      return true
    } catch (error) {
      console.error('Error in reorderScenes:', error)
      throw error
    }
  }

  static async insertSceneAtPosition(
    timelineId: string, 
    sceneData: CreateSceneData, 
    position: number
  ): Promise<Scene> {
    try {
      const user = await this.ensureAuthenticated()
      console.log('Inserting scene at position:', position, 'for timeline:', timelineId)
      
      // First, shift existing scenes to make room for the new position
      const { data: existingScenes, error: fetchError } = await getSupabaseClient()
        .from('scenes')
        .select('id, order_index')
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)
        .gte('order_index', position)
        .order('order_index', { ascending: true })

      if (fetchError) {
        console.error('Error fetching existing scenes:', fetchError)
        throw fetchError
      }

      // Shift scenes to make room
      for (const scene of existingScenes || []) {
        const { error: updateError } = await getSupabaseClient()
          .from('scenes')
          .update({ order_index: scene.order_index + 1 })
          .eq('id', scene.id)
          .eq('user_id', user.id)

        if (updateError) {
          console.error('Error shifting scene:', updateError)
          throw updateError
        }
      }

      // Insert the new scene at the specified position
      const { data: newScene, error: insertError } = await getSupabaseClient()
        .from('scenes')
        .insert({
          ...sceneData,
          timeline_id: timelineId,
          user_id: user.id,
          order_index: position
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error inserting new scene:', insertError)
        throw insertError
      }

      console.log('Scene inserted successfully at position:', position)
      return newScene
    } catch (error) {
      console.error('Error in insertSceneAtPosition:', error)
      throw error
    }
  }

  static async removeSceneAndReorder(timelineId: string, sceneId: string): Promise<boolean> {
    try {
      const user = await this.ensureAuthenticated()
      console.log('Removing scene and reordering:', sceneId, 'from timeline:', timelineId)
      
      // Get the scene's current position
      const { data: scene, error: fetchError } = await getSupabaseClient()
        .from('scenes')
        .select('order_index')
        .eq('id', sceneId)
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)
        .single()

      if (fetchError) {
        console.error('Error fetching scene position:', fetchError)
        throw fetchError
      }

      const removedPosition = scene.order_index

      // Delete the scene
      const { error: deleteError } = await getSupabaseClient()
        .from('scenes')
        .delete()
        .eq('id', sceneId)
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Error deleting scene:', deleteError)
        throw deleteError
      }

      // Shift remaining scenes to fill the gap
      const { data: remainingScenes, error: shiftError } = await getSupabaseClient()
        .from('scenes')
        .select('id, order_index')
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)
        .gt('order_index', removedPosition)
        .order('order_index', { ascending: true })

      if (shiftError) {
        console.error('Error fetching remaining scenes:', shiftError)
        throw shiftError
      }

      // Shift scenes down to fill the gap
      for (const remainingScene of remainingScenes || []) {
        const { error: updateError } = await getSupabaseClient()
          .from('scenes')
          .update({ order_index: remainingScene.order_index - 1 })
          .eq('id', remainingScene.id)
          .eq('user_id', user.id)

        if (updateError) {
          console.error('Error shifting remaining scene:', updateError)
          throw updateError
        }
      }

      console.log('Scene removal and reordering completed successfully')
      return true
    } catch (error) {
      console.error('Error in removeSceneAndReorder:', error)
      throw error
    }
  }

  static async getNextSceneOrderIndex(timelineId: string): Promise<number> {
    try {
      const user = await this.ensureAuthenticated()
      
      const { data, error } = await getSupabaseClient()
        .from('scenes')
        .select('order_index')
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)
        .order('order_index', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error getting next scene order index:', error)
        throw error
      }

      // Return the next available order index
      return (data?.[0]?.order_index || 0) + 1
    } catch (error) {
      console.error('Error in getNextSceneOrderIndex:', error)
      throw error
    }
  }

  /**
   * Parse scene number and convert to a sortable order value
   * Examples: "1A" -> 1.1, "2B" -> 2.2, "10" -> 10.0, "3C" -> 3.3
   */
  static parseSceneNumber(sceneNumber: string): number {
    if (!sceneNumber || !sceneNumber.trim()) return 0
    
    const trimmed = sceneNumber.trim()
    
    // Extract the numeric part
    const numericMatch = trimmed.match(/^(\d+)/)
    if (!numericMatch) return 0
    
    const numericPart = parseInt(numericMatch[1], 10)
    
    // Extract the letter part (if any)
    const letterMatch = trimmed.match(/^(\d+)([A-Za-z])/)
    if (letterMatch) {
      const letter = letterMatch[2].toUpperCase()
      const letterValue = letter.charCodeAt(0) - 64 // A=1, B=2, C=3, etc.
      return numericPart + (letterValue / 10)
    }
    
    // If no letter, just return the number
    return numericPart
  }

  /**
   * Get the appropriate order_index for a scene based on its scene number
   * This will insert the scene at the correct position and shift others as needed
   */
  static async getOrderIndexForSceneNumber(timelineId: string, sceneNumber: string): Promise<number> {
    try {
      const user = await this.ensureAuthenticated()
      
      if (!sceneNumber || !sceneNumber.trim()) {
        // If no scene number, just append to the end
        return await this.getNextSceneOrderIndex(timelineId)
      }
      
      const targetOrder = this.parseSceneNumber(sceneNumber)
      
      // Get all existing scenes ordered by their current order_index
      const { data: existingScenes, error } = await getSupabaseClient()
        .from('scenes')
        .select('id, order_index, metadata')
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })

      if (error) {
        console.error('Error fetching existing scenes for ordering:', error)
        throw error
      }

      if (!existingScenes || existingScenes.length === 0) {
        // First scene, start at 1
        return 1
      }

      // Find the correct position for this scene number
      let insertPosition = 1
      
      for (let i = 0; i < existingScenes.length; i++) {
        const existingScene = existingScenes[i]
        const existingOrder = this.parseSceneNumber(existingScene.metadata?.sceneNumber || '')
        
        if (targetOrder < existingOrder) {
          // Insert before this scene
          insertPosition = existingScene.order_index
          break
        } else if (targetOrder === existingOrder) {
          // Same scene number, insert after this one
          insertPosition = existingScene.order_index + 1
        } else {
          // Continue to next scene
          insertPosition = existingScene.order_index + 1
        }
      }

      // If we're inserting in the middle, we need to shift existing scenes
      // But only if this is a new scene, not an update
      if (insertPosition <= existingScenes.length) {
        // Check if this scene already exists to avoid unnecessary shifting
        const sceneExists = existingScenes.some(scene => 
          this.parseSceneNumber(scene.metadata?.sceneNumber || '') === targetOrder
        )
        
        if (!sceneExists) {
          await this.shiftScenesForInsert(timelineId, insertPosition)
        }
      }

      return insertPosition
    } catch (error) {
      console.error('Error getting order index for scene number:', error)
      throw error
    }
  }

  /**
   * Shift scenes to make room for inserting a new scene at a specific position
   */
  static async shiftScenesForInsert(timelineId: string, insertPosition: number): Promise<void> {
    try {
      const user = await this.ensureAuthenticated()
      
      // Get scenes that need to be shifted (those at or after insertPosition)
      const { data: scenesToShift, error } = await getSupabaseClient()
        .from('scenes')
        .select('id, order_index')
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)
        .gte('order_index', insertPosition)
        .order('order_index', { ascending: false }) // Start from highest to avoid conflicts

      if (error) {
        console.error('Error fetching scenes to shift:', error)
        throw error
      }

      if (!scenesToShift || scenesToShift.length === 0) return

      // Shift each scene up by 1
      for (const scene of scenesToShift) {
        const { error: updateError } = await getSupabaseClient()
          .from('scenes')
          .update({ order_index: scene.order_index + 1 })
          .eq('id', scene.id)
          .eq('user_id', user.id)

        if (updateError) {
          console.error('Error shifting scene:', updateError)
          throw updateError
        }
      }
    } catch (error) {
      console.error('Error shifting scenes for insert:', error)
      throw error
    }
  }

  /**
   * Reorder scenes based on their scene numbers
   * This ensures the timeline displays scenes in the correct order
   */
  static async reorderScenesBySceneNumber(timelineId: string): Promise<boolean> {
    try {
      const user = await this.ensureAuthenticated()
      
      // Get all scenes with their metadata
      const { data: scenes, error } = await getSupabaseClient()
        .from('scenes')
        .select('id, metadata')
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching scenes for reordering:', error)
        throw error
      }

      if (!scenes || scenes.length === 0) return true

      // Sort scenes by their parsed scene number
      const sortedScenes = scenes
        .map(scene => ({
          id: scene.id,
          sceneNumber: scene.metadata?.sceneNumber || '',
          parsedOrder: this.parseSceneNumber(scene.metadata?.sceneNumber || '')
        }))
        .sort((a, b) => a.parsedOrder - b.parsedOrder)

      console.log('Scenes to be reordered:', sortedScenes)

      // Use a temporary order_index to avoid constraint conflicts
      // First, set all scenes to temporary high numbers
      for (let i = 0; i < sortedScenes.length; i++) {
        const { error: updateError } = await getSupabaseClient()
          .from('scenes')
          .update({ order_index: 10000 + i }) // Use high temporary numbers
          .eq('id', sortedScenes[i].id)
          .eq('user_id', user.id)

        if (updateError) {
          console.error('Error setting temporary order:', updateError)
          throw updateError
        }
      }

      // Now set the final order_index values
      for (let i = 0; i < sortedScenes.length; i++) {
        const { error: updateError } = await getSupabaseClient()
          .from('scenes')
          .update({ order_index: i + 1 })
          .eq('id', sortedScenes[i].id)
          .eq('user_id', user.id)

        if (updateError) {
          console.error('Error updating scene order:', updateError)
          throw updateError
        }
      }

      console.log('Scenes reordered by scene number successfully. New order:')
      sortedScenes.forEach((scene, index) => {
        console.log(`  ${index + 1}. Scene ${scene.sceneNumber} (parsed: ${scene.parsedOrder})`)
      })
      
      return true
    } catch (error) {
      console.error('Error reordering scenes by scene number:', error)
      throw error
    }
  }

  /**
   * Get scenes with their current order information for debugging
   */
  static async getScenesWithOrderInfo(timelineId: string): Promise<Array<{
    id: string
    name: string
    sceneNumber: string
    order_index: number
    parsedOrder: number
  }>> {
    try {
      const user = await this.ensureAuthenticated()
      
      const { data: scenes, error } = await getSupabaseClient()
        .from('scenes')
        .select('id, name, metadata, order_index')
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })

      if (error) {
        console.error('Error fetching scenes with order info:', error)
        throw error
      }

      if (!scenes || scenes.length === 0) return []

      return scenes.map(scene => ({
        id: scene.id,
        name: scene.name,
        sceneNumber: scene.metadata?.sceneNumber || '',
        order_index: scene.order_index,
        parsedOrder: this.parseSceneNumber(scene.metadata?.sceneNumber || '')
      }))
    } catch (error) {
      console.error('Error getting scenes with order info:', error)
      throw error
    }
  }

  /**
   * Validate scene ordering and return any issues found
   */
  static async validateSceneOrdering(timelineId: string): Promise<{
    isValid: boolean
    issues: string[]
    suggestions: string[]
  }> {
    try {
      const scenes = await this.getScenesWithOrderInfo(timelineId)
      
      if (scenes.length === 0) {
        return { isValid: true, issues: [], suggestions: [] }
      }

      const issues: string[] = []
      const suggestions: string[] = []

      // Check for duplicate scene numbers
      const sceneNumberCounts = new Map<string, number>()
      scenes.forEach(scene => {
        if (scene.sceneNumber) {
          sceneNumberCounts.set(scene.sceneNumber, (sceneNumberCounts.get(scene.sceneNumber) || 0) + 1)
        }
      })

      sceneNumberCounts.forEach((count, sceneNumber) => {
        if (count > 1) {
          issues.push(`Duplicate scene number: "${sceneNumber}" appears ${count} times`)
          suggestions.push(`Ensure each scene has a unique scene number`)
        }
      })

      // Check for missing scene numbers
      const scenesWithoutNumbers = scenes.filter(scene => !scene.sceneNumber)
      if (scenesWithoutNumbers.length > 0) {
        issues.push(`${scenesWithoutNumbers.length} scenes are missing scene numbers`)
        suggestions.push(`Add scene numbers to all scenes for proper ordering`)
      }

      // Check if order_index matches parsed scene number order
      const expectedOrder = [...scenes].sort((a, b) => a.parsedOrder - b.parsedOrder)
      const orderMismatch = expectedOrder.some((scene, index) => scene.order_index !== index + 1)
      
      if (orderMismatch) {
        issues.push('Scene order_index does not match scene number order')
        suggestions.push('Use the "Reorder Scenes" button to fix ordering')
      }

      return {
        isValid: issues.length === 0,
        issues,
        suggestions
      }
    } catch (error) {
      console.error('Error validating scene ordering:', error)
      return {
        isValid: false,
        issues: ['Error validating scene ordering'],
        suggestions: ['Check console for details']
      }
    }
  }

  /**
   * Simple method to refresh timeline display by scene number
   * This doesn't update the database, just returns scenes in the correct order
   */
  static async getTimelineDisplayOrder(timelineId: string): Promise<SceneWithMetadata[]> {
    try {
      const user = await this.ensureAuthenticated()
      
      // Get all scenes without ordering
      const { data: scenes, error } = await getSupabaseClient()
        .from('scenes')
        .select('*')
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching scenes for display:', error)
        throw error
      }

      if (!scenes || scenes.length === 0) return []

      // Sort by scene number for display only
      const displayOrder = scenes.sort((a, b) => {
        const aNumber = this.parseSceneNumber(a.metadata?.sceneNumber || '')
        const bNumber = this.parseSceneNumber(b.metadata?.sceneNumber || '')
        return aNumber - bNumber
      })

      console.log('Timeline display order (by scene number):')
      displayOrder.forEach((scene, index) => {
        console.log(`  ${index + 1}. Scene "${scene.name}" - Scene Number: "${scene.metadata?.sceneNumber || 'None'}"`)
      })

      return displayOrder
    } catch (error) {
      console.error('Error getting timeline display order:', error)
      throw error
    }
  }
}
