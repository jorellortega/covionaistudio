import type { ShotList, CreateShotListData } from './shot-list-service'
import type { Storyboard, CreateStoryboardData } from './storyboards-service'
import { ShotListService } from './shot-list-service'
import { StoryboardsService } from './storyboards-service'
import type { AISyncPlan } from './scene-sync-ai'
import {
  normalizeAIShotListFields,
  normalizeAIStoryboardFields,
} from './scene-sync-ai'

export type SyncDirection = 'storyboards-to-shotlist' | 'shotlist-to-storyboards'

export type SyncFieldChange = {
  field: string
  before: string
  after: string
}

export type SyncPreviewItem = {
  key: string
  kind: 'create' | 'update' | 'unchanged' | 'orphan'
  shotNumber: number
  label: string
  detail?: string
  target: 'shotlist' | 'storyboard'
  shotId?: string
  storyboardId?: string
  changes?: SyncFieldChange[]
  /** Fields populated on create */
  createFields?: SyncFieldChange[]
}

export type SyncDebugInfo = {
  sceneId: string
  sceneShotCount: number
  linkedOrphanCount: number
  totalShotsForMatching: number
  storyboardCount: number
  storyboardsOnScene?: number
  pairSummary: Array<{
    matchType: string
    shotId?: string
    storyboardId?: string
    shotNumber?: number
    sbShotNumber?: number
    outcome: 'update' | 'create' | 'orphan'
  }>
}

export type SyncPreview = {
  direction: SyncDirection
  shotListCount: number
  storyboardCount: number
  aiAssisted?: boolean
  aiSummary?: string
  debug?: SyncDebugInfo
  creates: SyncPreviewItem[]
  updates: SyncPreviewItem[]
  unchanged: SyncPreviewItem[]
  orphans: SyncPreviewItem[]
}

export type SceneSyncData = {
  shots: ShotList[]
  /** Rows returned by getShotListsByScene — what the shot list page shows */
  sceneShots: ShotList[]
  storyboards: Storyboard[]
  sceneShotCount: number
  linkedOrphanCount: number
}

export type SyncUndoEntry = {
  direction: SyncDirection
  createdShotIds: string[]
  createdStoryboardIds: string[]
  updatedShots: Array<{ id: string; before: ShotList }>
  updatedStoryboards: Array<{ id: string; before: Storyboard }>
}

type MatchedPair = {
  shot?: ShotList
  storyboard?: Storyboard
  matchType: 'link' | 'shot_number' | 'ai' | 'shot_only' | 'storyboard_only'
  aiReason?: string
  aiConfidence?: number
  shotUpdates?: Partial<CreateShotListData>
  storyboardUpdates?: Partial<CreateStoryboardData>
}

import {
  mapCameraAngleToStoryboard,
  mapMovementToStoryboard,
  mapShotTypeToStoryboard,
} from './scene-shot-field-map'

function compareShotOrder(a: { shot_number: number; sequence_order?: number }, b: { shot_number: number; sequence_order?: number }) {
  const orderA = Number(a.sequence_order ?? a.shot_number)
  const orderB = Number(b.sequence_order ?? b.shot_number)
  if (orderA !== orderB) return orderA - orderB
  return Number(a.shot_number) - Number(b.shot_number)
}

function sortPreviewItems(items: SyncPreviewItem[]): SyncPreviewItem[] {
  return [...items].sort((a, b) => compareShotOrder(
    { shot_number: a.shotNumber, sequence_order: a.shotNumber },
    { shot_number: b.shotNumber, sequence_order: b.shotNumber }
  ))
}

function findPairForStoryboard(pairs: MatchedPair[], storyboardId: string): MatchedPair | undefined {
  return pairs.find((p) => p.storyboard?.id === storyboardId)
}

function logSceneSync(message: string, data?: unknown) {
  if (typeof window !== 'undefined') {
    console.log(`[scene-sync] ${message}`, data ?? '')
  }
}

