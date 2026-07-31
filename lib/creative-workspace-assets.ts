import type { SupabaseClient } from '@supabase/supabase-js'
import { mergeSceneContent } from '@/lib/creative-chat-utils'
import type { CreativeImportCategory } from '@/lib/creative-workspace-import'

type SyncImportAssetInput = {
  supabase: SupabaseClient
  userId: string
  projectId: string
  workspaceId: string
  artifactId: string
  fileName: string
  category: CreativeImportCategory
  publicUrl: string
  extractedText: string | null
  mimeType: string
}

export async function syncCreativeImportToProjectAsset({
  supabase,
  userId,
  projectId,
  workspaceId,
  artifactId,
  fileName,
  category,
  publicUrl,
  extractedText,
  mimeType,
}: SyncImportAssetInput): Promise<string | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!project) return null

  const contentType = category === 'image' ? 'image' : 'script'
  const title = fileName.replace(/\.[^/.]+$/, '') || fileName

  const { data: asset, error } = await supabase
    .from('assets')
    .insert({
      user_id: userId,
      project_id: projectId,
      title,
      content_type: contentType,
      content_url: publicUrl,
      content: extractedText,
      prompt: `Imported from workspace: ${fileName}`,
      version: 1,
      is_latest_version: true,
      metadata: {
        creative_workspace_id: workspaceId,
        creative_workspace_artifact_id: artifactId,
        imported: true,
        originalName: fileName,
        mimeType,
        source: 'creative_workspace_import',
      },
    })
    .select('id')
    .single()

  if (error || !asset) {
    console.error('Failed to sync creative import to project asset:', error)
    return null
  }

  return asset.id
}

type SyncSceneTextInput = {
  supabase: SupabaseClient
  userId: string
  projectId: string
  workspaceId: string
  artifactId: string
  title: string
  content: string
  sceneNumber: string | null
}

export async function syncSceneTextToProjectAsset({
  supabase,
  userId,
  projectId,
  workspaceId,
  artifactId,
  title,
  content,
  sceneNumber,
}: SyncSceneTextInput): Promise<string | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!project) return null

  const { data: asset, error } = await supabase
    .from('assets')
    .insert({
      user_id: userId,
      project_id: projectId,
      title,
      content_type: 'script',
      content,
      prompt: sceneNumber ? `Imported Scene ${sceneNumber} from workspace` : 'Imported scene from workspace',
      version: 1,
      is_latest_version: true,
      metadata: {
        creative_workspace_id: workspaceId,
        creative_workspace_artifact_id: artifactId,
        imported: true,
        scene_number: sceneNumber,
        source: 'creative_workspace_scene_import',
        verbatim: true,
      },
    })
    .select('id')
    .single()

  if (error || !asset) {
    console.error('Failed to sync scene text to project asset:', error)
    return null
  }

  return asset.id
}

type SyncSceneScreenplayInput = {
  supabase: SupabaseClient
  userId: string
  projectId: string
  workspaceId: string
  artifactId: string
  title: string
  content: string
  sceneNumber: string | null
  location?: string | null
  characters?: string[]
}

export interface ScreenplaySceneSyncDebug {
  action: 'insert' | 'update' | 'skipped_no_project'
  sceneNumber: string | null
  existingChars: number
  incomingChars: number
  mergedChars: number
  mergeStrategy: 'new' | 'incoming_superset' | 'keep_existing' | 'overlap' | 'append' | 'replace'
}

