import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_TREATMENT_CHARS = 24_000
const MAX_PRIOR_SCENE_CHARS = 6_000

function truncate(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}\n\n[... truncated for length ...]`
}

function formatTreatmentRecord(treatment: Record<string, unknown>): string {
  const parts: string[] = []
  if (treatment.title) parts.push(`Title: ${treatment.title}`)
  if (treatment.genre) parts.push(`Genre: ${treatment.genre}`)
  if (treatment.logline) parts.push(`Logline: ${treatment.logline}`)
  if (treatment.synopsis) parts.push(`Synopsis: ${treatment.synopsis}`)
  if (treatment.characters) parts.push(`Characters: ${treatment.characters}`)
  if (treatment.themes) parts.push(`Themes: ${treatment.themes}`)
  if (treatment.notes) parts.push(`Notes: ${treatment.notes}`)
  if (treatment.prompt) {
    parts.push(`\nFULL TREATMENT:\n${treatment.prompt}`)
  }
  return parts.join('\n')
}

export interface BuildTreatmentContextInput {
  supabase: SupabaseClient
  userId: string
  projectId: string
  workspaceId?: string | null
  currentSceneId?: string | null
}

export interface TreatmentContextResult {
  context: string
  hasTreatment: boolean
  treatmentId: string | null
  actCount: number
  priorSceneCount: number
}

export async function buildTreatmentContextForScreenplay(
  input: BuildTreatmentContextInput,
): Promise<TreatmentContextResult> {
  const { supabase, userId, projectId, workspaceId, currentSceneId } = input

  const sections: string[] = []
  let treatmentId: string | null = null
  let actCount = 0

  const { data: treatment } = await supabase
    .from('treatments')
    .select(
      'id, title, genre, logline, synopsis, prompt, characters, themes, notes, updated_at',
    )
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (treatment) {
    treatmentId = treatment.id
    sections.push('=== STORY TREATMENT ===')
    sections.push(truncate(formatTreatmentRecord(treatment), MAX_TREATMENT_CHARS))

    const { data: acts } = await supabase
      .from('treatment_acts')
      .select('act_number, title, content')
      .eq('treatment_id', treatment.id)
      .eq('user_id', userId)
      .order('act_number', { ascending: true })

    if (acts && acts.length > 0) {
      actCount = acts.length
      sections.push('\n=== TREATMENT ACTS (story structure) ===')
      for (const act of acts) {
        sections.push(
          `\nAct ${act.act_number}: ${act.title}\n${truncate(act.content || '', 8_000)}`,
        )
      }
    }
  }

  if (workspaceId) {
    const { data: workspaceArtifacts } = await supabase
      .from('creative_artifacts')
      .select('artifact_type, title, content, metadata')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .in('artifact_type', ['treatment', 'treatment_act'])
      .order('created_at', { ascending: true })

    const treatmentArtifact = workspaceArtifacts?.find((a) => a.artifact_type === 'treatment')
    const actArtifacts =
      workspaceArtifacts?.filter((a) => a.artifact_type === 'treatment_act') || []

    if (!treatment?.prompt && treatmentArtifact?.content) {
      sections.push('=== WORKSPACE TREATMENT ===')
      sections.push(truncate(String(treatmentArtifact.content), MAX_TREATMENT_CHARS))
    }

    if (actCount === 0 && actArtifacts.length > 0) {
      actCount = actArtifacts.length
      sections.push('\n=== WORKSPACE TREATMENT ACTS ===')
      for (const act of actArtifacts.sort((a, b) => {
        const actA =
          typeof a.metadata?.act_number === 'number' ? a.metadata.act_number : 0
        const actB =
          typeof b.metadata?.act_number === 'number' ? b.metadata.act_number : 0
        return actA - actB
      })) {
        sections.push(`\n${act.title}\n${truncate(String(act.content || ''), 8_000)}`)
      }
    }
  }

  if (!treatment && sections.length === 0) {
    const { data: projectArtifacts } = await supabase
      .from('creative_artifacts')
      .select('artifact_type, title, content, metadata')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .in('artifact_type', ['treatment', 'treatment_act'])
      .order('created_at', { ascending: true })

    const treatmentArtifact = projectArtifacts?.find((a) => a.artifact_type === 'treatment')
    if (treatmentArtifact?.content) {
      sections.push('=== PROJECT TREATMENT ===')
      sections.push(truncate(String(treatmentArtifact.content), MAX_TREATMENT_CHARS))
    }

    const actArtifacts =
      projectArtifacts?.filter((a) => a.artifact_type === 'treatment_act') || []
    if (actArtifacts.length > 0) {
      actCount = actArtifacts.length
      sections.push('\n=== PROJECT TREATMENT ACTS ===')
      for (const act of actArtifacts) {
        sections.push(`\n${act.title}\n${truncate(String(act.content || ''), 8_000)}`)
      }
    }
  }

  let priorSceneCount = 0
  const { data: allScenes } = await supabase
    .from('screenplay_scenes')
    .select('id, name, scene_number, content, order_index, status, metadata')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true })

  if (allScenes && allScenes.length > 0 && currentSceneId) {
    const currentIndex = allScenes.findIndex((s) => s.id === currentSceneId)
    const priorScenes =
      currentIndex > 0 ? allScenes.slice(0, currentIndex) : allScenes.filter((s) => s.id !== currentSceneId)

    const priorWithContent = priorScenes.filter((s) => {
      const content = (s.content || '').trim()
      return content.length > 0
    })

    if (priorWithContent.length > 0) {
      priorSceneCount = priorWithContent.length
      sections.push('\n=== PRIOR SCREENPLAY SCENES (continuity) ===')
      let usedChars = 0
      for (const prior of priorWithContent) {
        const label = prior.scene_number
          ? `Scene ${prior.scene_number}: ${prior.name}`
          : prior.name
        const excerpt = truncate(prior.content || '', 2_000)
        const block = `\n${label}\n${excerpt}`
        if (usedChars + block.length > MAX_PRIOR_SCENE_CHARS) break
        sections.push(block)
        usedChars += block.length
      }
    }
  }

  const context = sections.join('\n').trim()
  return {
    context,
    hasTreatment: context.length > 0,
    treatmentId,
    actCount,
    priorSceneCount,
  }
}
