import { getSupabaseClient } from './supabase'

export type MoodBoardScope = 'movie' | 'scene' | 'shot'

export interface MoodBoard {
  id: string
  user_id: string
  scope: MoodBoardScope
  project_id?: string | null
  scene_id?: string | null
  storyboard_id?: string | null
  name: string
  description?: string | null
  cover_asset_id?: string | null
  is_default: boolean
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface MoodBoardItem {
  id: string
  mood_board_id: string
  asset_id?: string | null
  external_url?: string | null
  kind: 'image' | 'video' | 'audio' | 'palette' | 'note' | 'link'
  title?: string | null
  notes?: string | null
  tags?: string[] | null
  color_hex?: string | null
  order_index: number
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface CreateMoodBoardInput {
  scope: MoodBoardScope
  targetId: string
  name: string
  description?: string
  is_default?: boolean
  metadata?: Record<string, any>
}

export interface CreateMoodBoardItemInput {
  mood_board_id: string
  asset_id?: string
  external_url?: string
  kind?: MoodBoardItem['kind']
  title?: string
  notes?: string
  tags?: string[]
  color_hex?: string
  metadata?: Record<string, any>
  order_index?: number
}

export class MoodBoardsService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async listByProject(projectId: string): Promise<MoodBoard[]> {
    const user = await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('mood_boards')
      .select('*')
      .eq('scope', 'movie')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as MoodBoard[]
  }

  static async listByScene(sceneId: string): Promise<MoodBoard[]> {
    const user = await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('mood_boards')
      .select('*')
      .eq('scope', 'scene')
      .eq('scene_id', sceneId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as MoodBoard[]
  }

  static async listByShot(storyboardId: string): Promise<MoodBoard[]> {
    const user = await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('mood_boards')
      .select('*')
      .eq('scope', 'shot')
      .eq('storyboard_id', storyboardId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as MoodBoard[]
  }

  static async getAllForUser(): Promise<MoodBoard[]> {
    const user = await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('mood_boards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as MoodBoard[]
  }

  static async createBoard(input: CreateMoodBoardInput): Promise<MoodBoard> {
    const user = await this.ensureAuthenticated()
    const insert: any = {
      user_id: user.id,
      scope: input.scope,
      name: input.name,
      description: input.description || null,
      is_default: input.is_default ?? false,
      metadata: input.metadata || {},
    }
    if (input.scope === 'movie') {
      insert.project_id = input.targetId
    } else if (input.scope === 'scene') {
      insert.scene_id = input.targetId
    } else if (input.scope === 'shot') {
      insert.storyboard_id = input.targetId
    }
    const { data, error } = await getSupabaseClient()
      .from('mood_boards')
      .insert(insert)
      .select('*')
      .single()
    if (error) throw error
    return data as MoodBoard
  }

  static async deleteBoard(boardId: string): Promise<void> {
    const user = await this.ensureAuthenticated()
    const { error } = await getSupabaseClient()
      .from('mood_boards')
      .delete()
      .eq('id', boardId)
      .eq('user_id', user.id)
    if (error) throw error
  }

  static async listItems(moodBoardId: string): Promise<MoodBoardItem[]> {
    const user = await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('mood_board_items')
      .select('*')
      .eq('mood_board_id', moodBoardId)
      .order('order_index', { ascending: true })
    if (error) throw error
    // Visibility is enforced by RLS via parent board ownership
    return (data || []) as MoodBoardItem[]
  }

  static async addItem(input: CreateMoodBoardItemInput): Promise<MoodBoardItem> {
    const _ = await this.ensureAuthenticated()
    const payload = {
      mood_board_id: input.mood_board_id,
      asset_id: input.asset_id || null,
      external_url: input.external_url || null,
      kind: input.kind || 'image',
      title: input.title || null,
      notes: input.notes || null,
      tags: input.tags || [],
      color_hex: input.color_hex || null,
      order_index: input.order_index ?? 0,
      metadata: input.metadata || {},
    }
    const { data, error } = await getSupabaseClient()
      .from('mood_board_items')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as MoodBoardItem
  }

  static async deleteItem(itemId: string): Promise<void> {
    const _ = await this.ensureAuthenticated()
    const { error } = await getSupabaseClient()
      .from('mood_board_items')
      .delete()
      .eq('id', itemId)
    if (error) throw error
  }
}