export async function syncSceneTextToScreenplayScene({
  supabase,
  userId,
  projectId,
  workspaceId,
  artifactId,
  title,
  content,
  sceneNumber,
  location,
  characters,
}: SyncSceneScreenplayInput): Promise<{ sceneId: string | null; debug: ScreenplaySceneSyncDebug }> {
  const incoming = content.trim()
  const debug: ScreenplaySceneSyncDebug = {
    action: 'insert',
    sceneNumber: sceneNumber?.trim() || null,
    existingChars: 0,
    incomingChars: incoming.length,
    mergedChars: incoming.length,
    mergeStrategy: 'new',
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!project) {
    debug.action = 'skipped_no_project'
    return { sceneId: null, debug }
  }

  const scenePayload = {
    name: title,
    scene_number: sceneNumber?.trim() || null,
    location: location?.trim() || null,
    characters: characters?.filter((c) => c.trim()) || [],
    content: incoming,
    description: incoming.slice(0, 500),
    status: 'draft',
  }

  let sceneId: string | null = null

  if (sceneNumber?.trim()) {
    const { data: existingScene } = await supabase
      .from('screenplay_scenes')
      .select('id, content')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('scene_number', sceneNumber.trim())
      .maybeSingle()

    if (existingScene) {
      const existing = (existingScene.content || '').trim()
      debug.existingChars = existing.length
      debug.action = 'update'

      let mergedContent = incoming
      let mergeStrategy: ScreenplaySceneSyncDebug['mergeStrategy'] = 'replace'

      if (!existing) {
        mergeStrategy = 'new'
      } else if (incoming === existing) {
        mergedContent = existing
        mergeStrategy = 'keep_existing'
      } else if (incoming.includes(existing)) {
        mergedContent = incoming
        mergeStrategy = 'incoming_superset'
      } else if (existing.includes(incoming)) {
        mergedContent = existing
        mergeStrategy = 'keep_existing'
      } else {
        const beforeMerge = existing
        mergedContent = mergeSceneContent(existing, incoming)
        mergeStrategy = mergedContent.length > beforeMerge.length + incoming.length - 48
          ? 'append'
          : 'overlap'
      }

      debug.mergedChars = mergedContent.length
      debug.mergeStrategy = mergeStrategy

      const updatePayload = {
        ...scenePayload,
        content: mergedContent,
        description: mergedContent.slice(0, 500),
        name: title,
      }

      const { data, error } = await supabase
        .from('screenplay_scenes')
        .update(updatePayload)
        .eq('id', existingScene.id)
        .select('id, content')
        .single()

      if (error || !data) {
        console.error('[scene-import] Failed to update screenplay scene:', error)
        return { sceneId: null, debug }
      }
      sceneId = data.id
      debug.mergedChars = (data.content || mergedContent).length
    }
  }

  if (!sceneId) {
    const { data: existingScenes } = await supabase
      .from('screenplay_scenes')
      .select('order_index')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrder =
      typeof existingScenes?.[0]?.order_index === 'number'
        ? existingScenes[0].order_index + 1
        : sceneNumber
          ? parseInt(sceneNumber, 10) || 1
          : 1

    const { data, error } = await supabase
      .from('screenplay_scenes')
      .insert([{
        user_id: userId,
        project_id: projectId,
        ...scenePayload,
        order_index: nextOrder,
        metadata: {
          creative_workspace_id: workspaceId,
          creative_workspace_artifact_id: artifactId,
          imported: true,
          source: 'creative_workspace_scene_import',
        },
      }])
      .select('id')
      .single()

    if (error || !data) {
      console.error('[scene-import] Failed to create screenplay scene:', error)
      return { sceneId: null, debug }
    }
    sceneId = data.id
    debug.action = 'insert'
    debug.mergedChars = incoming.length
  }

  return { sceneId, debug }
}

export async function syncCombinedScreenplayToProjectAsset({
  supabase,
  userId,
  projectId,
  workspaceId,
}: {
  supabase: SupabaseClient
  userId: string
  projectId: string
  workspaceId: string
}): Promise<string | null> {
  const { data: scenes, error: scenesError } = await supabase
    .from('screenplay_scenes')
    .select('content, order_index, scene_number')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('order_index', { ascending: true })

  if (scenesError || !scenes?.length) return null

  const combined = scenes
    .filter((scene) => typeof scene.content === 'string' && scene.content.trim())
    .map((scene) => scene.content.trim())
    .join('\n\n')

  if (!combined) return null

  const { data: existingAssets } = await supabase
    .from('assets')
    .select('id, metadata')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('content_type', 'script')
    .is('scene_id', null)
    .order('created_at', { ascending: false })

  const existingAsset = existingAssets?.find(
    (asset) =>
      typeof asset.metadata === 'object' &&
      asset.metadata !== null &&
      (asset.metadata as Record<string, unknown>).source === 'creative_workspace_combined_screenplay',
  )

  if (existingAsset?.id) {
    const { data: updated, error } = await supabase
      .from('assets')
      .update({
        title: 'Screenplay (from workspace)',
        content: combined,
        prompt: `${scenes.length} scenes combined`,
        is_latest_version: true,
        metadata: {
          creative_workspace_id: workspaceId,
          source: 'creative_workspace_combined_screenplay',
          scene_count: scenes.length,
          character_count: combined.length,
        },
      })
      .eq('id', existingAsset.id)
      .select('id')
      .single()

    if (error || !updated) {
      console.error('[scene-import] Failed to update combined screenplay asset:', error)
      return null
    }
    return updated.id
  }

  await supabase
    .from('assets')
    .update({ is_latest_version: false })
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('content_type', 'script')
    .is('scene_id', null)

  const { data: asset, error } = await supabase
    .from('assets')
    .insert({
      user_id: userId,
      project_id: projectId,
      title: 'Screenplay (from workspace)',
      content_type: 'script',
      content: combined,
      prompt: `${scenes.length} scenes combined from creative workspace`,
      version: 1,
      is_latest_version: true,
      metadata: {
        creative_workspace_id: workspaceId,
        source: 'creative_workspace_combined_screenplay',
        scene_count: scenes.length,
        character_count: combined.length,
      },
    })
    .select('id')
    .single()

  if (error || !asset) {
    console.error('[scene-import] Failed to create combined screenplay asset:', error)
    return null
  }

  return asset.id
}
