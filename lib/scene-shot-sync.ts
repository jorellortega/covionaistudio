import {
  compareShotListOrder,
  sortShotListRows,
} from './shot-list-order'
import type { ShotList, CreateShotListData } from './shot-list-service'
import type { Storyboard, CreateStoryboardData } from './storyboards-service'
import {
  characterNamesForStoryboard,
  locationNamesForStoryboard,
  buildStoryboardAssignmentPatch,
} from './storyboard-assignments'
import { ShotListService } from './shot-list-service'
import { StoryboardsService } from './storyboards-service'
import { getSupabaseClient } from './supabase'
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
  storyboardsLinked?: number
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
  /** project character id → display name (for storyboard character_id → shot list characters[]) */
  characterNamesById: Record<string, string>
  /** project location id → display name */
  locationNamesById: Record<string, string>
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
  return compareShotListOrder(a, b)
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

/** Match storyboard → on-scene shot row: canonical storyboard_id link first, then shot # */
function findSceneShotForStoryboard(
  storyboard: Storyboard,
  sceneShots: ShotList[],
  usedShotIds?: Set<string>
): { row?: ShotList; matchReason?: 'shot_number' | 'link' } {
  const isUsed = (id: string) => usedShotIds?.has(id) ?? false

  const byLink = sceneShots.find(
    (r) => !isUsed(r.id) && r.storyboard_id === storyboard.id
  )
  if (byLink) return { row: byLink, matchReason: 'link' }

  const byNumber = sceneShots.find(
    (r) => !isUsed(r.id) && Number(r.shot_number) === Number(storyboard.shot_number)
  )
  if (byNumber) return { row: byNumber, matchReason: 'shot_number' }

  return {}
}

function characterNameForStoryboard(
  storyboard: Storyboard,
  characterNamesById?: Record<string, string>
): string | undefined {
  const names = characterNamesForStoryboard(storyboard, characterNamesById)
  return names[0]
}

function logSceneSync(message: string, data?: unknown) {
  if (typeof window !== 'undefined') {
    console.log(`[scene-sync] ${message}`, data ?? '')
  }
}

export const SCENE_SYNC_APPLIED_EVENT = 'cinema-scene-sync-applied'

export function notifySceneSyncApplied(sceneId: string) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(`scene-sync-applied:${sceneId}`, String(Date.now()))
  window.dispatchEvent(new CustomEvent(SCENE_SYNC_APPLIED_EVENT, { detail: { sceneId } }))
}

async function resolveProjectIdForScene(
  sceneId: string,
  projectId?: string
): Promise<string | undefined> {
  if (projectId) return projectId
  try {
    const { data: scene } = await getSupabaseClient()
      .from('scenes')
      .select('timeline_id')
      .eq('id', sceneId)
      .maybeSingle()
    if (!scene?.timeline_id) return undefined
    const { data: timeline } = await getSupabaseClient()
      .from('timelines')
      .select('project_id')
      .eq('id', scene.timeline_id)
      .maybeSingle()
    return timeline?.project_id ?? undefined
  } catch {
    return undefined
  }
}

export async function verifySceneShotListCoverage(
  sceneId: string,
  storyboards: Storyboard[]
): Promise<{ sceneRowCount: number; storyboardsCovered: number; missingStoryboardIds: string[] }> {
  const display = await ShotListService.getShotListsForSceneDisplay(sceneId)
  const sceneShots = await ShotListService.getShotListsByScene(sceneId)
  const sbById = new Map(storyboards.map((sb) => [sb.id, sb]))
  const sbByNumber = new Map(storyboards.map((sb) => [Number(sb.shot_number), sb]))
  const covered = new Set<string>()

  for (const row of sceneShots) {
    if (row.storyboard_id && sbById.has(row.storyboard_id)) {
      covered.add(row.storyboard_id)
      continue
    }
    const sb = sbByNumber.get(Number(row.shot_number))
    if (sb) covered.add(sb.id)
  }

  const missingStoryboardIds = storyboards
    .filter((sb) => !covered.has(sb.id))
    .map((sb) => sb.id)
  return {
    sceneRowCount: display.sceneRowCount,
    storyboardsCovered: covered.size,
    missingStoryboardIds,
  }
}