/** Same storyboards as the UI + shot rows linked to those storyboards (even if scene_id is wrong) */
export async function loadSceneSyncData(sceneId: string): Promise<SceneSyncData> {
  const storyboards = await StoryboardsService.getStoryboardsBySceneOrdered(sceneId)
  const sceneShots = await ShotListService.getShotListsByScene(sceneId)
  const sbIds = storyboards.map((sb) => sb.id)
  const linkedShots =
    sbIds.length > 0 ? await ShotListService.getShotListsByStoryboardIds(sbIds) : []

  const shotById = new Map(sceneShots.map((s) => [s.id, s]))
  let linkedOrphanCount = 0
  for (const shot of linkedShots) {
    if (!shotById.has(shot.id)) {
      shotById.set(shot.id, shot)
      linkedOrphanCount++
    }
  }

  const shots = [...shotById.values()].sort(compareShotOrder)

  logSceneSync('loadSceneSyncData', {
    sceneId,
    storyboards: storyboards.length,
    sceneShots: sceneShots.length,
    linkedOrphans: linkedOrphanCount,
    totalForMatching: shots.length,
    storyboardNumbers: storyboards.map((sb) => sb.shot_number),
    shotNumbers: sceneShots.map((s) => s.shot_number),
  })

  return {
    shots,
    sceneShots,
    storyboards,
    sceneShotCount: sceneShots.length,
    linkedOrphanCount,
  }
}

function buildSyncDebug(
  sceneId: string,
  direction: SyncDirection,
  shots: ShotList[],
  storyboards: Storyboard[],
  sceneShotCount: number,
  linkedOrphanCount: number,
  pairs: MatchedPair[]
): SyncDebugInfo {
  const pairSummary = pairs.map((pair) => {
    let outcome: 'update' | 'create' | 'orphan' = 'orphan'
    if (direction === 'storyboards-to-shotlist') {
      if (pair.storyboard && pair.shot) outcome = 'update'
      else if (pair.storyboard) outcome = 'create'
    } else if (pair.shot && pair.storyboard) {
      outcome = 'update'
    } else if (pair.shot) {
      outcome = 'create'
    }
    return {
      matchType: pair.matchType,
      shotId: pair.shot?.id,
      storyboardId: pair.storyboard?.id,
      shotNumber: pair.shot?.shot_number,
      sbShotNumber: pair.storyboard?.shot_number,
      outcome,
    }
  })

  logSceneSync('pairing', {
    direction,
    creates: pairSummary.filter((p) => p.outcome === 'create').length,
    updates: pairSummary.filter((p) => p.outcome === 'update').length,
    orphans: pairSummary.filter((p) => p.outcome === 'orphan').length,
    pairSummary,
  })

  return {
    sceneId,
    sceneShotCount,
    linkedOrphanCount,
    totalShotsForMatching: shots.length,
    storyboardCount: storyboards.length,
    pairSummary,
  }
}

