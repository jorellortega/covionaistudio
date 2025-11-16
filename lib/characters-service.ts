import { getSupabaseClient } from './supabase'

export interface Character {
  id: string
  user_id: string
  project_id: string
  name: string
  description?: string | null
  archetype?: string | null
  backstory?: string | null
  goals?: string | null
  conflicts?: string | null
  personality?: {
    traits?: string[]
    [key: string]: any
  } | null
  age?: number | null
  gender?: string | null
  relationships?: any | null
  image_url?: string | null
  created_at: string
  updated_at: string
}

export interface CreateCharacterData {
  project_id: string
  name: string
  description?: string
  archetype?: string
  backstory?: string
  goals?: string
  conflicts?: string
  personality?: { traits?: string[]; [key: string]: any }
  age?: number
  gender?: string
  relationships?: any
  image_url?: string
}

export interface UpdateCharacterData extends Partial<CreateCharacterData> {}

export class CharactersService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async getCharacters(projectId: string): Promise<Character[]> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('characters')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
    if (error) {
      console.error('Error fetching characters:', error)
      throw error
    }
    return (data || []) as Character[]
  }

  static async createCharacter(input: CreateCharacterData): Promise<Character> {
    const user = await this.ensureAuthenticated()
    const payload = {
      user_id: user.id,
      project_id: input.project_id,
      name: input.name,
      description: input.description ?? null,
      archetype: input.archetype ?? null,
      backstory: input.backstory ?? null,
      goals: input.goals ?? null,
      conflicts: input.conflicts ?? null,
      personality: input.personality ?? null,
      age: input.age ?? null,
      gender: input.gender ?? null,
      relationships: input.relationships ?? null,
      image_url: input.image_url ?? null,
    }
    const { data, error } = await getSupabaseClient()
      .from('characters')
      .insert(payload)
      .select()
      .single()
    if (error) {
      console.error('Error creating character:', error)
      throw error
    }
    return data as Character
  }

  static async updateCharacter(id: string, updates: UpdateCharacterData): Promise<Character> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('characters')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      console.error('Error updating character:', error)
      throw error
    }
    return data as Character
  }

  static async deleteCharacter(id: string): Promise<void> {
    await this.ensureAuthenticated()
    const { error } = await getSupabaseClient()
      .from('characters')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Error deleting character:', error)
      throw error
    }
  }
}


