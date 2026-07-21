import { getSupabaseClient } from './supabase'

export type AvatarImageSource = 'generated' | 'from_reference' | 'existing'

export interface AvatarSet {
  id: string
  user_id: string
  project_id: string
  character_id: string | null
  character_name: string | null
  description: string | null
  style: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AvatarImageRecord {
  id: string
  user_id: string
  avatar_set_id: string
  project_id: string
  character_id: string | null
  asset_id: string | null
  angle_id: string
  angle_label: string
  image_url: string
  prompt: string | null
  source: AvatarImageSource
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateAvatarImageInput {
  project_id: string
  character_id?: string | null
  character_name?: string | null
  description?: string | null
  style?: string | null
  angle_id: string
  angle_label: string
  image_url: string
  prompt?: string | null
  source?: AvatarImageSource
  asset_id?: string | null
  sort_order?: number
  metadata?: Record<string, unknown>
}

export class AvatarImagesService {
  static async ensureAuthenticated() {
    const { data: { user }, error } = await getSupabaseClient().auth.getUser()
    if (!error && user) return user

    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session?.user) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async getOrCreateSet(input: {
    project_id: string
    character_id?: string | null
    character_name?: string | null
    description?: string | null
    style?: string | null
  }): Promise<AvatarSet> {
    const user = await this.ensureAuthenticated()
    const characterId = input.character_id || null

    let query = getSupabaseClient()
      .from('avatar_sets')
      .select('*')
      .eq('project_id', input.project_id)
      .eq('user_id', user.id)

    if (characterId) {
      query = query.eq('character_id', characterId)
    } else {
      query = query.is('character_id', null)
    }

    const { data: existing, error: fetchError } = await query.maybeSingle()
    if (fetchError) throw fetchError
    if (existing) {
      const updates: Record<string, unknown> = {}
      if (input.character_name?.trim()) updates.character_name = input.character_name.trim()
      if (input.description?.trim()) updates.description = input.description.trim()
      if (input.style?.trim()) updates.style = input.style.trim()

      if (Object.keys(updates).length > 0) {
        const { data: updated, error: updateError } = await getSupabaseClient()
          .from('avatar_sets')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single()
        if (updateError) throw updateError
        return updated as AvatarSet
      }

      return existing as AvatarSet
    }

    const { data: created, error: createError } = await getSupabaseClient()
      .from('avatar_sets')
      .insert({
        user_id: user.id,
        project_id: input.project_id,
        character_id: characterId,
        character_name: input.character_name?.trim() || null,
        description: input.description?.trim() || null,
        style: input.style?.trim() || null,
        metadata: {},
      })
      .select()
      .single()

    if (createError) throw createError
    return created as AvatarSet
  }

  static async listImagesForProject(projectId: string): Promise<AvatarImageRecord[]> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('avatar_images')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data || []) as AvatarImageRecord[]
  }

  static async listImagesForSet(avatarSetId: string): Promise<AvatarImageRecord[]> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('avatar_images')
      .select('*')
      .eq('avatar_set_id', avatarSetId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data || []) as AvatarImageRecord[]
  }

  static async createImage(input: CreateAvatarImageInput): Promise<AvatarImageRecord> {
    const user = await this.ensureAuthenticated()
    const avatarSet = await this.getOrCreateSet({
      project_id: input.project_id,
      character_id: input.character_id ?? null,
      character_name: input.character_name ?? null,
      description: input.description ?? null,
      style: input.style ?? null,
    })

    const { data, error } = await getSupabaseClient()
      .from('avatar_images')
      .insert({
        user_id: user.id,
        avatar_set_id: avatarSet.id,
        project_id: input.project_id,
        character_id: input.character_id ?? avatarSet.character_id,
        asset_id: input.asset_id ?? null,
        angle_id: input.angle_id,
        angle_label: input.angle_label,
        image_url: input.image_url,
        prompt: input.prompt ?? null,
        source: input.source ?? 'generated',
        sort_order: input.sort_order ?? 0,
        metadata: input.metadata ?? {},
      })
      .select()
      .single()

    if (error) throw error
    return data as AvatarImageRecord
  }

  static async updateImage(
    id: string,
    updates: Partial<Pick<AvatarImageRecord, 'asset_id' | 'prompt' | 'metadata'>>,
  ): Promise<AvatarImageRecord> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('avatar_images')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as AvatarImageRecord
  }

  static async deleteImage(id: string): Promise<AvatarImageRecord | null> {
    await this.ensureAuthenticated()
    const { data: existing } = await getSupabaseClient()
      .from('avatar_images')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    const { error } = await getSupabaseClient()
      .from('avatar_images')
      .delete()
      .eq('id', id)

    if (error) throw error
    return (existing as AvatarImageRecord | null) ?? null
  }
}
