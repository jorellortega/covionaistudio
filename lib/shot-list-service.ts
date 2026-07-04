import { getSupabaseClient } from './supabase'
import { sortShotListRows } from './shot-list-order'

export interface ShotList {
  id: string
  user_id: string
  project_id?: string
  scene_id?: string
  screenplay_scene_id?: string
  storyboard_id?: string
  shot_number: number
  shot_type: string
  camera_angle: string
  movement: string
  lens?: string
  framing?: string
  duration_seconds?: number
  description?: string
  action?: string
  dialogue?: string
  visual_notes?: string
  audio_notes?: string
  props?: string[]
  characters?: string[]
  location?: string
  time_of_day?: string
  lighting_notes?: string
  camera_notes?: string
  status: 'planned' | 'scheduled' | 'shot' | 'review' | 'approved' | 'rejected'
  sequence_order: number
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface CreateShotListData {
  project_id?: string
  scene_id?: string
  screenplay_scene_id?: string
  storyboard_id?: string
  shot_number?: number
  shot_type?: string
  camera_angle?: string
  movement?: string
  lens?: string
  framing?: string
  duration_seconds?: number
  description?: string
  action?: string
  dialogue?: string
  visual_notes?: string
  audio_notes?: string
  props?: string[]
  characters?: string[]
  location?: string
  time_of_day?: string
  lighting_notes?: string
  camera_notes?: string
  status?: 'planned' | 'scheduled' | 'shot' | 'review' | 'approved' | 'rejected'
  sequence_order?: number
  metadata?: Record<string, any>
}

export interface UpdateShotListData extends Partial<CreateShotListData> {}

export class ShotListService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  // Get shot lists by scene (timeline scene)
  static async getShotListsByScene(sceneId: string): Promise<ShotList[]> {
    try {
      const user = await this.ensureAuthenticated()
      
      const { data, error } = await getSupabaseClient()
        .from('shot_lists')
        .select('*')
        .eq('scene_id', sceneId)
        .eq('user_id', user.id)
        .order('sequence_order', { ascending: true })
        .order('shot_number', { ascending: true })

      if (error) {
        console.error('Error fetching shot lists by scene:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getShotListsByScene:', error)
      throw error
    }
  }

  // Get shot lists by screenplay scene
  static async getShotListsByScreenplayScene(screenplaySceneId: string): Promise<ShotList[]> {
    try {
      const user = await this.ensureAuthenticated()
      
      const { data, error } = await getSupabaseClient()
        .from('shot_lists')
        .select('*')
        .eq('screenplay_scene_id', screenplaySceneId)
        .eq('user_id', user.id)
        .order('sequence_order', { ascending: true })
        .order('shot_number', { ascending: true })

      if (error) {
        console.error('Error fetching shot lists by screenplay scene:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getShotListsByScreenplayScene:', error)
      throw error
    }
  }

  // Get shot lists by storyboard
  static async getShotListsByStoryboard(storyboardId: string): Promise<ShotList[]> {
    try {
      const user = await this.ensureAuthenticated()
      
      const { data, error } = await getSupabaseClient()
        .from('shot_lists')
        .select('*')
        .eq('storyboard_id', storyboardId)
        .eq('user_id', user.id)
        .order('sequence_order', { ascending: true })
        .order('shot_number', { ascending: true })

      if (error) {
        console.error('Error fetching shot lists by storyboard:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getShotListsByStoryboard:', error)
      throw error
    }
  }

  /** Scene rows + storyboard-linked rows missing from this scene (what the UI should show). */
  static async getShotListsForSceneDisplay(sceneId: string): Promise<{
    shots: ShotList[]
    sceneRowCount: number
    linkedOrphanCount: number
    storyboardsCovered: number
  }> {
    const debug = await this.getShotListSceneDebug(sceneId)
    return {
      shots: debug.displayShots,
      sceneRowCount: debug.sceneRowCount,
      linkedOrphanCount: debug.linkedOrphanCount,
      storyboardsCovered: debug.storyboardsLinkedOnScene,
    }
  }

  /** Full diagnostic snapshot for shot list vs storyboard mismatch debugging */
  static async getShotListSceneDebug(sceneId: string) {
    const { StoryboardsService } = await import('./storyboards-service')
    const sceneShots = await this.getShotListsByScene(sceneId)
    const storyboards = await StoryboardsService.getStoryboardsBySceneOrdered(sceneId)
    const sbIds = storyboards.map((sb) => sb.id)
    const linked =
      sbIds.length > 0 ? await this.getShotListsByStoryboardIds(sbIds) : []

    const sortRows = (rows: ShotList[]) => sortShotListRows(rows)

    const merged = new Map<string, ShotList>()
    for (const row of sceneShots) merged.set(row.id, row)

    let linkedOrphanCount = 0
    for (const row of linked) {
      if (row.scene_id === sceneId) continue
      if (!merged.has(row.id)) {
        merged.set(row.id, row)
        linkedOrphanCount++
      }
    }

    const displayShots = sortRows([...merged.values()])
    const sceneShotIds = new Set(sceneShots.map((r) => r.id))

    const rows = displayShots.map((row) => ({
      id: row.id,
      shot_number: row.shot_number,
      sequence_order: row.sequence_order ?? null,
      storyboard_id: row.storyboard_id ?? null,
      scene_id: row.scene_id ?? null,
      description: row.description?.slice(0, 80) ?? null,
      source: sceneShotIds.has(row.id)
        ? ('scene_query' as const)
        : ('linked_orphan' as const),
      onScene: row.scene_id === sceneId,
    }))

    const linkedByStoryboard = new Map<string, ShotList>()
    for (const row of linked) {
      if (row.storyboard_id) linkedByStoryboard.set(row.storyboard_id, row)
    }

    const onSceneByStoryboard = new Map<string, ShotList>()
    for (const row of sceneShots) {
      if (row.storyboard_id) onSceneByStoryboard.set(row.storyboard_id, row)
    }

    const storyboardRows = storyboards.map((sb) => {
      const onScene = onSceneByStoryboard.get(sb.id)
      const linkedRow = linkedByStoryboard.get(sb.id)
      return {
        id: sb.id,
        shot_number: sb.shot_number,
        title: sb.title?.slice(0, 60) ?? null,
        linkedShotId: linkedRow?.id ?? onScene?.id ?? null,
        linkedShotSceneId: linkedRow?.scene_id ?? onScene?.scene_id ?? null,
        linkedShotNumber: linkedRow?.shot_number ?? onScene?.shot_number ?? null,
        linkedOnScene: Boolean(onScene),
        inDisplay: displayShots.some(
          (r) => r.storyboard_id === sb.id || r.id === onScene?.id
        ),
      }
    })

    const covered = new Set<string>()
    for (const row of sceneShots) {
      if (row.storyboard_id) covered.add(row.storyboard_id)
    }

    const missingStoryboards = storyboardRows
      .filter((sb) => !covered.has(sb.id))
      .map((sb) => ({
        id: sb.id,
        shot_number: sb.shot_number,
        title: sb.title,
      }))

    const storyboardToShots = new Map<string, string[]>()
    for (const row of sceneShots) {
      if (!row.storyboard_id) continue
      const list = storyboardToShots.get(row.storyboard_id) ?? []
      list.push(row.id)
      storyboardToShots.set(row.storyboard_id, list)
    }
    const duplicateStoryboardLinks = [...storyboardToShots.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([storyboard_id, shotIds]) => ({ storyboard_id, shotIds }))

    const unlinkedSceneRows = sceneShots
      .filter((r) => !r.storyboard_id)
      .map((r) => ({
        id: r.id,
        shot_number: r.shot_number,
        description: r.description?.slice(0, 60) ?? null,
      }))

    const sb11 = storyboards.find((sb) => Number(sb.shot_number) === 11)
    const shot11DisplayIndex = sb11
      ? displayShots.findIndex((r) => r.storyboard_id === sb11.id)
      : -1
    const orderMismatches = sceneShots
      .filter((r) => {
        const sn = Number(r.shot_number)
        const so = Number(r.sequence_order ?? sn)
        return so !== sn && Number.isInteger(so)
      })
      .map((r) => ({
        id: r.id,
        shot_number: r.shot_number,
        sequence_order: r.sequence_order ?? null,
      }))

    const shot11Debug = sb11
      ? {
          storyboard: storyboardRows.find((s) => s.id === sb11.id),
          sceneRow: rows.find(
            (r) => r.storyboard_id === sb11.id && r.onScene
          ),
          linkedRow: rows.find(
            (r) => r.storyboard_id === sb11.id && !r.onScene
          ),
          displayRow: rows.find((r) => r.storyboard_id === sb11.id),
          inUi: displayShots.some((r) => r.storyboard_id === sb11.id),
          displayIndex: shot11DisplayIndex >= 0 ? shot11DisplayIndex + 1 : null,
        }
      : undefined

    return {
      sceneId,
      loadedAt: new Date().toISOString(),
      sceneRowCount: sceneShots.length,
      displayRowCount: displayShots.length,
      storyboardCount: storyboards.length,
      storyboardsLinkedOnScene: covered.size,
      linkedOrphanCount,
      displayShots,
      rows,
      storyboards: storyboardRows,
      missingStoryboards,
      duplicateStoryboardLinks,
      unlinkedSceneRows,
      shot11: shot11Debug,
      orderMismatches,
      displayOrder: rows.map((r) => r.shot_number),
    }
  }

  /** Shots linked to any of these storyboards (for sync — catches rows missing scene_id) */
  static async getShotListsByStoryboardIds(storyboardIds: string[]): Promise<ShotList[]> {
    if (storyboardIds.length === 0) return []
    try {
      const user = await this.ensureAuthenticated()
      const { data, error } = await getSupabaseClient()
        .from('shot_lists')
        .select('*')
        .in('storyboard_id', storyboardIds)
        .eq('user_id', user.id)
        .order('sequence_order', { ascending: true })
        .order('shot_number', { ascending: true })

      if (error) {
        console.error('Error fetching shot lists by storyboard ids:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getShotListsByStoryboardIds:', error)
      throw error
    }
  }

  // Create a new shot list item
  static async createShotList(shotListData: CreateShotListData): Promise<ShotList> {
    try {
      const user = await this.ensureAuthenticated()
      
      // Get project_id if not provided but we have a scene reference
      let projectId = shotListData.project_id
      if (!projectId && shotListData.scene_id) {
        const { data: scene } = await getSupabaseClient()
          .from('scenes')
          .select('timeline_id')
          .eq('id', shotListData.scene_id)
          .single()
        
        if (scene?.timeline_id) {
          const { data: timeline } = await getSupabaseClient()
            .from('timelines')
            .select('project_id')
            .eq('id', scene.timeline_id)
            .single()
          
          if (timeline?.project_id) {
            projectId = timeline.project_id
          }
        }
      }
      
      if (!projectId && shotListData.screenplay_scene_id) {
        const { data: screenplayScene } = await getSupabaseClient()
          .from('screenplay_scenes')
          .select('project_id')
          .eq('id', shotListData.screenplay_scene_id)
          .single()
        
        if (screenplayScene) {
          projectId = screenplayScene.project_id
        }
      }

      // Get next shot number if not provided
      let shotNumber = shotListData.shot_number
      if (!shotNumber) {
        const existingShots = shotListData.scene_id 
          ? await this.getShotListsByScene(shotListData.scene_id)
          : shotListData.screenplay_scene_id
          ? await this.getShotListsByScreenplayScene(shotListData.screenplay_scene_id)
          : shotListData.storyboard_id
          ? await this.getShotListsByStoryboard(shotListData.storyboard_id)
          : []
        
        shotNumber = existingShots.length > 0 
          ? Math.max(...existingShots.map(s => s.shot_number)) + 1
          : 1
      }

      // Get next sequence order if not provided
      let sequenceOrder = shotListData.sequence_order
      if (sequenceOrder === undefined) {
        const existingShots = shotListData.scene_id 
          ? await this.getShotListsByScene(shotListData.scene_id)
          : shotListData.screenplay_scene_id
          ? await this.getShotListsByScreenplayScene(shotListData.screenplay_scene_id)
          : shotListData.storyboard_id
          ? await this.getShotListsByStoryboard(shotListData.storyboard_id)
          : []
        
        sequenceOrder = existingShots.length > 0 
          ? Math.max(...existingShots.map(s => s.sequence_order || 0)) + 1
          : 1
      }

      const { data, error } = await getSupabaseClient()
        .from('shot_lists')
        .insert({
          ...shotListData,
          user_id: user.id,
          project_id: projectId,
          shot_number: shotNumber,
          sequence_order: sequenceOrder,
          status: shotListData.status || 'planned',
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating shot list:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in createShotList:', error)
      throw error
    }
  }

  // Update a shot list item
  static async updateShotList(shotListId: string, updates: UpdateShotListData): Promise<ShotList> {
    try {
      const user = await this.ensureAuthenticated()
      
      const { data, error } = await getSupabaseClient()
        .from('shot_lists')
        .update(updates)
        .eq('id', shotListId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating shot list:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in updateShotList:', error)
      throw error
    }
  }

  // Delete a shot list item
  static async deleteShotList(shotListId: string): Promise<void> {
    try {
      const user = await this.ensureAuthenticated()
      
      const { error } = await getSupabaseClient()
        .from('shot_lists')
        .delete()
        .eq('id', shotListId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting shot list:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteShotList:', error)
      throw error
    }
  }

  // Get shot list by ID
  static async getShotListById(shotListId: string): Promise<ShotList | null> {
    try {
      const user = await this.ensureAuthenticated()
      
      const { data, error } = await getSupabaseClient()
        .from('shot_lists')
        .select('*')
        .eq('id', shotListId)
        .eq('user_id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        console.error('Error fetching shot list:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in getShotListById:', error)
      throw error
    }
  }

  // Bulk create shot lists
  static async bulkCreateShotLists(shotLists: CreateShotListData[]): Promise<ShotList[]> {
    try {
      const user = await this.ensureAuthenticated()
      
      // Get existing shots to determine next shot numbers and sequence orders
      const firstShot = shotLists[0]
      let existingShots: ShotList[] = []
      
      if (firstShot?.scene_id) {
        existingShots = await this.getShotListsByScene(firstShot.scene_id)
      } else if (firstShot?.screenplay_scene_id) {
        existingShots = await this.getShotListsByScreenplayScene(firstShot.screenplay_scene_id)
      } else if (firstShot?.storyboard_id) {
        existingShots = await this.getShotListsByStoryboard(firstShot.storyboard_id)
      }
      
      const maxShotNumber = existingShots.length > 0 
        ? Math.max(...existingShots.map(s => s.shot_number || 0))
        : 0
      const maxSequenceOrder = existingShots.length > 0 
        ? Math.max(...existingShots.map(s => s.sequence_order || 0))
        : 0
      
      // Process each shot list to ensure proper defaults
      const processedShotLists = await Promise.all(
        shotLists.map(async (shotList, index) => {
          // Get project_id if not provided
          let projectId = shotList.project_id
          if (!projectId && shotList.scene_id) {
            const { data: scene } = await getSupabaseClient()
              .from('scenes')
              .select('timeline_id')
              .eq('id', shotList.scene_id)
              .single()
            
            if (scene?.timeline_id) {
              const { data: timeline } = await getSupabaseClient()
                .from('timelines')
                .select('project_id')
                .eq('id', scene.timeline_id)
                .single()
              
              if (timeline?.project_id) {
                projectId = timeline.project_id
              }
            }
          }
          
          if (!projectId && shotList.screenplay_scene_id) {
            const { data: screenplayScene } = await getSupabaseClient()
              .from('screenplay_scenes')
              .select('project_id')
              .eq('id', shotList.screenplay_scene_id)
              .single()
            
            if (screenplayScene) {
              projectId = screenplayScene.project_id
            }
          }

          // Ensure shot_number and sequence_order are set
          const shotNumber = shotList.shot_number !== undefined && shotList.shot_number !== null
            ? Number(shotList.shot_number)
            : maxShotNumber + index + 1
          
          const sequenceOrder = shotList.sequence_order !== undefined && shotList.sequence_order !== null
            ? Number(shotList.sequence_order)
            : maxSequenceOrder + index + 1

          // Validate and normalize enum values to match database constraints
          const validShotTypes = ['wide', 'medium', 'close', 'extreme-close', 'two-shot', 'over-the-shoulder', 'point-of-view', 'establishing', 'insert', 'cutaway']
          const validCameraAngles = ['eye-level', 'high-angle', 'low-angle', 'dutch-angle', 'bird-eye', 'worm-eye']
          const validMovements = ['static', 'panning', 'tilting', 'tracking', 'zooming', 'dolly', 'crane', 'handheld', 'steadicam']
          
          const normalizeShotType = (value: string | undefined): string => {
            if (!value) return 'wide'
            const normalized = value.toLowerCase().trim()
            if (validShotTypes.includes(normalized)) return normalized
            // Map common variations
            if (normalized.includes('establishing')) return 'establishing'
            if (normalized.includes('extreme') || normalized.includes('extreme-close')) return 'extreme-close'
            if (normalized.includes('two') || normalized.includes('two-shot')) return 'two-shot'
            if (normalized.includes('over') || normalized.includes('shoulder') || normalized.includes('ots')) return 'over-the-shoulder'
            if (normalized.includes('point') || normalized.includes('pov')) return 'point-of-view'
            if (normalized.includes('insert')) return 'insert'
            if (normalized.includes('cutaway')) return 'cutaway'
            if (normalized.includes('close')) return 'close'
            if (normalized.includes('medium')) return 'medium'
            return 'wide'
          }
          
          const normalizeCameraAngle = (value: string | undefined): string => {
            if (!value) return 'eye-level'
            const normalized = value.toLowerCase().trim()
            if (validCameraAngles.includes(normalized)) return normalized
            // Map common variations
            if (normalized.includes('bird') || normalized.includes('aerial') || normalized.includes('overhead')) return 'bird-eye'
            if (normalized.includes('worm') || normalized.includes('ground')) return 'worm-eye'
            if (normalized.includes('high') || normalized.includes('above')) return 'high-angle'
            if (normalized.includes('low') || normalized.includes('below')) return 'low-angle'
            if (normalized.includes('dutch') || normalized.includes('tilted')) return 'dutch-angle'
            return 'eye-level'
          }
          
          const normalizeMovement = (value: string | undefined): string => {
            if (!value) return 'static'
            const normalized = value.toLowerCase().trim()
            if (validMovements.includes(normalized)) return normalized
            // Map common variations
            if (normalized.includes('sweep') || normalized.includes('sweeping')) return 'panning'
            if (normalized.includes('pan') || normalized.includes('panning')) return 'panning'
            if (normalized.includes('tilt') || normalized.includes('tilting')) return 'tilting'
            if (normalized.includes('track') || normalized.includes('tracking') || normalized.includes('follow')) return 'tracking'
            if (normalized.includes('zoom') || normalized.includes('zooming')) return 'zooming'
            if (normalized.includes('dolly')) return 'dolly'
            if (normalized.includes('crane')) return 'crane'
            if (normalized.includes('handheld') || normalized.includes('hand-held')) return 'handheld'
            if (normalized.includes('steadicam') || normalized.includes('steady')) return 'steadicam'
            return 'static'
          }

          return {
            ...shotList,
            user_id: user.id,
            project_id: projectId,
            shot_number: shotNumber,
            sequence_order: sequenceOrder,
            status: shotList.status || 'planned',
            shot_type: normalizeShotType(shotList.shot_type),
            camera_angle: normalizeCameraAngle(shotList.camera_angle),
            movement: normalizeMovement(shotList.movement),
          }
        })
      )

      const { data, error } = await getSupabaseClient()
        .from('shot_lists')
        .insert(processedShotLists)
        .select()

      if (error) {
        console.error('Error bulk creating shot lists:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in bulkCreateShotLists:', error)
      throw error
    }
  }

  // Renumber shots in a sequence
  static async renumberShots(
    sceneId?: string,
    screenplaySceneId?: string,
    storyboardId?: string
  ): Promise<void> {
    try {
      const shots = sceneId
        ? await this.getShotListsByScene(sceneId)
        : screenplaySceneId
        ? await this.getShotListsByScreenplayScene(screenplaySceneId)
        : storyboardId
        ? await this.getShotListsByStoryboard(storyboardId)
        : []

      // Sort by sequence_order
      const sortedShots = [...shots].sort((a, b) => 
        (a.sequence_order || 0) - (b.sequence_order || 0)
      )

      // Update shot numbers sequentially
      for (let i = 0; i < sortedShots.length; i++) {
        const newShotNumber = i + 1
        if (sortedShots[i].shot_number !== newShotNumber) {
          await this.updateShotList(sortedShots[i].id, { shot_number: newShotNumber })
        }
      }
    } catch (error) {
      console.error('Error renumbering shots:', error)
      throw error
    }
  }
}

