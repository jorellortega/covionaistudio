import { supabase } from './supabase'

export interface AISetting {
  id: string
  user_id: string
  tab_type: 'scripts' | 'images' | 'videos' | 'audio'
  locked_model: string
  is_locked: boolean
  created_at: string
  updated_at: string
}

export interface AISettingUpdate {
  tab_type: 'scripts' | 'images' | 'videos' | 'audio'
  locked_model: string
  is_locked: boolean
}

export class AISettingsService {
  // Check if the ai_settings table exists
  static async checkTableExists(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('id')
        .limit(1)
      
      if (error) {
        console.error('Table check error:', error)
        return false
      }
      
      return true
    } catch (error) {
      console.error('Error checking table existence:', error)
      return false
    }
  }

  // Get all AI settings for a user
  static async getUserSettings(userId: string): Promise<AISetting[]> {
    try {
      console.log('Fetching AI settings for user:', userId)
      
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', userId)
        .order('tab_type')

      if (error) {
        console.error('Error fetching AI settings:', error)
        
        // If table doesn't exist, return empty array and log the issue
        if (error.code === '42P01') { // undefined_table
          console.error('ai_settings table does not exist. Please run the migration script.')
          return []
        }
        
        throw error
      }

      console.log('AI settings fetched:', data)
      return data || []
    } catch (error) {
      console.error('Error in getUserSettings:', error)
      throw error
    }
  }

  // Get AI setting for a specific tab
  static async getTabSetting(userId: string, tabType: 'scripts' | 'images' | 'videos' | 'audio'): Promise<AISetting | null> {
    try {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', userId)
        .eq('tab_type', tabType)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No setting found for this tab
          return null
        }
        console.error('Error fetching tab setting:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in getTabSetting:', error)
      throw error
    }
  }

  // Create or update AI setting for a tab
  static async upsertTabSetting(userId: string, setting: AISettingUpdate): Promise<AISetting> {
    try {
      console.log('Upserting AI setting:', { userId, setting })
      
      const { data, error } = await supabase
        .from('ai_settings')
        .upsert({
          user_id: userId,
          tab_type: setting.tab_type,
          locked_model: setting.locked_model,
          is_locked: setting.is_locked,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,tab_type'
        })
        .select()
        .single()

      if (error) {
        console.error('Error upserting AI setting:', error)
        throw error
      }

      console.log('AI setting upserted successfully:', data)
      return data
    } catch (error) {
      console.error('Error in upsertTabSetting:', error)
      throw error
    }
  }

  // Delete AI setting for a tab
  static async deleteTabSetting(userId: string, tabType: 'scripts' | 'images' | 'videos' | 'audio'): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_settings')
        .delete()
        .eq('user_id', userId)
        .eq('tab_type', tabType)

      if (error) {
        console.error('Error deleting AI setting:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteTabSetting:', error)
      throw error
    }
  }

  // Get default settings for a new user
  static getDefaultSettings(): AISettingUpdate[] {
    return [
      { tab_type: 'scripts', locked_model: 'ChatGPT', is_locked: false },
      { tab_type: 'images', locked_model: 'DALL-E 3', is_locked: false },
      { tab_type: 'videos', locked_model: 'Runway ML', is_locked: false },
      { tab_type: 'audio', locked_model: 'ElevenLabs', is_locked: false }
    ]
  }

  // Initialize default settings for a user
  static async initializeUserSettings(userId: string): Promise<AISetting[]> {
    try {
      const defaultSettings = this.getDefaultSettings()
      const settings: AISetting[] = []

      for (const setting of defaultSettings) {
        const result = await this.upsertTabSetting(userId, setting)
        settings.push(result)
      }

      return settings
    } catch (error) {
      console.error('Error initializing user settings:', error)
      throw error
    }
  }
}
