import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScreenplayScene } from '@/lib/screenplay-scenes-service'

export interface SyncScreenplaySceneToTimelineInput {
  supabase: SupabaseClient
  userId: string
  projectId: string
  projectName?: string | null
  scene: ScreenplayScene
  screenplay: string
}

export async function syncScreenplaySceneToTimeline(
  input: SyncScreenplaySceneToTimelineInput,
): Promise<{ timelineSceneId: string | null }> {
  const { supabase, userId, projectId, projectName, scene, screenplay } = input
  const trimmed = screenplay.trim()
  if (!trimmed) {
    return { timelineSceneId: null }
  }

  const { data: timelines, error: timelineListError } = await supabase
    .from('timelines')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (timelineListError) {
    throw new Error(timelineListError.message)
  }

  let timelineId = timelines?.[0]?.id ?? null
  if (!timelineId) {
    const { data: timeline, error: timelineError } = await supabase
      .from('timelines')
      .insert({
        user_id: userId,
        project_id: projectId,
        name: `${projectName || 'Movie'} Timeline`,
        description: `Timeline for ${projectName || 'Movie'}`,
        duration_seconds: 0,
        fps: 24,
        resolution_width: 1920,
        resolution_height: 1080,
      })
      .select('id')
      .single()

    if (timelineError || !timeline) {
      throw new Error(timelineError?.message || 'Failed to create timeline')
    }
    timelineId = timeline.id
  }

  const { data: timelineScenes, error: scenesError } = await supabase
    .from('scenes')
    .select('id, metadata, start_time_seconds, duration_seconds, order_index')
    .eq('timeline_id', timelineId)
    .eq('user_id', userId)
    .order('order_index', { ascending: true })

  if (scenesError) {
    throw new Error(scenesError.message)
  }

  const existingMetadata =
    scene.metadata && typeof scene.metadata === 'object' ? scene.metadata : {}

  const sceneNumber = scene.scene_number?.trim() || ''
  const linkedTimelineSceneId =
    typeof existingMetadata.timeline_scene_id === 'string'
      ? existingMetadata.timeline_scene_id
      : null

  let existingScene =
    linkedTimelineSceneId
      ? timelineScenes?.find((item) => item.id === linkedTimelineSceneId) ?? null
      : null

  if (!existingScene && sceneNumber) {
    existingScene =
      timelineScenes?.find((item) => {
        const metadata = item.metadata as Record<string, unknown> | null
        return metadata?.sceneNumber === sceneNumber
      }) ?? null
  }

  if (!existingScene) {
    existingScene =
      timelineScenes?.find((item) => item.name === scene.name) ?? null
  }

  const metadata = {
    ...(existingScene?.metadata && typeof existingScene.metadata === 'object'
      ? existingScene.metadata
      : {}),
    sceneNumber,
    location: scene.location || '',
    characters: Array.isArray(scene.characters) ? scene.characters : [],
    shotType: scene.shot_type || '',
    mood: scene.mood || '',
    notes: scene.notes || '',
    status: scene.status || 'Planning',
    screenplay_scene_id: scene.id,
  }

  if (existingScene) {
    const { error: updateError } = await supabase
      .from('scenes')
      .update({
        name: scene.name,
        description: scene.description || scene.name,
        screenplay_content: trimmed,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingScene.id)
      .eq('user_id', userId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    await supabase
      .from('screenplay_scenes')
      .update({
        metadata: {
          ...existingMetadata,
          timeline_scene_id: existingScene.id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', scene.id)
      .eq('user_id', userId)

    return { timelineSceneId: existingScene.id }
  }

  const lastScene = timelineScenes?.[timelineScenes.length - 1]
  const startTimeSeconds = lastScene
    ? (lastScene.start_time_seconds || 0) + (lastScene.duration_seconds || 60)
    : 0
  const orderIndex =
    typeof scene.order_index === 'number'
      ? scene.order_index
      : (timelineScenes?.length || 0) + 1

  const { data: createdScene, error: createError } = await supabase
    .from('scenes')
    .insert({
      user_id: userId,
      timeline_id: timelineId,
      name: scene.name,
      description: scene.description || scene.name,
      screenplay_content: trimmed,
      duration_seconds: 60,
      start_time_seconds: startTimeSeconds,
      order_index: orderIndex,
      scene_type: 'video',
      content_url: '',
      metadata,
    })
    .select('id')
    .single()

  if (createError || !createdScene) {
    throw new Error(createError?.message || 'Failed to create timeline scene')
  }

  await supabase
    .from('screenplay_scenes')
    .update({
      metadata: {
        ...existingMetadata,
        timeline_scene_id: createdScene.id,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', scene.id)
    .eq('user_id', userId)

  return { timelineSceneId: createdScene.id }
}
