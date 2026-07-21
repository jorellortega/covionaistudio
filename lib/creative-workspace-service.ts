import { getSupabaseClient } from './supabase'
import type {
  CreativeWorkspace,
  CreativeMessage,
  CreativeArtifact,
  CreateWorkspaceData,
  UpdateWorkspaceData,
  CreateArtifactData,
  UpdateArtifactData,
} from './creative-workspace-types'

export class CreativeWorkspaceService {
  static async getUserWorkspaces(userId: string): Promise<CreativeWorkspace[]> {
    const { data, error } = await getSupabaseClient()
      .from('creative_workspaces')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch workspaces: ${error.message}`)
    return data || []
  }

  static async getWorkspace(workspaceId: string): Promise<CreativeWorkspace | null> {
    const { data, error } = await getSupabaseClient()
      .from('creative_workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch workspace: ${error.message}`)
    }
    return data
  }

  static async createWorkspace(userId: string, data: CreateWorkspaceData = {}): Promise<CreativeWorkspace> {
    const { data: workspace, error } = await getSupabaseClient()
      .from('creative_workspaces')
      .insert([{
        user_id: userId,
        title: data.title || 'Untitled Project',
        project_id: data.project_id || null,
      }])
      .select()
      .single()

    if (error) throw new Error(`Failed to create workspace: ${error.message}`)
    return workspace
  }

  static async updateWorkspace(workspaceId: string, data: UpdateWorkspaceData): Promise<CreativeWorkspace> {
    const { data: workspace, error } = await getSupabaseClient()
      .from('creative_workspaces')
      .update(data)
      .eq('id', workspaceId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update workspace: ${error.message}`)
    return workspace
  }

  static async deleteWorkspace(workspaceId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('creative_workspaces')
      .delete()
      .eq('id', workspaceId)

    if (error) throw new Error(`Failed to delete workspace: ${error.message}`)
  }

  static async getMessages(workspaceId: string): Promise<CreativeMessage[]> {
    const { data, error } = await getSupabaseClient()
      .from('creative_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`)
    return data || []
  }

  static async addMessage(
    workspaceId: string,
    role: CreativeMessage['role'],
    content: string,
  ): Promise<CreativeMessage> {
    const { data, error } = await getSupabaseClient()
      .from('creative_messages')
      .insert([{ workspace_id: workspaceId, role, content }])
      .select()
      .single()

    if (error) throw new Error(`Failed to add message: ${error.message}`)

    await getSupabaseClient()
      .from('creative_workspaces')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    return data
  }

  static async getArtifacts(workspaceId: string): Promise<CreativeArtifact[]> {
    const { data, error } = await getSupabaseClient()
      .from('creative_artifacts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch artifacts: ${error.message}`)
    return (data || []).map((a) => ({ ...a, metadata: a.metadata || {} }))
  }

  static async createArtifact(
    userId: string,
    workspaceId: string,
    data: CreateArtifactData,
  ): Promise<CreativeArtifact> {
    const { data: artifact, error } = await getSupabaseClient()
      .from('creative_artifacts')
      .insert([{
        user_id: userId,
        workspace_id: workspaceId,
        artifact_type: data.artifact_type,
        title: data.title,
        content: data.content ?? null,
        label: data.label ?? null,
        message_id: data.message_id ?? null,
        project_id: data.project_id ?? null,
        metadata: data.metadata ?? {},
      }])
      .select()
      .single()

    if (error) throw new Error(`Failed to create artifact: ${error.message}`)
    return { ...artifact, metadata: artifact.metadata || {} }
  }

  static async updateArtifact(artifactId: string, data: UpdateArtifactData): Promise<CreativeArtifact> {
    const { data: artifact, error } = await getSupabaseClient()
      .from('creative_artifacts')
      .update(data)
      .eq('id', artifactId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update artifact: ${error.message}`)
    return { ...artifact, metadata: artifact.metadata || {} }
  }

  static async deleteArtifact(artifactId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('creative_artifacts')
      .delete()
      .eq('id', artifactId)

    if (error) throw new Error(`Failed to delete artifact: ${error.message}`)
  }
}
