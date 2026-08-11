import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScreenplayScene } from '@/lib/screenplay-scenes-service'

type CreativeArtifactRow = {
  id: string
  title: string
  content: string | null
  artifact_type: string
  metadata: Record<string, unknown> | null
}

export async function resolveScreenplaySceneForGeneration(input: {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
  screenplaySceneId: string
}): Promise<ScreenplayScene | null> {
  const { supabase, userId, workspaceId, screenplaySceneId } = input

  const { data: existing, error: existingError } = await supabase
    .from('screenplay_scenes')
    .select('*')
    .eq('id', screenplaySceneId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existingError) {
    console.error('[resolveScreenplayScene] lookup failed:', existingError)
  }
  if (existing) return existing as ScreenplayScene

  const { data: workspace, error: workspaceError } = await supabase
    .from('creative_workspaces')
    .select('project_id')
    .eq('id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (workspaceError || !workspace?.project_id) {
    console.error('[resolveScreenplayScene] workspace missing project:', workspaceError)
    return null
  }

  const { data: artifacts, error: artifactsError } = await supabase
    .from('creative_artifacts')
    .select('id, title, content, artifact_type, metadata')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)

  if (artifactsError) {
    console.error('[resolveScreenplayScene] artifacts lookup failed:', artifactsError)
    return null
  }

  const rows = (artifacts || []) as CreativeArtifactRow[]
  const sceneArtifact =
    rows.find((artifact) => artifact.metadata?.screenplay_scene_id === screenplaySceneId) ??
    rows.find((artifact) => artifact.id === screenplaySceneId) ??
    rows.find(
      (artifact) =>
        artifact.artifact_type === 'scene' &&
        typeof artifact.metadata?.screenplay_scene_id === 'string' &&
        artifact.metadata.screenplay_scene_id === screenplaySceneId,
    ) ??
    (rows.filter((artifact) => artifact.artifact_type === 'scene' && artifact.content?.trim())
      .length === 1
      ? rows.find((artifact) => artifact.artifact_type === 'scene' && artifact.content?.trim())
      : undefined)

  const sourceContent = sceneArtifact?.content?.trim()
  if (!sceneArtifact || !sourceContent) {
    console.warn('[resolveScreenplayScene] no recoverable scene artifact for', screenplaySceneId)
    return null
  }

  const metadata =
    sceneArtifact.metadata && typeof sceneArtifact.metadata === 'object'
      ? sceneArtifact.metadata
      : {}

  const sceneNumber =
    typeof metadata.scene_number === 'string'
      ? metadata.scene_number
      : typeof metadata.sceneNumber === 'string'
        ? metadata.sceneNumber
        : null

  const { data: created, error: createError } = await supabase
    .from('screenplay_scenes')
    .insert({
      user_id: userId,
      project_id: workspace.project_id,
      name: sceneArtifact.title?.trim() || 'Unnamed Scene',
      scene_number: sceneNumber,
      content: sourceContent,
      description: sourceContent.slice(0, 500),
      status: 'draft',
      metadata,
    })
    .select()
    .single()

  if (createError || !created) {
    console.error('[resolveScreenplayScene] recreate failed:', createError)
    return null
  }

  await supabase
    .from('creative_artifacts')
    .update({
      metadata: {
        ...metadata,
        screenplay_scene_id: created.id,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', sceneArtifact.id)
    .eq('user_id', userId)

  console.log('[resolveScreenplayScene] recreated screenplay scene', {
    staleScreenplaySceneId: screenplaySceneId,
    newScreenplaySceneId: created.id,
    artifactId: sceneArtifact.id,
  })

  return created as ScreenplayScene
}
