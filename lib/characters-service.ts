import { getSupabaseClient } from './supabase'

export interface LanguageFluency {
  language: string
  fluency: string
}

export interface LanguageSwitch {
  language: string
  when: string
}

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
  species?: string | null
  character_type?: 'main' | 'supporting' | 'extra' | 'cameo' | 'voice' | 'stunt' | null
  show_on_casting?: boolean | null
  relationships?: any | null
  image_url?: string | null
  created_at: string
  updated_at: string
  
  // 1. CORE IDENTITY
  full_name?: string | null
  nicknames?: string[] | null
  birthdate?: string | null // DATE as string
  nationality?: string | null
  ethnicity?: string | null
  place_of_birth?: string | null
  current_residence?: string | null
  occupation?: string | null
  education_level?: string | null
  socio_economic_status_past?: string | null
  socio_economic_status_present?: string | null
  languages_spoken?: LanguageFluency[] | null
  
  // 2. VISUAL BIBLE
  height?: string | null
  build?: string | null
  skin_tone?: string | null
  eye_color?: string | null
  eye_shape?: string | null
  eye_expression?: string | null
  hair_color_natural?: string | null
  hair_color_current?: string | null
  hair_length?: string | null
  hair_texture?: string | null
  usual_hairstyle?: string | null
  face_shape?: string | null
  distinguishing_marks?: string | null
  usual_clothing_style?: string | null
  typical_color_palette?: string[] | null
  accessories?: string | null
  posture?: string | null
  body_language?: string | null
  voice_pitch?: string | null
  voice_speed?: string | null
  voice_accent?: string | null
  voice_tone?: string | null
  reference_images?: string[] | null
  
  // 3. PSYCHOLOGY
  core_values?: string[] | null
  main_external_goal?: string | null
  deep_internal_need?: string | null
  greatest_fear?: string | null
  fatal_flaw?: string | null
  key_strengths?: string[] | null
  coping_style_stress?: string | null
  baseline_personality?: string | null
  sense_of_humor?: string | null
  treats_authority?: string | null
  treats_subordinates?: string | null
  treats_loved_ones?: string | null
  
  // 4. BACKSTORY & TIMELINE
  childhood_situation?: string | null
  important_childhood_event_1?: string | null
  important_teen_event?: string | null
  important_adulthood_event?: string | null
  major_trauma_or_loss?: string | null
  biggest_victory_or_success?: string | null
  what_changed_before_story?: string | null
  personal_secrets?: string | null
  truth_hidden_from_self?: string | null
  
  // 5. RELATIONSHIPS (Enhanced)
  parents_info?: string | null
  siblings_info?: string | null
  other_family_info?: string | null
  best_friends?: string[] | null
  other_friends_allies?: string[] | null
  romantic_status?: string | null
  important_exes?: string | null
  enemies_rivals?: string[] | null
  mentors?: string[] | null
  people_responsible_for?: string[] | null
  
  // 6. STORY ROLE & ARC
  role_in_story?: string | null
  character_logline?: string | null
  starting_state?: string | null
  midpoint_change?: string | null
  end_state?: string | null
  key_decisions?: string[] | null
  
  // 7. PRACTICAL DETAILS / CONTINUITY
  vehicle_type?: string | null
  vehicle_model?: string | null
  vehicle_color?: string | null
  vehicle_condition?: string | null
  phone_tech_level?: string | null
  home_type?: string | null
  home_neighborhood?: string | null
  home_condition?: string | null
  home_key_objects?: string | null
  daily_routine?: string | null
  job_schedule?: string | null
  pets?: string[] | null
  hobbies?: string[] | null
  addictions_habits?: string[] | null
  health_issues?: string | null
  religion_spirituality?: string | null
  political_social_views?: string | null
  
  // 8. DIALOGUE NOTES
  common_phrases?: string[] | null
  swearing_level?: string | null
  speaking_style?: string | null
  language_switches?: LanguageSwitch[] | null
  
  // 9. EXTRA NOTES
  visual_motifs?: string[] | null
  theme_they_represent?: string | null
  foreshadowing_notes?: string | null
}

export interface CreateCharacterData extends Partial<Omit<Character, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
  project_id: string
  name: string
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


