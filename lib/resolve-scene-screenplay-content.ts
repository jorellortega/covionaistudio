import { getSupabaseClient } from './supabase'
import { isCompleteScreenplayFormat } from './screenplay-format-utils'

export type SceneScreenplaySource =
  | 'screenplay_scene'
  | 'timeline_screenplay_content'
  | 'screenplay_asset'
  | 'scene_asset'
  | 'none'

export interface ResolvedSceneScreenplay {
  content: string
  source: SceneScreenplaySource
  screenplaySceneId?: string
}

interface ResolveSceneScreenplayInput {
  sceneId: string
  projectId?: string
  sceneName?: string
  sceneMetadata?: Record<string, unknown> | null
  screenplayContent?: string | null
  userId: string
}

type ScreenplaySceneRow = {
  id: string
  content?: string | null
  status?: string | null
  scene_number?: string | null
  name?: string | null
  metadata?: Record<string, unknown> | null
}

async function loadLinkedScreenplayScene(
  input: ResolveSceneScreenplayInput,
): Promise<ScreenplaySceneRow | null> {
  const { sceneId, projectId, sceneName, sceneMetadata, userId } = input
  const supabase = getSupabaseClient()

  const linkedId =
    typeof sceneMetadata?.screenplay_scene_id === 'string'
      ? sceneMetadata.screenplay_scene_id
      : null

  if (linkedId) {
    const { data } = await supabase
      .from('screenplay_scenes')
      .select('id, content, status, scene_number, name, metadata')
      .eq('id', linkedId)
      .eq('user_id', userId)
      .maybeSingle()

    if (data) return data
  }

  if (!projectId) return null

  const { data: rows } = await supabase
    .from('screenplay_scenes')
    .select('id, content, status, scene_number, name, metadata')
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (!rows?.length) return null

  const byTimelineLink = rows.find(
    (row) =>
      typeof row.metadata?.timeline_scene_id === 'string' &&
      row.metadata.timeline_scene_id === sceneId,
  )
  if (byTimelineLink) return byTimelineLink

  const sceneNumber =
    typeof sceneMetadata?.sceneNumber === 'string'
      ? sceneMetadata.sceneNumber
      : typeof sceneMetadata?.sceneNumber === 'number'
        ? String(sceneMetadata.sceneNumber)
        : null

  if (sceneNumber) {
    const byNumber = rows.find((row) => row.scene_number === sceneNumber)
    if (byNumber) return byNumber
  }

  if (sceneName) {
    const byName = rows.find((row) => row.name === sceneName)
    if (byName) return byName
  }

  return null
}

export async function resolveSceneScreenplayContent(
  input: ResolveSceneScreenplayInput,
): Promise<ResolvedSceneScreenplay> {
  const { sceneId, projectId, screenplayContent, userId } = input
  const supabase = getSupabaseClient()
  const timelineContent = screenplayContent?.trim() || ''

  const screenplayScene = await loadLinkedScreenplayScene(input)
  const screenplaySceneId = screenplayScene?.id
  const screenplaySceneContent = screenplayScene?.content?.trim() || ''
  const screenplaySceneIsGenerated =
    screenplayScene?.status === 'screenplay' ||
    isCompleteScreenplayFormat(screenplaySceneContent)
  const timelineIsScreenplay = timelineContent
    ? isCompleteScreenplayFormat(timelineContent)
    : false

  if (screenplaySceneContent && screenplaySceneIsGenerated) {
    if (!timelineIsScreenplay || screenplayScene?.status === 'screenplay') {
      return {
        content: screenplaySceneContent,
        source: 'screenplay_scene',
        screenplaySceneId,
      }
    }
  }

  if (timelineContent && timelineIsScreenplay) {
    return {
      content: timelineContent,
      source: 'timeline_screenplay_content',
      screenplaySceneId,
    }
  }

  if (screenplaySceneId) {
    const { data: assets } = await supabase
      .from('assets')
      .select('content, metadata, created_at')
      .eq('content_type', 'script')
      .eq('user_id', userId)
      .eq('is_latest_version', true)
      .order('created_at', { ascending: false })

    const generatedAsset = assets?.find(
      (asset) =>
        asset.metadata?.screenplay_scene_id === screenplaySceneId &&
        (asset.metadata?.screenplay_generated === true ||
          isCompleteScreenplayFormat(asset.content || '')),
    )

    if (generatedAsset?.content?.trim()) {
      return {
        content: generatedAsset.content.trim(),
        source: 'screenplay_asset',
        screenplaySceneId,
      }
    }
  }

  if (screenplaySceneContent) {
    return {
      content: screenplaySceneContent,
      source: 'screenplay_scene',
      screenplaySceneId,
    }
  }

  if (timelineContent) {
    return {
      content: timelineContent,
      source: 'timeline_screenplay_content',
      screenplaySceneId,
    }
  }

  const { data: sceneAssets } = await supabase
    .from('assets')
    .select('content')
    .eq('scene_id', sceneId)
    .eq('content_type', 'script')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (sceneAssets?.[0]?.content?.trim()) {
    return {
      content: sceneAssets[0].content.trim(),
      source: 'scene_asset',
      screenplaySceneId,
    }
  }

  return { content: '', source: 'none', screenplaySceneId }
}