/** Reliable pairing: link → same shot # → scene order → leftover creates/orphans */
function matchPairsDeterministic(shots: ShotList[], storyboards: Storyboard[]): MatchedPair[] {
  const sbById = new Map(storyboards.map((sb) => [sb.id, sb]))
  const usedShots = new Set<string>()
  const usedSbs = new Set<string>()
  const pairs: MatchedPair[] = []

  // 1. Existing storyboard_id links
  for (const shot of shots) {
    if (!shot.storyboard_id || !sbById.has(shot.storyboard_id)) continue
    const storyboard = sbById.get(shot.storyboard_id)!
    if (usedShots.has(shot.id) || usedSbs.has(storyboard.id)) continue
    usedShots.add(shot.id)
    usedSbs.add(storyboard.id)
    pairs.push({
      shot,
      storyboard,
      matchType: 'link',
      aiReason:
        shot.shot_number !== storyboard.shot_number
          ? `Linked — renumber shot list ${shot.shot_number} → ${storyboard.shot_number}`
          : undefined,
    })
  }

  // 2. Same shot_number (sorted so order is stable)
  for (const shot of [...shots].sort(compareShotOrder)) {
    if (usedShots.has(shot.id)) continue
    const storyboard = [...storyboards]
      .filter((sb) => !usedSbs.has(sb.id))
      .sort(compareShotOrder)
      .find((sb) => sb.shot_number === shot.shot_number)
    if (!storyboard) continue
    usedShots.add(shot.id)
    usedSbs.add(storyboard.id)
    pairs.push({ shot, storyboard, matchType: 'shot_number' })
  }

  // 3. Positional — zip remaining by scene order (handles 11 storyboards vs 10 shots)
  const remShots = [...shots].filter((s) => !usedShots.has(s.id)).sort(compareShotOrder)
  const remSbs = [...storyboards].filter((sb) => !usedSbs.has(sb.id)).sort(compareShotOrder)
  const zipCount = Math.min(remShots.length, remSbs.length)
  for (let i = 0; i < zipCount; i++) {
    const shot = remShots[i]
    const storyboard = remSbs[i]
    usedShots.add(shot.id)
    usedSbs.add(storyboard.id)
    const renumber =
      shot.shot_number !== storyboard.shot_number
        ? ` — renumber ${shot.shot_number} → ${storyboard.shot_number}`
        : ''
    pairs.push({
      shot,
      storyboard,
      matchType: 'ai',
      aiReason: `Scene order match (position ${i + 1})${renumber}`,
    })
  }

  // 4. Leftovers
  for (const shot of shots) {
    if (!usedShots.has(shot.id)) {
      pairs.push({ shot, matchType: 'shot_only' })
    }
  }
  for (const storyboard of storyboards) {
    if (!usedSbs.has(storyboard.id)) {
      pairs.push({
        storyboard,
        matchType: 'storyboard_only',
        aiReason: 'No shot list row — will add',
      })
    }
  }

  return pairs
}

function matchPairs(shots: ShotList[], storyboards: Storyboard[]): MatchedPair[] {
  return matchPairsDeterministic(shots, storyboards)
}

/** AI enriches text fields only — pairings stay deterministic */
function applyAIFieldOverrides(
  direction: SyncDirection,
  pairs: MatchedPair[],
  plan: AISyncPlan
): MatchedPair[] {
  const pairByIds = new Map<string, MatchedPair>()
  const pairByStoryboardOnly = new Map<string, MatchedPair>()
  const pairByShotOnly = new Map<string, MatchedPair>()

  for (const pair of pairs) {
    if (pair.shot && pair.storyboard) {
      pairByIds.set(`${pair.shot.id}:${pair.storyboard.id}`, pair)
    } else if (pair.storyboard) {
      pairByStoryboardOnly.set(pair.storyboard.id, pair)
    } else if (pair.shot) {
      pairByShotOnly.set(pair.shot.id, pair)
    }
  }

  for (const op of plan.operations) {
    if (op.type === 'update') {
      const pair = pairByIds.get(`${op.shotId}:${op.storyboardId}`)
      if (!pair) continue
      if (direction === 'storyboards-to-shotlist') {
        pair.shotUpdates = {
          ...pair.shotUpdates,
          ...normalizeAIShotListFields(op.fields),
        }
      } else {
        pair.storyboardUpdates = {
          ...pair.storyboardUpdates,
          ...normalizeAIStoryboardFields(op.fields),
        }
      }
      pair.aiConfidence = op.confidence
      if (op.reason) pair.aiReason = op.reason
    } else if (op.type === 'create_shot') {
      const pair = pairByStoryboardOnly.get(op.storyboardId)
      if (!pair) continue
      pair.shotUpdates = {
        ...pair.shotUpdates,
        ...normalizeAIShotListFields(op.fields),
      }
      pair.aiConfidence = op.confidence
      if (op.reason) pair.aiReason = op.reason
    } else if (op.type === 'create_storyboard') {
      const pair = pairByShotOnly.get(op.shotId)
      if (!pair) continue
      pair.storyboardUpdates = {
        ...pair.storyboardUpdates,
        ...normalizeAIStoryboardFields(op.fields),
      }
      pair.aiConfidence = op.confidence
      if (op.reason) pair.aiReason = op.reason
    }
  }

  return pairs
}

