import { supabase } from './supabase'

export interface Asset {
  id: string
  user_id: string
  project_id: string
  scene_id?: string | null
  title: string
  content_type: 'script' | 'image' | 'video' | 'audio'
  content?: string
  content_url?: string
  version: number
  version_name?: string // Add version name field
  is_latest_version: boolean
  parent_asset_id?: string | null
  prompt?: string
  model?: string
  generation_settings?: Record<string, any>
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface CreateAssetData {
  project_id: string
  scene_id?: string | null
  title: string
  content_type: 'script' | 'image' | 'video' | 'audio'
  content?: string
  content_url?: string
  prompt?: string
  model?: string
  generation_settings?: Record<string, any>
  metadata?: Record<string, any>
  version_name?: string // Add version name field
}

export class AssetService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async createAsset(assetData: CreateAssetData): Promise<Asset> {
    const user = await this.ensureAuthenticated()
    
    // Validate that the referenced project exists
    const { data: projectExists, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', assetData.project_id)
      .eq('user_id', user.id)
      .single()
    
    if (projectError || !projectExists) {
      console.error('Project validation failed:', { project_id: assetData.project_id, error: projectError })
      throw new Error(`Project with ID ${assetData.project_id} not found or access denied`)
    }
    
    // Validate that the referenced scene exists (if provided)
    if (assetData.scene_id && assetData.scene_id !== null) {
      const { data: sceneExists, error: sceneError } = await supabase
        .from('scenes')
        .select('id')
        .eq('id', assetData.scene_id)
        .eq('user_id', user.id)
        .single()
      
      if (sceneError || !sceneExists) {
        console.error('Scene validation failed:', { scene_id: assetData.scene_id, error: sceneError })
        throw new Error(`Scene with ID ${assetData.scene_id} not found or access denied`)
      }
    }
    
    // Check if there's an existing asset for this scene to determine version
    let version = assetData.version || 1  // Use provided version or default to 1
    let parentAssetId: string | undefined = undefined
    
    if (assetData.scene_id) {
      const existingAssets = await this.getAssetsForScene(assetData.scene_id)
      if (existingAssets.length > 0) {
        // Find the latest version
        const latestAsset = existingAssets.find(asset => asset.is_latest_version)
        if (latestAsset) {
          // Only auto-increment if no version was provided
          if (!assetData.version) {
            version = latestAsset.version + 1
          }
          parentAssetId = latestAsset.id
          
          // Mark previous version as not latest
          await supabase
            .from('assets')
            .update({ is_latest_version: false })
            .eq('id', latestAsset.id)
        }
      }
    }

    const newVersion = version

    const insertData = {
      user_id: user.id,
      project_id: assetData.project_id,
      scene_id: assetData.scene_id,
      title: assetData.title,
      content_type: assetData.content_type,
      content: assetData.content,
      content_url: assetData.content_url,
      version: newVersion,
      version_name: assetData.version_name || `Version ${newVersion}`, // Use custom name or default
      is_latest_version: true,
      parent_asset_id: parentAssetId,
      prompt: assetData.prompt,
      model: assetData.model,
      generation_settings: assetData.generation_settings || {},
      metadata: assetData.metadata || {},
    }

    console.log('Attempting to insert asset with data:', JSON.stringify(insertData, null, 2))
    console.log('User ID:', user.id)
    console.log('Project ID:', assetData.project_id)
    console.log('Scene ID:', assetData.scene_id)
    console.log('Content type:', assetData.content_type)
    console.log('Scene ID type:', typeof assetData.scene_id)
    console.log('Scene ID value:', assetData.scene_id)

    // Validate required fields
    if (!insertData.project_id) {
      throw new Error('Project ID is required')
    }
    if (!insertData.title) {
      throw new Error('Title is required')
    }
    if (!insertData.content_type) {
      throw new Error('Content type is required')
    }

    const { data, error } = await supabase
      .from('assets')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Supabase error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      console.error('Full error object:', error)
      throw error
    }

    return data as Asset
  }

  static async getAssetsForProject(projectId: string): Promise<Asset[]> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('is_latest_version', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching project assets:', error)
      throw error
    }

    return data as Asset[]
  }

  static async getAssetsForScene(sceneId: string): Promise<Asset[]> {
    const user = await this.ensureAuthenticated()
    
    console.log('AssetService.getAssetsForScene called with:', { sceneId, userId: user.id })
    
    // First, let's check what's in the assets table for this user
    console.log('AssetService - Checking all assets for user first...')
    const { data: allUserAssets, error: allUserError } = await supabase
      .from('assets')
      .select('*')
      .eq('user_id', user.id)
    
    if (allUserError) {
      console.error('AssetService - Error fetching all user assets:', allUserError)
    } else {
      console.log('AssetService - All user assets:', {
        count: allUserAssets?.length || 0,
        assets: allUserAssets?.map(a => ({ id: a.id, title: a.title, scene_id: a.scene_id, project_id: a.project_id }))
      })
    }
    
    // Now check specifically for this scene
    console.log('AssetService - Fetching assets for specific scene...')
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('scene_id', sceneId)
      .eq('user_id', user.id)
      .order('version', { ascending: false })

    if (error) {
      console.error('AssetService - Error fetching scene assets:', error)
      throw error
    }

    console.log('AssetService.getAssetsForScene result:', { 
      data, 
      count: data?.length || 0,
      sceneId,
      userId: user.id,
      query: `scene_id = '${sceneId}' AND user_id = '${user.id}'`
    })
    
    return data as Asset[]
  }

  static async getAssetById(assetId: string): Promise<Asset | null> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // No asset found
      }
      console.error('Error fetching asset:', error)
      throw error
    }

    return data as Asset
  }

  static async updateAsset(assetId: string, updates: Partial<CreateAssetData>): Promise<Asset> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await supabase
      .from('assets')
      .update(updates)
      .eq('id', assetId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating asset:', error)
      throw error
    }

    return data as Asset
  }

  static async deleteAsset(assetId: string): Promise<void> {
    const user = await this.ensureAuthenticated()
    
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', assetId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting asset:', error)
      throw error
    }
  }
}
