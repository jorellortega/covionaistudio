import { getSupabaseClient } from './supabase'

export type StoryObjectCategory =
  | 'vehicle'
  | 'prop'
  | 'weapon'
  | 'furniture'
  | 'technology'
  | 'food'
  | 'document'
  | 'artwork'
  | 'clothing'
  | 'other'

export interface StoryObject {
  id: string
  user_id: string
  project_id: string
  name: string
  category: StoryObjectCategory
  description?: string | null
  visual_description?: string | null
  material?: string | null
  color?: string | null
  era?: string | null
  notes?: string | null
  image_url?: string | null
  reference_images?: string[] | null
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface CreateStoryObjectData extends Partial<Omit<StoryObject, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
  project_id: string
  name: string
  category?: StoryObjectCategory
}

export interface UpdateStoryObjectData extends Partial<CreateStoryObjectData> {}

export const STORY_OBJECT_CATEGORIES: { value: StoryObjectCategory; label: string }[] = [
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'prop', label: 'Prop' },
  { value: 'weapon', label: 'Weapon' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'technology', label: 'Technology' },
  { value: 'food', label: 'Food' },
  { value: 'document', label: 'Document' },
  { value: 'artwork', label: 'Artwork' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'other', label: 'Other' },
]

export function getStoryObjectCategoryLabel(category: StoryObjectCategory | string): string {
  return STORY_OBJECT_CATEGORIES.find((entry) => entry.value === category)?.label ?? String(category)
}

export class StoryObjectsService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async getStoryObjects(projectId: string): Promise<StoryObject[]> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('story_objects')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching story objects:', error)
      throw error
    }

    return (data || []) as StoryObject[]
  }

  static async createStoryObject(input: CreateStoryObjectData): Promise<StoryObject> {
    const user = await this.ensureAuthenticated()
    const payload = {
      user_id: user.id,
      project_id: input.project_id,
      name: input.name,
      category: input.category ?? 'other',
      description: input.description ?? null,
      visual_description: input.visual_description ?? null,
      material: input.material ?? null,
      color: input.color ?? null,
      era: input.era ?? null,
      notes: input.notes ?? null,
      image_url: input.image_url ?? null,
      reference_images: input.reference_images ?? null,
      metadata: input.metadata ?? null,
    }

    const { data, error } = await getSupabaseClient()
      .from('story_objects')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error('Error creating story object:', error)
      throw error
    }

    return data as StoryObject
  }

  static async updateStoryObject(id: string, updates: UpdateStoryObjectData): Promise<StoryObject> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('story_objects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating story object:', error)
      throw error
    }

    return data as StoryObject
  }

  static async deleteStoryObject(id: string): Promise<void> {
    await this.ensureAuthenticated()
    const { error } = await getSupabaseClient()
      .from('story_objects')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting story object:', error)
      throw error
    }
  }
}
