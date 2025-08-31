import { getSupabaseClient } from './supabase'

export interface Lyrics {
  id: string
  user_id: string
  title: string
  content: string
  movie_id?: string | null
  scene_id?: string | null
  version: number
  version_name: string
  is_latest_version: boolean
  parent_lyrics_id?: string | null
  genre?: string
  mood?: string
  language: string
  tags: string[]
  description?: string
  created_at: string
  updated_at: string
}

export interface CreateLyricsData {
  title: string
  content: string
  movie_id?: string | null
  scene_id?: string | null
  version_name?: string
  genre?: string
  mood?: string
  language?: string
  tags?: string[]
  description?: string
}

export interface UpdateLyricsData {
  title?: string
  content?: string
  genre?: string
  mood?: string
  language?: string
  tags?: string[]
  description?: string
}

export class LyricsService {
  /**
   * Create new lyrics
   */
  static async createLyrics(data: CreateLyricsData): Promise<Lyrics> {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }

    // Check if there's an existing version to determine version number
    let version = 1
    let parentLyricsId: string | undefined = undefined

    if (data.movie_id || data.scene_id) {
      // If associated with movie/scene, check for existing versions
      const existingLyrics = await this.getLyricsByMovieOrScene(
        session.user.id, 
        data.movie_id, 
        data.scene_id
      )
      
      if (existingLyrics.length > 0) {
        const latestVersion = existingLyrics.find(l => l.is_latest_version)
        if (latestVersion) {
          version = latestVersion.version + 1
          parentLyricsId = latestVersion.id
          
          // Mark previous version as not latest
          await getSupabaseClient()
            .from('lyrics')
            .update({ is_latest_version: false })
            .eq('id', latestVersion.id)
        }
      }
    }

    const insertData = {
      user_id: session.user.id,
      title: data.title,
      content: data.content,
      movie_id: data.movie_id || null,
      scene_id: data.scene_id || null,
      version: version,
      version_name: data.version_name || `Version ${version}`,
      is_latest_version: true,
      parent_lyrics_id: parentLyricsId,
      genre: data.genre || null,
      mood: data.mood || null,
      language: data.language || 'English',
      tags: data.tags || [],
      description: data.description || null
    }

