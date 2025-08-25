import { supabase } from './supabase'

export interface IdeaImage {
  id: string
  idea_id: string
  user_id: string
  image_url: string
  prompt: string
  bucket_path?: string
  created_at: string
}

export interface CreateIdeaImageData {
  idea_id: string
  image_url: string
  prompt: string
  bucket_path?: string
}

export class IdeaImagesService {
  static async getIdeaImages(ideaId: string): Promise<IdeaImage[]> {
    try {
      const { data, error } = await supabase
        .from('idea_images')
        .select('*')
        .eq('idea_id', ideaId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch idea images: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Error fetching idea images:', error)
      return []
    }
  }

  static async saveIdeaImage(userId: string, imageData: CreateIdeaImageData): Promise<IdeaImage> {
    try {
      const { data, error } = await supabase
        .from('idea_images')
        .insert([{
          user_id: userId,
          ...imageData
        }])
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to save idea image: ${error.message}`)
      }

      return data
    } catch (error) {
      throw new Error(`Failed to save idea image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async deleteIdeaImage(imageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('idea_images')
        .delete()
        .eq('id', imageId)

      if (error) {
        throw new Error(`Failed to delete idea image: ${error.message}`)
      }
    } catch (error) {
      throw new Error(`Failed to delete idea image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async getUserIdeaImages(userId: string): Promise<IdeaImage[]> {
    try {
      const { data, error } = await supabase
        .from('idea_images')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch user idea images: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Error fetching user idea images:', error)
      return []
    }
  }
}
