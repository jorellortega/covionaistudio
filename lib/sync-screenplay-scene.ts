import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScreenplayScene } from '@/lib/screenplay-scenes-service'
import { syncScreenplaySceneToTimeline } from '@/lib/sync-screenplay-scene-to-timeline'

export interface SyncScreenplaySceneInput {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
  projectId: string
  scene: ScreenplayScene
  screenplay: string
}

export async function syncScreenplaySceneToProject(
  input: SyncScreenplaySceneInput,
): Promise<{
  artifact: Record<string, unknown> | null
  assetId: string | null
  timelineSceneId: string | null
  warnings: string[]
}> {
  const { supabase, userId, workspaceId, projectId, scene, screenplay } = input
  const trimmed = screenplay.trim()
  const warnings: string[] = []
  if (!trimmed) {
    throw new Error('Screenplay content is empty')
  }

  const existingMetadata =
    scene.metadata && typeof scene.metadata === 'object' ? scene.metadata : {}

  const { data: updatedScene, error: sceneError } = await supabase
    .from('screenplay_scenes')
    .update({
      content: trimmed,
      status: 'screenplay',
      metadata: {
        ...existingMetadata,
        screenplay_generated: true,
        screenplay_generated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', scene.id)
    .eq('user_id', userId)
    .select()
    .single()

  if (sceneError || !updatedScene) {
    throw new Error(sceneError?.message || 'Failed to update screenplay scene')
  }

  let assetId: string | null = null
  try {
    await supabase
      .from('assets')
      .update({ is_latest_version: false })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('content_type', 'script')
      .is('scene_id', null)

    const sceneTitle = scene.scene_number
      ? `Scene ${scene.scene_number} — ${scene.name}`
      : scene.name

    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        user_id: userId,
        project_id: projectId,
        title: `${sceneTitle} (Screenplay)`,
        content_type: 'script',
        content: trimmed,
        prompt: scene.scene_number ? `Scene ${scene.scene_number}` : scene.name,
        version: 1,
        is_latest_version: true,
        metadata: {
          creative_workspace_id: workspaceId,
          screenplay_scene_id: scene.id,
          scene_number: scene.scene_number,
          source: 'creative_workspace_screenplay_generate',
          screenplay_generated: true,
        },
      })
      .select('id')
      .single()

    if (assetError) {
      warnings.push(`Could not save screenplay asset: ${assetError.message}`)
    } else {
      assetId = asset?.id || null
    }
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Could not save screenplay asset: ${error.message}`
        : 'Could not save screenplay asset',
    )
  }

  const sceneTitle = scene.scene_number
    ? `Scene ${scene.scene_number} — ${scene.name}`
    : scene.name

  let artifact: Record<string, unknown> | null = null
  try {
    const { data: existingArtifacts } = await supabase
      .from('creative_artifacts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('artifact_type', 'document')
      .filter('metadata->>screenplay_scene_id', 'eq', scene.id)
      .filter('metadata->>screenplay_generated', 'eq', 'true')

    const existingArtifact = existingArtifacts?.[0] ?? null

    const artifactPayload = {
      user_id: userId,
      workspace_id: workspaceId,
      artifact_type: 'document' as const,
      title: `${sceneTitle} — Screenplay`,
      label: 'Screenplay Scene',
      content: trimmed,
      project_id: projectId,
      metadata: {
        screenplay_scene_id: scene.id,
        scene_number: scene.scene_number,
        screenplay_generated: true,
        asset_id: assetId,
        auto_linked: true,
      },
      updated_at: new Date().toISOString(),
    }

    if (existingArtifact) {
      const { data, error } = await supabase
        .from('creative_artifacts')
        .update(artifactPayload)
        .eq('id', existingArtifact.id)
        .select()
        .single()
      if (error) {
        warnings.push(`Could not update screenplay artifact: ${error.message}`)
      } else {
        artifact = data
      }
    } else {
      const { data, error } = await supabase
        .from('creative_artifacts')
        .insert([artifactPayload])
        .select()
        .single()
      if (error) {
        warnings.push(`Could not create screenplay artifact: ${error.message}`)
      } else {
        artifact = data
      }
    }
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Could not sync screenplay artifact: ${error.message}`
        : 'Could not sync screenplay artifact',
    )
  }

  let timelineSceneId: string | null = null
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .maybeSingle()

    const timelineResult = await syncScreenplaySceneToTimeline({
      supabase,
      userId,
      projectId,
      projectName: project?.name,
      scene: updatedScene as ScreenplayScene,
      screenplay: trimmed,
    })
    timelineSceneId = timelineResult.timelineSceneId
  } catch (error) {
    console.error('[sync-screenplay-scene] timeline sync failed:', error)
    warnings.push(
      error instanceof Error
        ? `Timeline sync failed: ${error.message}`
        : 'Timeline sync failed',
    )
  }

  return {
    artifact,
    assetId,
    timelineSceneId,
    warnings,
  }
}
