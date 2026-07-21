export type ArtifactType =
  | 'image'
  | 'document'
  | 'treatment'
  | 'cover'
  | 'character'
  | 'location'
  | 'scene'
  | 'other'

export interface CreativeWorkspace {
  id: string
  user_id: string
  title: string
  project_id: string | null
  created_at: string
  updated_at: string
}

export interface CreativeMessage {
  id: string
  workspace_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface CreativeArtifact {
  id: string
  workspace_id: string
  user_id: string
  message_id: string | null
  artifact_type: ArtifactType
  label: string | null
  title: string
  content: string | null
  metadata: Record<string, unknown>
  project_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateWorkspaceData {
  title?: string
  project_id?: string | null
}

export interface UpdateWorkspaceData {
  title?: string
  project_id?: string | null
}

export interface CreateArtifactData {
  artifact_type: ArtifactType
  title: string
  content?: string | null
  label?: string | null
  message_id?: string | null
  project_id?: string | null
  metadata?: Record<string, unknown>
}

export interface UpdateArtifactData {
  artifact_type?: ArtifactType
  title?: string
  content?: string | null
  label?: string | null
  project_id?: string | null
  metadata?: Record<string, unknown>
}