    const { data: newLyrics, error: insertError } = await getSupabaseClient()
      .from('lyrics')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create lyrics: ${insertError.message}`)
    }

    return newLyrics as Lyrics
  }

  /**
   * Get all lyrics for a user
   */
  static async getUserLyrics(userId: string): Promise<Lyrics[]> {
    const { data, error } = await getSupabaseClient()
      .from('lyrics')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch lyrics: ${error.message}`)
    }

    return data as Lyrics[]
  }

  /**
   * Get lyrics by ID
   */
  static async getLyricsById(lyricsId: string): Promise<Lyrics | null> {
    const { data, error } = await getSupabaseClient()
      .from('lyrics')
      .select('*')
      .eq('id', lyricsId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Lyrics not found
      }
      throw new Error(`Failed to fetch lyrics: ${error.message}`)
    }

    return data as Lyrics
  }

  /**
   * Get lyrics by movie or scene
   */
  static async getLyricsByMovieOrScene(
    userId: string, 
    movieId?: string | null, 
    sceneId?: string | null
  ): Promise<Lyrics[]> {
    let query = getSupabaseClient()
      .from('lyrics')
      .select('*')
      .eq('user_id', userId)

    if (movieId) {
      query = query.eq('movie_id', movieId)
    }
    
    if (sceneId) {
      query = query.eq('scene_id', sceneId)
    }

    const { data, error } = await query.order('version', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch lyrics: ${error.message}`)
    }

    return data as Lyrics[]
  }

  /**
   * Update lyrics
   */
  static async updateLyrics(
    lyricsId: string, 
    userId: string, 
    updates: UpdateLyricsData
  ): Promise<Lyrics> {
    const { data, error } = await getSupabaseClient()
      .from('lyrics')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', lyricsId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update lyrics: ${error.message}`)
    }

    return data as Lyrics
  }

  /**
   * Create new version of lyrics
   */
  static async createNewVersion(
    lyricsId: string, 
    userId: string, 
    updates: UpdateLyricsData
  ): Promise<Lyrics> {
    // Get the current lyrics
    const currentLyrics = await this.getLyricsById(lyricsId)
    if (!currentLyrics || currentLyrics.user_id !== userId) {
      throw new Error('Lyrics not found or access denied')
    }

    // Mark current version as not latest
    await getSupabaseClient()
      .from('lyrics')
      .update({ is_latest_version: false })
      .eq('id', lyricsId)

    // Create new version
    const newVersionData: CreateLyricsData = {
      title: updates.title || currentLyrics.title,
      content: updates.content || currentLyrics.content,
      movie_id: currentLyrics.movie_id,
      scene_id: currentLyrics.scene_id,
      version_name: updates.version_name || `Version ${currentLyrics.version + 1}`,
      genre: updates.genre || currentLyrics.genre,
      mood: updates.mood || currentLyrics.mood,
      language: updates.language || currentLyrics.language,
      tags: updates.tags || currentLyrics.tags,
      description: updates.description || currentLyrics.description
    }

    return await this.createLyrics(newVersionData)
  }

  /**
   * Delete lyrics
   */
  static async deleteLyrics(lyricsId: string, userId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('lyrics')
      .delete()
      .eq('id', lyricsId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to delete lyrics: ${error.message}`)
    }
  }

  /**
   * Search lyrics by text
   */
  static async searchLyrics(
    userId: string, 
    query: string
  ): Promise<Lyrics[]> {
    const { data, error } = await getSupabaseClient()
      .from('lyrics')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to search lyrics: ${error.message}`)
    }

    return data as Lyrics[]
  }

  /**
   * Get lyrics by tags
   */
  static async getLyricsByTags(
    userId: string, 
    tags: string[]
  ): Promise<Lyrics[]> {
    const { data, error } = await getSupabaseClient()
      .from('lyrics')
      .select('*')
      .eq('user_id', userId)
      .overlaps('tags', tags)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch lyrics by tags: ${error.message}`)
    }

    return data as Lyrics[]
  }

  /**
   * Get lyrics by genre
   */
  static async getLyricsByGenre(
    userId: string, 
    genre: string
  ): Promise<Lyrics[]> {
    const { data, error } = await getSupabaseClient()
      .from('lyrics')
      .select('*')
      .eq('user_id', userId)
      .eq('genre', genre)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch lyrics by genre: ${error.message}`)
    }

    return data as Lyrics[]
  }

  /**
   * Get lyrics statistics
   */
  static async getLyricsStats(userId: string): Promise<{
    total: number
    byGenre: Record<string, number>
    byMood: Record<string, number>
    standalone: number
    movieAssociated: number
  }> {
    const lyrics = await this.getUserLyrics(userId)
    
    const stats = {
      total: lyrics.length,
      byGenre: {} as Record<string, number>,
      byMood: {} as Record<string, number>,
      standalone: 0,
      movieAssociated: 0
    }

    lyrics.forEach(lyric => {
      // Count by genre
      if (lyric.genre) {
        stats.byGenre[lyric.genre] = (stats.byGenre[lyric.genre] || 0) + 1
      }
      
      // Count by mood
      if (lyric.mood) {
        stats.byMood[lyric.mood] = (stats.byMood[lyric.mood] || 0) + 1
      }
      
      // Count standalone vs movie-associated
      if (lyric.movie_id || lyric.scene_id) {
        stats.movieAssociated++
      } else {
        stats.standalone++
      }
    })

    return stats
  }

  /**
   * Export lyrics to different formats
   */
  static async exportLyrics(
    lyricsId: string, 
    userId: string, 
    format: 'txt' | 'md' | 'json' = 'txt'
  ): Promise<string> {
    const lyrics = await this.getLyricsById(lyricsId)
    
    if (!lyrics || lyrics.user_id !== userId) {
      throw new Error('Lyrics not found or access denied')
    }

    switch (format) {
      case 'txt':
        return `${lyrics.title}\n\n${lyrics.content}\n\n---\nGenre: ${lyrics.genre || 'N/A'}\nMood: ${lyrics.mood || 'N/A'}\nTags: ${lyrics.tags.join(', ')}\nCreated: ${new Date(lyrics.created_at).toLocaleDateString()}`
      
      case 'md':
        return `# ${lyrics.title}\n\n${lyrics.content}\n\n---\n**Genre:** ${lyrics.genre || 'N/A'}\n**Mood:** ${lyrics.mood || 'N/A'}\n**Tags:** ${lyrics.tags.join(', ')}\n**Created:** ${new Date(lyrics.created_at).toLocaleDateString()}`
      
      case 'json':
        return JSON.stringify({
          title: lyrics.title,
          content: lyrics.content,
          genre: lyrics.genre,
          mood: lyrics.mood,
          tags: lyrics.tags,
          description: lyrics.description,
          version: lyrics.version,
          version_name: lyrics.version_name,
          created_at: lyrics.created_at,
          updated_at: lyrics.updated_at
        }, null, 2)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }
}