function resolveSyncPairs(
  shots: ShotList[],
  storyboards: Storyboard[],
  direction: SyncDirection,
  aiPlan?: AISyncPlan | null
): MatchedPair[] {
  const pairs = matchPairs(shots, storyboards)
  if (aiPlan?.operations?.length) {
    return applyAIFieldOverrides(direction, pairs, aiPlan)
  }
  return pairs
}

function matchDetail(pair: MatchedPair, fallback: string): string {
  if (pair.aiReason) {
    if (pair.aiConfidence != null) {
      return `AI fields (${Math.round(pair.aiConfidence * 100)}%): ${pair.aiReason}`
    }
    return pair.aiReason
  }
  switch (pair.matchType) {
    case 'link':
      return 'Existing storyboard link'
    case 'shot_number':
      return 'Same shot number'
    default:
      return fallback
  }
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return '—'
  return String(value)
}

function diffFields(
  labels: Array<{ key: string; label: string; before: Record<string, unknown>; after: Record<string, unknown> }>
): SyncFieldChange[] {
  const changes: SyncFieldChange[] = []
  for (const { key, label, before, after } of labels) {
    const beforeVal = displayValue(before[key])
    const afterVal = displayValue(after[key])
    if (beforeVal !== afterVal) {
      changes.push({ field: label, before: beforeVal, after: afterVal })
    }
  }
  return changes
}

function shotPreviewFields(shot: Partial<CreateShotListData>): Record<string, unknown> {
  return {
    shot_number: shot.shot_number,
    sequence_order: shot.sequence_order,
    description: shot.description,
    shot_type: shot.shot_type,
    camera_angle: shot.camera_angle,
    movement: shot.movement,
    action: shot.action,
    dialogue: shot.dialogue,
    visual_notes: shot.visual_notes,
  }
}

function storyboardPreviewFields(sb: Partial<CreateStoryboardData>): Record<string, unknown> {
  return {
    shot_number: sb.shot_number,
    sequence_order: sb.sequence_order,
    title: sb.title,
    description: sb.description,
    shot_type: sb.shot_type,
    camera_angle: sb.camera_angle,
    movement: sb.movement,
    action: sb.action,
    dialogue: sb.dialogue,
    visual_notes: sb.visual_notes,
  }
}

const FIELD_LABELS = [
  { key: 'shot_number', label: 'Shot number' },
  { key: 'sequence_order', label: 'Sequence order' },
  { key: 'description', label: 'Description' },
  { key: 'title', label: 'Title' },
  { key: 'shot_type', label: 'Shot type' },
  { key: 'camera_angle', label: 'Camera angle' },
  { key: 'movement', label: 'Movement' },
  { key: 'action', label: 'Action' },
  { key: 'dialogue', label: 'Dialogue' },
  { key: 'visual_notes', label: 'Visual notes' },
]

function buildCreateFields(values: Record<string, unknown>): SyncFieldChange[] {
  return FIELD_LABELS.map(({ key, label }) => ({
    field: label,
    before: '—',
    after: displayValue(values[key]),
  })).filter((row) => row.after !== '—')
}

function storyboardLabel(sb: Storyboard): string {
  return sb.title || `Shot ${sb.shot_number}`
}

function shotLabel(shot: ShotList): string {
  return shot.description || `Shot ${shot.shot_number}`
}

function pairUpdateKey(shot: ShotList, storyboard: Storyboard): string {
  return `update:${shot.id}:${storyboard.id}`
}

function pairCreateFromStoryboardKey(storyboard: Storyboard): string {
  return `create-sb:${storyboard.id}`
}

function pairCreateFromShotKey(shot: ShotList): string {
  return `create-shot:${shot.id}`
}

