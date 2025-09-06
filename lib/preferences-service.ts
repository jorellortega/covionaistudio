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
        console.error('No user found for preference update')
        return false
      }

      console.log('🔧 Setting preference:', { key, value, userId: user.id })

      // First try to update existing record
      const { data: existingData, error: selectError } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', user.id)
        .eq('key', key)
        .maybeSingle()

      if (selectError) {
        console.error('Error checking existing preference:', selectError)
        return false
      }

      if (existingData) {
        // Update existing record
        console.log('🔧 Updating existing preference record:', existingData.id)
        const { error: updateError } = await supabase
          .from('user_preferences')
          .update({
            value,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingData.id)

        if (updateError) {
          console.error('Error updating preference:', updateError)
          return false
        }
      } else {
        // Insert new record
        console.log('🔧 Inserting new preference record')
        const { error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: user.id,
            key,
            value,
            updated_at: new Date().toISOString()
          })

        if (insertError) {
          console.error('Error inserting preference:', insertError)
          return false
        }
      }

      console.log('🔧 Preference saved successfully')
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
