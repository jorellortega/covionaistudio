import { getSupabaseClient } from './supabase'

export interface AISetting {
  id: string
  user_id: string
  tab_type: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'
  locked_model: string
  is_locked: boolean
  quick_suggestions: string[]
  created_at: string
  updated_at: string
}

export interface AISettingUpdate {
  tab_type: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'
  locked_model: string
  is_locked: boolean
  quick_suggestions?: string[]
}

export class AISettingsService {
  // Check if the ai_settings table exists
  static async checkTableExists(): Promise<boolean> {
    try {
      const { data, error } = await getSupabaseClient()
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

  // Check and repair AI settings table state
  static async checkAndRepairTable(userId: string): Promise<boolean> {
    try {
      console.log('Checking AI settings table state for user:', userId)
      
      // First, try to get settings normally
      const settings = await this.getUserSettings(userId)
      
      // If we have settings for all tabs, we're good
      if (settings.length >= 5) {
        console.log('AI settings table is healthy, all tabs have settings')
        return true
      }
      
      // If we're missing settings, create them
      console.log('Missing AI settings, creating defaults for missing tabs')
      const requiredTabs: ('scripts' | 'images' | 'videos' | 'audio' | 'timeline')[] = ['scripts', 'images', 'videos', 'audio', 'timeline']
      
      for (const tabType of requiredTabs) {
        const existingSetting = settings.find(s => s.tab_type === tabType)
        if (!existingSetting) {
          console.log(`Creating missing setting for ${tabType} tab`)
          await this.getOrCreateDefaultTabSetting(userId, tabType)
        }
      }
      
      console.log('AI settings table repair completed')
      return true
    } catch (error) {
      console.error('Failed to check and repair AI settings table:', error)
      return false
    }
  }

  // Get all AI settings for a user
  static async getUserSettings(userId: string): Promise<AISetting[]> {
    try {
      console.log('Fetching AI settings for user:', userId)
      
      const { data, error } = await getSupabaseClient()
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
        
        // If it's a 406 error, the table might be in a bad state, try to recreate
        if (error.code === '406') {
          console.error('AI settings table returned 406 error, attempting to recreate default settings')
          try {
            // Try to create default settings for all tabs
            const defaultSettings = await Promise.all([
              this.getOrCreateDefaultTabSetting(userId, 'scripts'),
              this.getOrCreateDefaultTabSetting(userId, 'images'),
              this.getOrCreateDefaultTabSetting(userId, 'videos'),
              this.getOrCreateDefaultTabSetting(userId, 'audio')
            ])
            console.log('Successfully created default AI settings after 406 error')
            return defaultSettings
          } catch (recreateError) {
            console.error('Failed to recreate default settings after 406 error:', recreateError)
            return []
          }
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
  static async getTabSetting(userId: string, tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'): Promise<AISetting | null> {
    try {
      const { data, error } = await getSupabaseClient()
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

  // Get or create default AI setting for a tab
  static async getOrCreateDefaultTabSetting(userId: string, tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'): Promise<AISetting> {
    try {
      // Try to get existing setting
      const existingSetting = await this.getTabSetting(userId, tabType)
      if (existingSetting) {
        return existingSetting
      }

      // Create default setting if none exists
      const defaultSetting: AISettingUpdate = {
        tab_type: tabType,
        locked_model: this.getDefaultModelForTab(tabType),
        is_locked: false
      }

      const newSetting = await this.upsertTabSetting(userId, defaultSetting)
      return newSetting
    } catch (error) {
      console.error('Error in getOrCreateDefaultTabSetting:', error)
      throw error
    }
  }

  // Get default model for a tab type
  private static getDefaultModelForTab(tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'): string {
    switch (tabType) {
      case 'scripts':
        return 'ChatGPT'
      case 'images':
        return 'dalle'
      case 'videos':
        return 'Runway Act-Two'
      case 'audio':
        return 'ElevenLabs'
      case 'timeline':
        return 'DALL-E 3'
      default:
        return 'ChatGPT'
    }
  }

  // Create or update AI setting for a tab
  static async upsertTabSetting(userId: string, setting: AISettingUpdate): Promise<AISetting> {
    try {
      console.log('Upserting AI setting:', { userId, setting })
      
      const { data, error } = await getSupabaseClient()
        .from('ai_settings')
        .upsert({
          user_id: userId,
          tab_type: setting.tab_type,
          locked_model: setting.locked_model,
          is_locked: setting.is_locked,
          quick_suggestions: setting.quick_suggestions || [],
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
  static async deleteTabSetting(userId: string, tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'): Promise<void> {
    try {
      const { error } = await getSupabaseClient()
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

  // Update quick suggestions for a specific tab
  static async updateQuickSuggestions(userId: string, tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline', suggestions: string[]): Promise<AISetting> {
    try {
      console.log('Updating quick suggestions:', { userId, tabType, suggestions })
      
      const { data, error } = await getSupabaseClient()
        .from('ai_settings')
        .update({
          quick_suggestions: suggestions,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('tab_type', tabType)
        .select()
        .single()

      if (error) {
        console.error('Error updating quick suggestions:', error)
        throw error
      }

      console.log('Quick suggestions updated successfully:', data)
      return data
    } catch (error) {
      console.error('Error in updateQuickSuggestions:', error)
      throw error
    }
  }

  // Get quick suggestions for a specific tab
  static async getQuickSuggestions(userId: string, tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'): Promise<string[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('ai_settings')
        .select('quick_suggestions')
        .eq('user_id', userId)
        .eq('tab_type', tabType)
        .single()

      if (error) {
        console.error('Error fetching quick suggestions:', error)
        return []
      }

      return data?.quick_suggestions || []
    } catch (error) {
      console.error('Error in getQuickSuggestions:', error)
      return []
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

  // Get timeline setting (temporarily uses images until DB migration)
  static async getTimelineSetting(userId: string): Promise<AISetting | null> {
    try {
      // First try to get timeline setting
      const timelineSetting = await this.getTabSetting(userId, 'timeline')
      if (timelineSetting) {
        return timelineSetting
      }
      
      // Fallback to images setting if timeline doesn't exist
      const imagesSetting = await this.getTabSetting(userId, 'images')
      if (imagesSetting) {
        // Return a modified version that represents timeline
        return {
          ...imagesSetting,
          tab_type: 'timeline',
          id: `${imagesSetting.id}-timeline`
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting timeline setting:', error)
      return null
    }
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