async function upsertShotListFromStoryboard(options: {
  sceneId: string
  projectId?: string
  storyboard: Storyboard
  shotUpdates?: Partial<CreateShotListData>
  undo: SyncUndoEntry
}): Promise<'created' | 'updated' | 'reattached'> {
  const { sceneId, projectId, storyboard, shotUpdates, undo } = options
  const payload = {
    scene_id: sceneId,
    project_id: projectId,
    ...storyboardToShotUpdates(storyboard, shotUpdates),
    status: 'planned' as const,
  }

  const existing = await ShotListService.getShotListsByStoryboard(storyboard.id)
  const existingRow = existing[0]

  if (existingRow) {
    undo.updatedShots.push({ id: existingRow.id, before: { ...existingRow } })
    await ShotListService.updateShotList(existingRow.id, {
      ...payload,
      project_id: projectId ?? existingRow.project_id,
    })
    const kind = existingRow.scene_id === sceneId ? 'updated' : 'reattached'
    logSceneSync(`${kind} shot from storyboard`, {
      shotId: existingRow.id,
      storyboardId: storyboard.id,
      hadSceneId: existingRow.scene_id,
    })
    return kind
  }

  const created = await ShotListService.createShotList(payload)
  undo.createdShotIds.push(created.id)
  logSceneSync('created shot from storyboard', {
    shotId: created.id,
    storyboardId: storyboard.id,
    shotNumber: created.shot_number,
  })
  return 'created'
}

/** Any storyboard still missing a shot list row on this scene gets one. */
async function ensureStoryboardShotListCoverage(options: {
  sceneId: string
  projectId?: string
  storyboards: Storyboard[]
  pairs: MatchedPair[]
  includeKeys?: Set<string>
  undo: SyncUndoEntry
}): Promise<number> {
  const { sceneId, projectId, storyboards, pairs, includeKeys, undo } = options
  const shouldApply = (key: string) => !includeKeys || includeKeys.has(key)

  const sceneShots = await ShotListService.getShotListsByScene(sceneId)
  const covered = new Set(
    sceneShots.map((s) => s.storyboard_id).filter((id): id is string => Boolean(id))
  )

  let added = 0
  for (const storyboard of [...storyboards].sort(compareShotOrder)) {
    if (covered.has(storyboard.id)) continue

    const key = pairCreateFromStoryboardKey(storyboard)
    if (!shouldApply(key)) {
      logSceneSync('skipped uncovered storyboard (not selected)', {
        storyboardId: storyboard.id,
        shotNumber: storyboard.shot_number,
      })
      continue
    }

    const pair = pairs.find((p) => p.storyboard?.id === storyboard.id)
    const result = await upsertShotListFromStoryboard({
      sceneId,
      projectId,
      storyboard,
      shotUpdates: pair?.shotUpdates,
      undo,
    })
    covered.add(storyboard.id)
    added++
    logSceneSync('ensure coverage', {
      storyboardId: storyboard.id,
      shotNumber: storyboard.shot_number,
      result,
    })
  }

  return added
}

function storyboardToShotUpdates(
  storyboard: Storyboard,
  overrides?: Partial<CreateShotListData>
): Partial<CreateShotListData> {
  const content: Partial<CreateShotListData> = {
    shot_type: storyboard.shot_type,
    camera_angle: storyboard.camera_angle,
    movement: storyboard.movement,
    description: storyboard.description || storyboard.title,
    action: storyboard.action ?? undefined,
    dialogue: storyboard.dialogue ?? undefined,
    visual_notes: storyboard.visual_notes ?? undefined,
    ...overrides,
  }
  return {
    ...content,
    shot_number: storyboard.shot_number,
    sequence_order: storyboard.sequence_order ?? storyboard.shot_number,
    storyboard_id: storyboard.id,
  }
}

function shotToStoryboardUpdates(
  shot: ShotList,
  overrides?: Partial<CreateStoryboardData>
): Partial<CreateStoryboardData> {
  const content: Partial<CreateStoryboardData> = {
    title: shot.description || `Shot ${shot.shot_number}`,
    description: shot.description || shot.action || '',
    shot_type: mapShotTypeToStoryboard(shot.shot_type),
    camera_angle: mapCameraAngleToStoryboard(shot.camera_angle),
    movement: mapMovementToStoryboard(shot.movement),
    dialogue: shot.dialogue ?? undefined,
    action: shot.action ?? undefined,
    visual_notes: shot.visual_notes ?? undefined,
    ...overrides,
  }
  return {
    ...content,
    shot_number: shot.shot_number,
    sequence_order: shot.sequence_order ?? shot.shot_number,
  }
}

