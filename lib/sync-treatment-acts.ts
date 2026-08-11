import type { SupabaseClient } from '@supabase/supabase-js'
import { parseTreatmentActs, type ParsedTreatmentAct } from '@/lib/creative-chat-utils'

export interface SyncTreatmentActsInput {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
  treatmentId: string
  projectId: string
  treatmentTitle: string
  prompt: string
  messageId?: string | null
}

export interface SyncTreatmentActsResult {
  acts: ParsedTreatmentAct[]
  actArtifacts: Array<Record<string, unknown>>
}

export async function syncTreatmentActs(
  input: SyncTreatmentActsInput,
): Promise<SyncTreatmentActsResult> {
  const {
    supabase,
    userId,
    workspaceId,
    treatmentId,
    projectId,
    treatmentTitle,
    prompt,
    messageId,
  } = input

  const parsedActs = parseTreatmentActs(prompt)
  if (parsedActs.length === 0) {
    return { acts: [], actArtifacts: [] }
  }

  await supabase
    .from('treatment_acts')
    .delete()
    .eq('treatment_id', treatmentId)
    .eq('user_id', userId)

  if (messageId) {
    await supabase
      .from('creative_artifacts')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('message_id', messageId)
      .eq('artifact_type', 'treatment_act')
  }

  const actArtifacts: Array<Record<string, unknown>> = []

  for (const act of parsedActs) {
    const { data: actRow, error: actError } = await supabase
      .from('treatment_acts')
      .insert({
        user_id: userId,
        treatment_id: treatmentId,
        project_id: projectId,
        act_number: act.actNumber,
        title: act.title,
        content: act.content,
        order_index: act.actNumber,
        metadata: { parsed_from_workspace: true },
      })
      .select()
      .single()

    if (actError || !actRow) {
      throw new Error(actError?.message || 'Failed to save treatment act')
    }

    const { data: actArtifact, error: artifactError } = await supabase
      .from('creative_artifacts')
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        message_id: messageId || null,
        artifact_type: 'treatment_act',
        title: `${treatmentTitle} — ${act.title}`,
        label: act.title,
        content: act.content,
        project_id: projectId,
        metadata: {
          treatment_id: treatmentId,
          treatment_act_id: actRow.id,
          act_number: act.actNumber,
        },
      })
      .select()
      .single()

    if (artifactError || !actArtifact) {
      throw new Error(artifactError?.message || 'Failed to save treatment act artifact')
    }

    actArtifacts.push(actArtifact)
  }

  return { acts: parsedActs, actArtifacts }
}
