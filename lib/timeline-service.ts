import { supabase } from './supabase'
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
    const { data: { session }, error } = await supabase.auth.getSession()
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
    const { data: { user } } = await supabase.auth.getUser()
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
      const { data: existingTimelines, error: listError } = await supabase
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
    
    const { data, error } = await supabase
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
      
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('timeline_id', timelineId)
        .eq('user_id', user.id)
        .order('start_time_seconds', { ascending: true })

      if (error) {
        console.error('Error fetching scenes:', error)
        throw error
      }

      console.log('Scenes fetched successfully:', data.length, 'scenes')
      
      // Fetch associated assets for all scenes to get latest image URLs
      const sceneIds = data.map(scene => scene.id)
      let assets: any[] = []
      
      if (sceneIds.length > 0) {
        try {
          const { data: assetsData, error: assetsError } = await supabase
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
          }
        } catch (assetsError) {
          console.warn('Failed to fetch assets for scenes:', assetsError)
        }
      }
      
      // Parse metadata for each scene and ensure it's properly typed
      return data.map(scene => {
        // Find the most recent image asset for this scene
        const sceneAssets = assets.filter(asset => asset.scene_id === scene.id)
        const latestImageAsset = sceneAssets[0] // Already ordered by created_at desc
        
        // Parse existing metadata
        const parsedMetadata = this.parseSceneMetadata(scene.metadata)
        
        // Update thumbnail URL if we have a more recent asset
        if (latestImageAsset?.content_url) {
          parsedMetadata.thumbnail = latestImageAsset.content_url
          console.log(`Updated scene "${scene.name}" thumbnail from asset:`, latestImageAsset.content_url)
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
    
    const { data, error } = await supabase
      .from('scenes')
      .insert({
        ...sceneData,
        user_id: user.id,
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
    const { data, error } = await supabase
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
    const { error } = await supabase
      .from('scenes')
      .delete()
      .eq('id', sceneId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting scene:', error)
      throw error
    }
  }

  static async refreshSceneThumbnail(sceneId: string): Promise<string | null> {
    try {
      const user = await this.ensureAuthenticated()
      console.log('Refreshing thumbnail for scene:', sceneId, 'user:', user.id)
      
      // Get the most recent image asset for this scene
      const { data: assets, error } = await supabase
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
      
      const { data, error } = await supabase
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
    
    const { data, error } = await supabase
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
      const { data: usersData, error: usersError } = await supabase
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
      const { data: projectsData, error: projectsError } = await supabase
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
      const { data: timelinesData, error: timelinesError } = await supabase
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
      const { data: scenesData, error: scenesError } = await supabase
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
      const { data: timelines, error: listError } = await supabase
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
        
        const { data: scenes, error: scenesError } = await supabase
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
          const { error: updateError } = await supabase
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
        const { error: deleteError } = await supabase
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
}