export function previewSceneSync(
  direction: SyncDirection,
  shots: ShotList[],
  storyboards: Storyboard[],
  aiPlan?: AISyncPlan | null,
  syncMeta?: Pick<SceneSyncData, 'sceneShotCount' | 'linkedOrphanCount' | 'sceneShots'> & {
    sceneId?: string
  }
): SyncPreview {
  const pairs = resolveSyncPairs(shots, storyboards, direction, aiPlan)
  const sceneShots = syncMeta?.sceneShots ?? shots.filter((s) => s.scene_id === syncMeta?.sceneId)
  const sceneShotCount = syncMeta?.sceneShotCount ?? sceneShots.length
  const linkedOrphanCount = syncMeta?.linkedOrphanCount ?? 0
  const sceneId = syncMeta?.sceneId

  const onSceneByStoryboard = new Map<string, ShotList>()
  for (const row of sceneShots) {
    if (row.storyboard_id) onSceneByStoryboard.set(row.storyboard_id, row)
  }
  const storyboardsOnScene = onSceneByStoryboard.size

  const preview: SyncPreview = {
    direction,
    shotListCount: sceneShotCount,
    storyboardCount: storyboards.length,
    aiAssisted: Boolean(aiPlan?.operations?.length),
    aiSummary: aiPlan?.summary,
    creates: [],
    updates: [],
    unchanged: [],
    orphans: [],
  }

  if (sceneId) {
    preview.debug = {
      ...buildSyncDebug(sceneId, direction, shots, storyboards, sceneShotCount, linkedOrphanCount, pairs),
      storyboardsOnScene,
    }
  }

  if (direction === 'storyboards-to-shotlist') {
    const usedSceneShotIds = new Set<string>()

    for (const storyboard of [...storyboards].sort(compareShotOrder)) {
      const pair = findPairForStoryboard(pairs, storyboard.id)
      const onScene = onSceneByStoryboard.get(storyboard.id)
      const next = storyboardToShotUpdates(storyboard, pair?.shotUpdates)

      if (onScene) {
        usedSceneShotIds.add(onScene.id)
        preview.updates.push({
          key: pairUpdateKey(onScene, storyboard),
          kind: 'update',
          shotNumber: next.shot_number ?? storyboard.shot_number,
          label: storyboardLabel(storyboard),
          detail: matchDetail(pair ?? { storyboard, shot: onScene, matchType: 'link' }, 'Update matching shot list entry'),
          target: 'shotlist',
          shotId: onScene.id,
          storyboardId: storyboard.id,
          changes: diffFields(
            FIELD_LABELS.map(({ key, label }) => ({
              key,
              label,
              before: shotPreviewFields(onScene),
              after: shotPreviewFields(next),
            }))
          ),
        })
        continue
      }

      const offSceneRow =
        pair?.shot ??
        shots.find((s) => s.storyboard_id === storyboard.id && s.scene_id !== sceneId)

      preview.creates.push({
        key: pairCreateFromStoryboardKey(storyboard),
        kind: 'create',
        shotNumber: next.shot_number ?? storyboard.shot_number,
        label: storyboardLabel(storyboard),
        detail: offSceneRow
          ? 'Add to this scene — linked row exists but is not on this scene’s shot list'
          : matchDetail(
              pair ?? { storyboard, matchType: 'storyboard_only', aiReason: 'No shot list row — will add' },
              'New shot list entry linked to this storyboard'
            ),
        target: 'shotlist',
        storyboardId: storyboard.id,
        shotId: offSceneRow?.id,
        createFields: buildCreateFields(shotPreviewFields(next)),
      })
    }

    for (const shot of sceneShots) {
      if (usedSceneShotIds.has(shot.id)) continue
      if (shot.storyboard_id && storyboards.some((sb) => sb.id === shot.storyboard_id)) continue
      preview.orphans.push({
        key: `orphan-shot:${shot.id}`,
        kind: 'orphan',
        shotNumber: shot.shot_number,
        label: shotLabel(shot),
        detail: 'On shot list but no matching storyboard — will not change',
        target: 'shotlist',
        shotId: shot.id,
      })
    }

    preview.creates = sortPreviewItems(preview.creates)
    preview.updates = sortPreviewItems(preview.updates)
  } else {
    for (const pair of pairs) {
      if (pair.shot && pair.storyboard) {
        const next = shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates)
        const hasImage = Boolean(pair.storyboard.image_url)
        preview.updates.push({
          key: pairUpdateKey(pair.shot, pair.storyboard),
          kind: 'update',
          shotNumber: next.shot_number ?? pair.shot.shot_number,
          label: shotLabel(pair.shot),
          detail: matchDetail(
            pair,
            hasImage ? 'Image preserved on storyboard' : 'Update matching storyboard'
          ),
          target: 'storyboard',
          shotId: pair.shot.id,
          storyboardId: pair.storyboard.id,
          changes: diffFields(
            FIELD_LABELS.map(({ key, label }) => ({
              key,
              label,
              before: storyboardPreviewFields(pair.storyboard),
              after: storyboardPreviewFields(next),
            }))
          ),
        })
      } else if (pair.shot) {
        const next = shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates)
        preview.creates.push({
          key: pairCreateFromShotKey(pair.shot),
          kind: 'create',
          shotNumber: next.shot_number ?? pair.shot.shot_number,
          label: shotLabel(pair.shot),
          detail: matchDetail(pair, 'New draft storyboard (no image)'),
          target: 'storyboard',
          shotId: pair.shot.id,
          createFields: buildCreateFields(storyboardPreviewFields(next)),
        })
      } else if (pair.storyboard) {
        const hasImage = Boolean(pair.storyboard.image_url)
        preview.orphans.push({
          key: `orphan-sb:${pair.storyboard.id}`,
          kind: 'orphan',
          shotNumber: pair.storyboard.shot_number,
          label: storyboardLabel(pair.storyboard),
          detail: hasImage
            ? 'Keeps existing image — will not change'
            : 'No matching shot list entry — will not change',
          target: 'storyboard',
          storyboardId: pair.storyboard.id,
        })
      }
    }
  }

  return preview
}