/** Same storyboards as the UI + shot rows linked to those storyboards (even if scene_id is wrong) */
export async function loadSceneSyncData(sceneId: string, projectId?: string): Promise<SceneSyncData> {
  const storyboards = await StoryboardsService.getStoryboardsBySceneOrdered(sceneId)
  const display = await ShotListService.getShotListsForSceneDisplay(sceneId)
  const sceneShots = await ShotListService.getShotListsByScene(sceneId)
  const shots = display.shots

  let characterNamesById: Record<string, string> = {}
  let locationNamesById: Record<string, string> = {}
  const pid = (await resolveProjectIdForScene(sceneId, projectId)) ?? storyboards[0]?.project_id
  if (pid) {
    try {
      const { CharactersService } = await import('./characters-service')
      const chars = await CharactersService.getCharacters(pid)
      characterNamesById = Object.fromEntries(chars.map((c) => [c.id, c.name]))
    } catch (e) {
      logSceneSync('could not load characters for sync', e)
    }
    try {
      const { LocationsService } = await import('./locations-service')
      const locs = await LocationsService.getLocations(pid)
      locationNamesById = Object.fromEntries(locs.map((l) => [l.id, l.name]))
    } catch (e) {
      logSceneSync('could not load locations for sync', e)
    }
  }

  logSceneSync('loadSceneSyncData', {
    sceneId,
    storyboards: storyboards.length,
    sceneShots: sceneShots.length,
    displayShots: display.shots.length,
    linkedOrphans: display.linkedOrphanCount,
    storyboardsCovered: display.storyboardsCovered,
    storyboardNumbers: storyboards.map((sb) => sb.shot_number),
    shotNumbers: sceneShots.map((s) => s.shot_number),
    storyboardIdsOnScene: sceneShots.map((s) => s.storyboard_id).filter(Boolean),
    charactersLoaded: Object.keys(characterNamesById).length,
    locationsLoaded: Object.keys(locationNamesById).length,
  })

  return {
    shots,
    sceneShots,
    storyboards,
    sceneShotCount: sceneShots.length,
    linkedOrphanCount: display.linkedOrphanCount,
    characterNamesById,
    locationNamesById,
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

  // 1. Existing storyboard_id links — only when shot numbers agree (stale links re-pair in step 2)
  for (const shot of shots) {
    if (!shot.storyboard_id || !sbById.has(shot.storyboard_id)) continue
    const storyboard = sbById.get(shot.storyboard_id)!
    if (usedShots.has(shot.id) || usedSbs.has(storyboard.id)) continue
    if (Number(shot.shot_number) !== Number(storyboard.shot_number)) continue
    usedShots.add(shot.id)
    usedSbs.add(storyboard.id)
    pairs.push({
      shot,
      storyboard,
      matchType: 'link',
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
  // Storyboards → shot list: copy fields verbatim from storyboards — AI must not override
  if (direction === 'storyboards-to-shotlist' || !aiPlan?.operations?.length) {
    return pairs
  }
  return applyAIFieldOverrides(direction, pairs, aiPlan)
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
    characters: shot.characters?.length ? shot.characters.join(', ') : undefined,
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
  { key: 'characters', label: 'Characters' },
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
  characterNamesById?: Record<string, string>
  locationNamesById?: Record<string, string>
  undo: SyncUndoEntry
}): Promise<'created' | 'updated' | 'reattached'> {
  const { sceneId, projectId, storyboard, characterNamesById, locationNamesById, undo } = options
  const payload = {
    scene_id: sceneId,
    project_id: projectId,
    ...storyboardToShotUpdates(storyboard, undefined, characterNamesById, locationNamesById),
    status: 'planned' as const,
  }

  const sceneRows = await ShotListService.getShotListsByScene(sceneId)
  const { row: onSceneByNumber } = findSceneShotForStoryboard(storyboard, sceneRows)
  if (onSceneByNumber) {
    undo.updatedShots.push({ id: onSceneByNumber.id, before: { ...onSceneByNumber } })
    await ShotListService.updateShotList(onSceneByNumber.id, {
      ...payload,
      project_id: projectId ?? onSceneByNumber.project_id,
    })
    logSceneSync('updated shot by shot number (upsert)', {
      shotId: onSceneByNumber.id,
      storyboardId: storyboard.id,
      shotNumber: storyboard.shot_number,
    })
    return onSceneByNumber.scene_id === sceneId ? 'updated' : 'reattached'
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
  characterNamesById?: Record<string, string>
  locationNamesById?: Record<string, string>
  undo: SyncUndoEntry
}): Promise<number> {
  const { sceneId, projectId, storyboards, pairs, includeKeys, characterNamesById, locationNamesById, undo } = options
  const shouldApply = (key: string) => !includeKeys || includeKeys.has(key)

  const sceneShots = await ShotListService.getShotListsByScene(sceneId)
  const coveredByStoryboardId = new Set(
    sceneShots.map((s) => s.storyboard_id).filter((id): id is string => Boolean(id))
  )
  const coveredByShotNumber = new Set(sceneShots.map((s) => Number(s.shot_number)))

  let added = 0
  for (const storyboard of [...storyboards].sort(compareShotOrder)) {
    if (
      coveredByStoryboardId.has(storyboard.id) ||
      coveredByShotNumber.has(Number(storyboard.shot_number))
    ) {
      continue
    }

    const pair = pairs.find((p) => p.storyboard?.id === storyboard.id)
    const result = await upsertShotListFromStoryboard({
      sceneId,
      projectId,
      storyboard,
      characterNamesById,
      locationNamesById,
      undo,
    })
    coveredByStoryboardId.add(storyboard.id)
    coveredByShotNumber.add(Number(storyboard.shot_number))
    added++
    logSceneSync('ensure coverage', {
      storyboardId: storyboard.id,
      shotNumber: storyboard.shot_number,
      result,
    })
  }

  return added
}

/** Unlink duplicate / mismatched rows so each storyboard has one shot row at the right shot # */
async function repairSceneShotListLinks(options: {
  sceneId: string
  storyboards: Storyboard[]
  undo: SyncUndoEntry
}): Promise<{ unlinked: number; deduped: number }> {
  const { sceneId, storyboards, undo } = options
  const sceneShots = await ShotListService.getShotListsByScene(sceneId)
  const sbById = new Map(storyboards.map((sb) => [sb.id, sb]))
  const sbIdByNumber = new Map(storyboards.map((sb) => [Number(sb.shot_number), sb.id]))
  let unlinked = 0
  let deduped = 0

  const rowsByNumber = new Map<number, ShotList[]>()
  for (const row of sceneShots) {
    const n = Number(row.shot_number)
    const list = rowsByNumber.get(n) ?? []
    list.push(row)
    rowsByNumber.set(n, list)
  }

  for (const [shotNum, rows] of rowsByNumber) {
    if (rows.length <= 1) continue
    const expectedSbId = sbIdByNumber.get(shotNum)
    const keep =
      rows.find((r) => r.storyboard_id === expectedSbId) ??
      rows.find((r) => r.storyboard_id && sbById.has(r.storyboard_id)) ??
      rows[0]
    for (const row of rows) {
      if (row.id === keep.id) continue
      undo.updatedShots.push({ id: row.id, before: { ...row } })
      await ShotListService.updateShotList(row.id, { storyboard_id: undefined })
      deduped++
      logSceneSync('unlinked duplicate shot row', {
        shotId: row.id,
        shotNumber: shotNum,
        keptId: keep.id,
      })
    }
  }

  const freshShots = await ShotListService.getShotListsByScene(sceneId)
  for (const row of freshShots) {
    if (!row.storyboard_id || !sbById.has(row.storyboard_id)) continue
    const sb = sbById.get(row.storyboard_id)!
    if (Number(row.shot_number) === Number(sb.shot_number)) continue
    undo.updatedShots.push({ id: row.id, before: { ...row } })
    await ShotListService.updateShotList(row.id, { storyboard_id: undefined })
    unlinked++
    logSceneSync('unlinked mismatched storyboard_id', {
      shotId: row.id,
      rowShotNumber: row.shot_number,
      sbShotNumber: sb.shot_number,
      storyboardId: sb.id,
    })
  }

  return { unlinked, deduped }
}

function storyboardToShotUpdates(
  storyboard: Storyboard,
  _overrides?: Partial<CreateShotListData>,
  characterNamesById?: Record<string, string>,
  locationNamesById?: Record<string, string>,
): Partial<CreateShotListData> {
  const characterNames = characterNamesForStoryboard(storyboard, characterNamesById)
  const locationNames = locationNamesForStoryboard(storyboard, locationNamesById)
  const content: Partial<CreateShotListData> = {
    shot_type: storyboard.shot_type,
    camera_angle: storyboard.camera_angle,
    movement: storyboard.movement,
    description: storyboard.description || storyboard.title,
    action: storyboard.action ?? undefined,
    dialogue: storyboard.dialogue ?? undefined,
    visual_notes: storyboard.visual_notes ?? undefined,
    shot_number: storyboard.shot_number,
    sequence_order: Number(storyboard.shot_number),
    storyboard_id: storyboard.id,
    characters: characterNames,
    location: locationNames[0] ?? '',
    metadata: { locations: locationNames },
  }
  return content
}

function shotToStoryboardUpdates(
  shot: ShotList,
  overrides?: Partial<CreateStoryboardData>,
  characterNamesById?: Record<string, string>,
  locationNamesById?: Record<string, string>,
): Partial<CreateStoryboardData> {
  const characterNameToId = characterNamesById
    ? Object.fromEntries(Object.entries(characterNamesById).map(([id, name]) => [name, id]))
    : {}
  const locationNameToId = locationNamesById
    ? Object.fromEntries(Object.entries(locationNamesById).map(([id, name]) => [name, id]))
    : {}
  const shotLocationNames = Array.isArray(shot.metadata?.locations) && shot.metadata.locations.length > 0
    ? shot.metadata.locations.filter((name): name is string => typeof name === 'string' && !!name)
    : shot.location
      ? [shot.location]
      : []
  const characterIds = (shot.characters || [])
    .map((name) => characterNameToId[name])
    .filter((id): id is string => Boolean(id))
  const locationIds = shotLocationNames
    .map((name) => locationNameToId[name])
    .filter((id): id is string => Boolean(id))

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
    ...buildStoryboardAssignmentPatch(characterIds, locationIds),
  }
}

export function previewSceneSync(
  direction: SyncDirection,
  shots: ShotList[],
  storyboards: Storyboard[],
  aiPlan?: AISyncPlan | null,
  syncMeta?: Pick<SceneSyncData, 'sceneShotCount' | 'linkedOrphanCount' | 'sceneShots' | 'characterNamesById' | 'locationNamesById'> & {
    sceneId?: string
  }
): SyncPreview {
  const pairs = resolveSyncPairs(shots, storyboards, direction, aiPlan)
  const sceneShots = syncMeta?.sceneShots ?? shots.filter((s) => s.scene_id === syncMeta?.sceneId)
  const sceneShotCount = syncMeta?.sceneShotCount ?? sceneShots.length
  const linkedOrphanCount = syncMeta?.linkedOrphanCount ?? 0
  const sceneId = syncMeta?.sceneId
  const characterNamesById = syncMeta?.characterNamesById
  const locationNamesById = syncMeta?.locationNamesById

  const onSceneByStoryboard = new Map<string, ShotList>()
  for (const row of sceneShots) {
    if (row.storyboard_id) onSceneByStoryboard.set(row.storyboard_id, row)
  }
  const storyboardsOnScene = onSceneByStoryboard.size

  const preview: SyncPreview = {
    direction,
    shotListCount: sceneShotCount,
    storyboardCount: storyboards.length,
    storyboardsLinked: storyboardsOnScene,
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
      const { row: onScene, matchReason } = findSceneShotForStoryboard(
        storyboard,
        sceneShots,
        usedSceneShotIds
      )
      const next = storyboardToShotUpdates(storyboard, undefined, characterNamesById, locationNamesById)

      if (onScene) {
        usedSceneShotIds.add(onScene.id)
        const matchLabel =
          matchReason === 'link'
            ? `Copy storyboard → linked shot list row (Shot #${storyboard.shot_number})`
            : `Copy storyboard → shot list row #${storyboard.shot_number}`
        preview.updates.push({
          key: pairUpdateKey(onScene, storyboard),
          kind: 'update',
          shotNumber: next.shot_number ?? storyboard.shot_number,
          label: storyboardLabel(storyboard),
          detail: matchDetail(pair ?? { storyboard, shot: onScene, matchType: matchReason === 'shot_number' ? 'shot_number' : 'link' }, matchLabel),
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
        const next = shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates, characterNamesById, locationNamesById)
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
        const next = shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates, characterNamesById, locationNamesById)
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
  sceneShots?: ShotList[]
  storyboards: Storyboard[]
  includeKeys?: Set<string>
  aiPlan?: AISyncPlan | null
  characterNamesById?: Record<string, string>
  locationNamesById?: Record<string, string>
}): Promise<SyncUndoEntry> {
  const {
    direction,
    sceneId,
    projectId,
    sceneNumber = 1,
    shots,
    sceneShots: sceneShotsInput,
    storyboards,
    includeKeys,
    aiPlan,
    characterNamesById,
    locationNamesById,
  } = options
  const pairs = resolveSyncPairs(shots, storyboards, direction, aiPlan)
  const undo: SyncUndoEntry = {
    direction,
    createdShotIds: [],
    createdStoryboardIds: [],
    updatedShots: [],
    updatedStoryboards: [],
  }

  const shouldApply = (key: string) => !includeKeys || includeKeys.has(key)
  const resolvedProjectId = await resolveProjectIdForScene(sceneId, projectId)

  if (direction === 'storyboards-to-shotlist') {
    const sceneShots =
      sceneShotsInput ?? shots.filter((s) => s.scene_id === sceneId)
    const usedShotIds = new Set<string>()

    for (const storyboard of [...storyboards].sort(compareShotOrder)) {
      const pair = findPairForStoryboard(pairs, storyboard.id)
      const { row: onScene, matchReason } = findSceneShotForStoryboard(
        storyboard,
        sceneShots,
        usedShotIds
      )

      if (onScene) {
        usedShotIds.add(onScene.id)
        const key = pairUpdateKey(onScene, storyboard)
        if (!shouldApply(key)) continue
        undo.updatedShots.push({ id: onScene.id, before: { ...onScene } })
        await ShotListService.updateShotList(onScene.id, {
          scene_id: sceneId,
          project_id: resolvedProjectId ?? onScene.project_id,
          ...storyboardToShotUpdates(storyboard, undefined, characterNamesById, locationNamesById),
        })
        logSceneSync('updated on-scene shot', {
          shotId: onScene.id,
          storyboardId: storyboard.id,
          shotNumber: storyboard.shot_number,
          matchReason,
          listShotNumber: onScene.shot_number,
        })
        continue
      }

      const key = pairCreateFromStoryboardKey(storyboard)
      if (!shouldApply(key)) continue
      await upsertShotListFromStoryboard({
        sceneId,
        projectId: resolvedProjectId,
        storyboard,
        characterNamesById,
        locationNamesById,
        undo,
      })
    }

    const ensured = await ensureStoryboardShotListCoverage({
      sceneId,
      projectId: resolvedProjectId,
      storyboards,
      pairs,
      includeKeys,
      characterNamesById,
      locationNamesById,
      undo,
    })
    if (ensured > 0) {
      logSceneSync('ensure pass added rows', { count: ensured })
    }

    const aligned = await StoryboardsService.alignSequenceOrderToShotNumbers(sceneId, storyboards)
    if (aligned > 0) {
      logSceneSync('aligned storyboard sequence_order to shot_number', { count: aligned })
    }

    const repaired = await repairSceneShotListLinks({ sceneId, storyboards, undo })
    if (repaired.unlinked > 0 || repaired.deduped > 0) {
      logSceneSync('repaired shot list links', repaired)
    }
  } else {
    for (const pair of pairs) {
      if (pair.shot && pair.storyboard) {
        const key = pairUpdateKey(pair.shot, pair.storyboard)
        if (!shouldApply(key)) continue
        undo.updatedStoryboards.push({ id: pair.storyboard.id, before: { ...pair.storyboard } })
        await StoryboardsService.updateStoryboard(
          pair.storyboard.id,
          shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates, characterNamesById, locationNamesById)
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
          ...shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates, characterNamesById, locationNamesById),
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
