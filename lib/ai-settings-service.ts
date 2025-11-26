import { getSupabaseClient } from './supabase'

export interface AISetting {
  id: string
  user_id: string | null  // NULL for system-wide settings
  tab_type: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'
  locked_model: string
  selected_model?: string | null
  is_locked: boolean
  quick_suggestions: string[]
  created_at: string
  updated_at: string
}

export interface AISettingUpdate {
  tab_type: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'
  locked_model: string
  selected_model?: string | null
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

  // Check and repair AI settings table state (system-wide)
  static async checkAndRepairTable(): Promise<boolean> {
    try {
      console.log('Checking AI settings table state (system-wide)')
      
      // First, try to get settings normally
      const settings = await this.getSystemSettings()
      
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
          await this.getOrCreateDefaultTabSetting(tabType)
        }
      }
      
      console.log('AI settings table repair completed')
      return true
    } catch (error) {
      console.error('Failed to check and repair AI settings table:', error)
      return false
    }
  }

  // Get all system-wide AI settings (replaces getUserSettings)
  static async getSystemSettings(): Promise<AISetting[]> {
    try {
      console.log('Fetching system-wide AI settings')
      
      const { data, error } = await getSupabaseClient()
        .from('ai_settings')
        .select('*')
        .is('user_id', null)
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
              this.getOrCreateDefaultTabSetting('scripts'),
              this.getOrCreateDefaultTabSetting('images'),
              this.getOrCreateDefaultTabSetting('videos'),
              this.getOrCreateDefaultTabSetting('audio'),
              this.getOrCreateDefaultTabSetting('timeline')
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
      console.error('Error in getSystemSettings:', error)
      throw error
    }
  }

  // Backward compatibility: alias for getSystemSettings
  static async getUserSettings(_userId?: string): Promise<AISetting[]> {
    return this.getSystemSettings()
  }

  // Get AI setting for a specific tab (system-wide)
  static async getTabSetting(tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'): Promise<AISetting | null> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('ai_settings')
        .select('*')
        .is('user_id', null)
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

  // Get or create default AI setting for a tab (system-wide)
  static async getOrCreateDefaultTabSetting(tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'): Promise<AISetting> {
    try {
      // Try to get existing setting
      const existingSetting = await this.getTabSetting(tabType)
      if (existingSetting) {
        return existingSetting
      }

      // Create default setting if none exists
      const defaultModel = this.getDefaultModelForTab(tabType)
      const defaultSetting: AISettingUpdate = {
        tab_type: tabType,
        locked_model: defaultModel,
        selected_model: this.getDefaultSelectedModel(tabType, defaultModel),
        is_locked: false
      }

      const newSetting = await this.upsertTabSetting(defaultSetting)
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

  // Get default selected model based on provider
  private static getDefaultSelectedModel(tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline', lockedModel: string): string | null {
    if (tabType !== 'scripts') {
      return null
    }
    
    if (lockedModel === 'ChatGPT' || lockedModel === 'GPT-4') {
      return 'gpt-4o-mini'
    } else if (lockedModel === 'Claude') {
      return 'claude-3-5-sonnet-20241022'
    }
    
    return null
  }

  // Create or update AI setting for a tab (system-wide)
  static async upsertTabSetting(setting: AISettingUpdate): Promise<AISetting> {
    try {
      console.log('Upserting system-wide AI setting:', setting)
      
      // First, try to update existing setting
      const { data: updateData, error: updateError } = await getSupabaseClient()
        .from('ai_settings')
        .update({
          locked_model: setting.locked_model,
          selected_model: setting.selected_model ?? null,
          is_locked: setting.is_locked,
          quick_suggestions: setting.quick_suggestions || [],
          updated_at: new Date().toISOString()
        })
        .is('user_id', null)
        .eq('tab_type', setting.tab_type)
        .select()
        .single()

      // If update succeeded, return the updated data
      if (updateData && !updateError) {
        console.log('AI setting updated successfully:', updateData)
        return updateData
      }

      // If update failed because no row exists, insert new setting
      if (updateError && updateError.code === 'PGRST116') {
        const { data: insertData, error: insertError } = await getSupabaseClient()
          .from('ai_settings')
          .insert({
            user_id: null,  // System-wide settings have NULL user_id
            tab_type: setting.tab_type,
            locked_model: setting.locked_model,
            selected_model: setting.selected_model ?? null,
            is_locked: setting.is_locked,
            quick_suggestions: setting.quick_suggestions || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error inserting AI setting:', insertError)
          throw insertError
        }

        console.log('AI setting inserted successfully:', insertData)
        return insertData
      }

      // If update failed for another reason, throw the error
      console.error('Error updating AI setting:', updateError)
      throw updateError
    } catch (error) {
      console.error('Error in upsertTabSetting:', error)
      throw error
    }
  }

  // Delete AI setting for a tab (system-wide)
  static async deleteTabSetting(tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'): Promise<void> {
    try {
      const { error } = await getSupabaseClient()
        .from('ai_settings')
        .delete()
        .is('user_id', null)
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

  // Update quick suggestions for a specific tab (system-wide)
  static async updateQuickSuggestions(tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline', suggestions: string[]): Promise<AISetting> {
    try {
      console.log('Updating quick suggestions:', { tabType, suggestions })
      
      const { data, error } = await getSupabaseClient()
        .from('ai_settings')
        .update({
          quick_suggestions: suggestions,
          updated_at: new Date().toISOString()
        })
        .is('user_id', null)
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

  // Get quick suggestions for a specific tab (system-wide)
  static async getQuickSuggestions(tabType: 'scripts' | 'images' | 'videos' | 'audio' | 'timeline'): Promise<string[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('ai_settings')
        .select('quick_suggestions')
        .is('user_id', null)
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
      { tab_type: 'scripts', locked_model: 'ChatGPT', selected_model: 'gpt-4o-mini', is_locked: false },
      { tab_type: 'images', locked_model: 'DALL-E 3', selected_model: null, is_locked: false },
      { tab_type: 'videos', locked_model: 'Runway ML', selected_model: null, is_locked: false },
      { tab_type: 'audio', locked_model: 'ElevenLabs', selected_model: null, is_locked: false }
    ]
  }

  // Get timeline setting (system-wide)
  static async getTimelineSetting(): Promise<AISetting | null> {
    try {
      // First try to get timeline setting
      const timelineSetting = await this.getTabSetting('timeline')
      if (timelineSetting) {
        return timelineSetting
      }
      
      // Fallback to images setting if timeline doesn't exist
      const imagesSetting = await this.getTabSetting('images')
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

  // Initialize default system-wide settings
  static async initializeSystemSettings(): Promise<AISetting[]> {
    try {
      const defaultSettings = this.getDefaultSettings()
      // Add timeline setting
      defaultSettings.push({ tab_type: 'timeline', locked_model: 'DALL-E 3', selected_model: null, is_locked: false })
      
      const settings: AISetting[] = []

      for (const setting of defaultSettings) {
        const result = await this.upsertTabSetting(setting)
        settings.push(result)
      }

      return settings
    } catch (error) {
      console.error('Error initializing system settings:', error)
      throw error
    }
  }

  // Backward compatibility: alias for initializeSystemSettings
  static async initializeUserSettings(_userId?: string): Promise<AISetting[]> {
    return this.initializeSystemSettings()
  }
}