export async function applySceneSync(options: {
  direction: SyncDirection
  sceneId: string
  projectId?: string
  sceneNumber?: number
  shots: ShotList[]
  storyboards: Storyboard[]
  includeKeys?: Set<string>
  aiPlan?: AISyncPlan | null
}): Promise<SyncUndoEntry> {
  const { direction, sceneId, projectId, sceneNumber = 1, shots, storyboards, includeKeys, aiPlan } =
    options
  const pairs = resolveSyncPairs(shots, storyboards, direction, aiPlan)
  const undo: SyncUndoEntry = {
    direction,
    createdShotIds: [],
    createdStoryboardIds: [],
    updatedShots: [],
    updatedStoryboards: [],
  }

  const shouldApply = (key: string) => !includeKeys || includeKeys.has(key)

  if (direction === 'storyboards-to-shotlist') {
    const sceneShots = shots.filter((s) => s.scene_id === sceneId)
    const onSceneByStoryboard = new Map<string, ShotList>()
    for (const row of sceneShots) {
      if (row.storyboard_id) onSceneByStoryboard.set(row.storyboard_id, row)
    }

    for (const storyboard of [...storyboards].sort(compareShotOrder)) {
      const pair = findPairForStoryboard(pairs, storyboard.id)
      const onScene = onSceneByStoryboard.get(storyboard.id)

      if (onScene) {
        const key = pairUpdateKey(onScene, storyboard)
        if (!shouldApply(key)) continue
        undo.updatedShots.push({ id: onScene.id, before: { ...onScene } })
        await ShotListService.updateShotList(onScene.id, {
          scene_id: sceneId,
          project_id: projectId ?? onScene.project_id,
          ...storyboardToShotUpdates(storyboard, pair?.shotUpdates),
        })
        logSceneSync('updated on-scene shot', {
          shotId: onScene.id,
          storyboardId: storyboard.id,
          shotNumber: storyboard.shot_number,
        })
        continue
      }

      const key = pairCreateFromStoryboardKey(storyboard)
      if (!shouldApply(key)) continue
      await upsertShotListFromStoryboard({
        sceneId,
        projectId,
        storyboard,
        shotUpdates: pair?.shotUpdates,
        undo,
      })
    }

    const ensured = await ensureStoryboardShotListCoverage({
      sceneId,
      projectId,
      storyboards,
      pairs,
      includeKeys,
      undo,
    })
    if (ensured > 0) {
      logSceneSync('ensure pass added rows', { count: ensured })
    }
  } else {
    for (const pair of pairs) {
      if (pair.shot && pair.storyboard) {
        const key = pairUpdateKey(pair.shot, pair.storyboard)
        if (!shouldApply(key)) continue
        undo.updatedStoryboards.push({ id: pair.storyboard.id, before: { ...pair.storyboard } })
        await StoryboardsService.updateStoryboard(
          pair.storyboard.id,
          shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates)
        )
        if (pair.shot.storyboard_id !== pair.storyboard.id) {
          undo.updatedShots.push({ id: pair.shot.id, before: { ...pair.shot } })
          await ShotListService.updateShotList(pair.shot.id, { storyboard_id: pair.storyboard.id })
        }
      } else if (pair.shot) {
        const key = pairCreateFromShotKey(pair.shot)
        if (!shouldApply(key)) continue
        const created = await StoryboardsService.createStoryboard({
          scene_id: sceneId,
          project_id: projectId,
          scene_number: sceneNumber,
          status: 'draft',
          ...shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates),
        } as CreateStoryboardData)
        undo.createdStoryboardIds.push(created.id)
        undo.updatedShots.push({ id: pair.shot.id, before: { ...pair.shot } })
        await ShotListService.updateShotList(pair.shot.id, { storyboard_id: created.id })
      }
    }
  }

  return undo
}

