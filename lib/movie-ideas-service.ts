import { getSupabaseClient } from './supabase'

export interface MovieIdea {
  id: string
  user_id: string
  title: string
  description: string
  genre: string
  main_creator: string
  co_creators?: string[]
  original_prompt?: string
  prompt: string
  status: "concept" | "development" | "completed"
  created_at: string
  updated_at: string
}

export interface CreateMovieIdeaData {
  title: string
  description: string
  genre?: string
  main_creator: string
  co_creators?: string[]
  original_prompt?: string
  prompt?: string
  status?: "concept" | "development" | "completed"
}

export interface UpdateMovieIdeaData {
  title?: string
  description?: string
  genre?: string
  main_creator?: string
  co_creators?: string[]
  original_prompt?: string
  prompt?: string
  status?: "concept" | "development" | "completed"
}

export class MovieIdeasService {
  static async getUserIdeas(userId: string): Promise<MovieIdea[]> {
    const { data, error } = await getSupabaseClient()
      .from('movie_ideas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch ideas: ${error.message}`)
    }

    return data || []
  }

  static async getMovieIdea(ideaId: string): Promise<MovieIdea | null> {
    const { data, error } = await getSupabaseClient()
      .from('movie_ideas')
      .select('*')
      .eq('id', ideaId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null
      }
      throw new Error(`Failed to fetch idea: ${error.message}`)
    }

    return data
  }

  static async createIdea(userId: string, ideaData: CreateMovieIdeaData): Promise<MovieIdea> {
    console.log('🎬 DEBUG - MovieIdeasService.createIdea called with:', { userId, ideaData })
    
    const insertData = {
      user_id: userId,
      ...ideaData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    console.log('🎬 DEBUG - Inserting data:', insertData)
    
    const { data, error } = await getSupabaseClient()
      .from('movie_ideas')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('🎬 DEBUG - Database insert error:', error)
      throw new Error(`Failed to create idea: ${error.message}`)
    }

    console.log('🎬 DEBUG - Successfully created idea:', data)
    return data
  }

  static async updateIdea(ideaId: string, ideaData: UpdateMovieIdeaData): Promise<MovieIdea> {
    console.log('🎬 DEBUG - MovieIdeasService.updateIdea called with:', { ideaId, ideaData })
    
    const updateData = {
      ...ideaData,
      updated_at: new Date().toISOString()
    }
    
    console.log('🎬 DEBUG - Updating data:', updateData)
    
    const { data, error } = await getSupabaseClient()
      .from('movie_ideas')
      .update(updateData)
      .eq('id', ideaId)
      .select()
      .single()

    if (error) {
      console.error('🎬 DEBUG - Database update error:', error)
      throw new Error(`Failed to update idea: ${error.message}`)
    }

    console.log('🎬 DEBUG - Successfully updated idea:', data)
    return data
  }

  static async deleteIdea(ideaId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('movie_ideas')
      .delete()
      .eq('id', ideaId)

    if (error) {
      throw new Error(`Failed to delete idea: ${error.message}`)
    }
  }

  static async searchIdeas(userId: string, searchTerm: string): Promise<MovieIdea[]> {
    const { data, error } = await getSupabaseClient()
      .from('movie_ideas')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,prompt.ilike.%${searchTerm}%,main_creator.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to search ideas: ${error.message}`)
    }

    return data || []
  }

  static async getIdeasByGenre(userId: string, genre: string): Promise<MovieIdea[]> {
    const { data, error } = await getSupabaseClient()
      .from('movie_ideas')
      .select('*')
      .eq('user_id', userId)
      .eq('genre', genre)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch ideas by genre: ${error.message}`)
    }

    return data || []
  }

  static async getIdeasByStatus(userId: string, status: string): Promise<MovieIdea[]> {
    const { data, error } = await getSupabaseClient()
      .from('movie_ideas')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch ideas by status: ${error.message}`)
    }

    return data || []
  }
}
