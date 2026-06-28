import { getSupabaseClient } from "./supabase"

export interface ProjectVoice {
  id: string
  user_id: string
  project_id: string
  character_id?: string | null
  elevenlabs_voice_id: string
  name: string
  description?: string | null
  category?: string | null
  created_at: string
  updated_at: string
}

export type CreateProjectVoiceData = {
  project_id: string
  elevenlabs_voice_id: string
  name: string
  description?: string | null
  category?: string | null
  character_id?: string | null
}

export class ProjectVoicesService {
  static async getVoicesForProject(projectId: string): Promise<ProjectVoice[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("project_voices")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading project voices:", error)
      throw new Error(error.message)
    }

    return (data || []) as ProjectVoice[]
  }

  static async upsertVoice(input: CreateProjectVoiceData): Promise<ProjectVoice> {
    const supabase = getSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("Not signed in")
    }

    const { data: existing } = await supabase
      .from("project_voices")
      .select("id")
      .eq("user_id", user.id)
      .eq("project_id", input.project_id)
      .eq("elevenlabs_voice_id", input.elevenlabs_voice_id)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await supabase
        .from("project_voices")
        .update({
          name: input.name,
          description: input.description ?? null,
          category: input.category ?? null,
          character_id: input.character_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single()

      if (error) throw new Error(error.message)
      return data as ProjectVoice
    }

    const { data, error } = await supabase
      .from("project_voices")
      .insert({
        user_id: user.id,
        project_id: input.project_id,
        character_id: input.character_id ?? null,
        elevenlabs_voice_id: input.elevenlabs_voice_id,
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? null,
      })
      .select("*")
      .single()

    if (error) throw new Error(error.message)
    return data as ProjectVoice
  }

  static async deleteVoice(voiceRecordId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from("project_voices").delete().eq("id", voiceRecordId)

    if (error) {
      throw new Error(error.message)
    }
  }
}