export async function undoSceneSync(entry: SyncUndoEntry): Promise<void> {
  for (const shotId of entry.createdShotIds) {
    await ShotListService.deleteShotList(shotId)
  }
  for (const storyboardId of entry.createdStoryboardIds) {
    await StoryboardsService.deleteStoryboard(storyboardId)
  }
  for (const { id, before } of entry.updatedShots) {
    const {
      id: _id,
      user_id: _userId,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...updates
    } = before
    await ShotListService.updateShotList(id, updates)
  }
  for (const { id, before } of entry.updatedStoryboards) {
    const {
      id: _id,
      user_id: _userId,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ai_generated: _aiGenerated,
      ...updates
    } = before
    await StoryboardsService.updateStoryboard(id, updates)
  }
}

const UNDO_STACK_LIMIT = 2

function undoStorageKey(sceneId: string) {
  return `scene-sync-undo:${sceneId}`
}

export function loadUndoStack(sceneId: string): SyncUndoEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(undoStorageKey(sceneId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SyncUndoEntry[]
    return Array.isArray(parsed) ? parsed.slice(0, UNDO_STACK_LIMIT) : []
  } catch {
    return []
  }
}

export function pushUndoEntry(sceneId: string, entry: SyncUndoEntry): SyncUndoEntry[] {
  const stack = loadUndoStack(sceneId)
  const next = [entry, ...stack].slice(0, UNDO_STACK_LIMIT)
  sessionStorage.setItem(undoStorageKey(sceneId), JSON.stringify(next))
  return next
}

export function popUndoEntry(sceneId: string): SyncUndoEntry | null {
  const stack = loadUndoStack(sceneId)
  if (stack.length === 0) return null
  const [first, ...rest] = stack
  if (rest.length === 0) {
    sessionStorage.removeItem(undoStorageKey(sceneId))
  } else {
    sessionStorage.setItem(undoStorageKey(sceneId), JSON.stringify(rest))
  }
  return first
}
