import { getSupabaseClient } from './supabase'

export interface UserPreferences {
  hidePromptText?: boolean
  // Add more preferences here as needed
}

export class PreferencesService {
  private static async getClient() {
    return getSupabaseClient()
  }

  // Get a specific preference value
  static async getPreference<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const supabase = await this.getClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return defaultValue
      }

      const { data, error } = await supabase
        .from('user_preferences')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', key)
        .single()

      if (error || !data) {
        return defaultValue
      }

      return data.value as T
    } catch (error) {
      console.error('Error getting preference:', error)
      return defaultValue
    }
  }

  // Set a preference value
  static async setPreference<T>(key: string, value: T): Promise<boolean> {
    try {
      const supabase = await this.getClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return false
      }

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          key,
          value,
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error setting preference:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error setting preference:', error)
      return false
    }
  }

  // Get all preferences for a user
  static async getAllPreferences(): Promise<UserPreferences> {
    try {
      const supabase = await this.getClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return {}
      }

      const { data, error } = await supabase
        .from('user_preferences')
        .select('key, value')
        .eq('user_id', user.id)

      if (error || !data) {
        return {}
      }

      const preferences: UserPreferences = {}
      data.forEach(item => {
        preferences[item.key as keyof UserPreferences] = item.value
      })

      return preferences
    } catch (error) {
      console.error('Error getting all preferences:', error)
      return {}
    }
  }

  // Get specific preference methods
  static async getHidePromptText(): Promise<boolean> {
    return this.getPreference('hidePromptText', false)
  }

  static async setHidePromptText(hide: boolean): Promise<boolean> {
    return this.setPreference('hidePromptText', hide)
  }
}
