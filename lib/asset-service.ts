import { getSupabaseClient } from './supabase'

export interface Asset {
  id: string
  user_id: string
  project_id?: string | null // Optional for standalone content
  scene_id?: string | null
  treatment_id?: string | null // Optional reference to treatment
  character_id?: string | null // Optional reference to character
  title: string
  content_type: 'script' | 'image' | 'video' | 'audio' | 'lyrics' | 'poetry' | 'prose'
  content?: string
  content_url?: string
  version: number
  version_name?: string // Add version name field
  is_latest_version: boolean
  is_default_cover?: boolean // Whether this is the default cover for the project
  parent_asset_id?: string | null
  prompt?: string
  model?: string
  generation_settings?: Record<string, any>
  metadata?: Record<string, any>
  locked_sections?: Array<{
    id: string;
    text: string;
    start: number;
    end: number;
  }> | null
  created_at: string
  updated_at: string
}

export interface CreateAssetData {
  project_id?: string | null // Optional for standalone content
  scene_id?: string | null
  treatment_id?: string | null // Optional reference to treatment
  character_id?: string | null // Optional reference to character
  title: string
  content_type: 'script' | 'image' | 'video' | 'audio' | 'lyrics' | 'poetry' | 'prose'
  content?: string
  content_url?: string
  prompt?: string
  model?: string
  generation_settings?: Record<string, any>
  metadata?: Record<string, any>
  version_name?: string // Add version name field
  locked_sections?: Array<{
    id: string;
    text: string;
    start: number;
    end: number;
  }> | null
}

export class AssetService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async createAsset(assetData: CreateAssetData): Promise<Asset> {
    const user = await this.ensureAuthenticated()
    
    // For standalone content (like writing), we might not have a strict project requirement
    // Check if this is standalone content that should bypass strict project validation
    const isStandaloneContent = assetData.content_type === 'lyrics' || 
                               assetData.content_type === 'poetry' || 
                               assetData.content_type === 'prose' ||
                               assetData.metadata?.created_in_writers_page === true
    
    // Validate that the referenced project exists (unless it's standalone content)
    if (assetData.project_id && !isStandaloneContent) {
      const { data: projectExists, error: projectError } = await getSupabaseClient()
        .from('projects')
        .select('id')
        .eq('id', assetData.project_id)
        .eq('user_id', user.id)
        .single()
      
      if (projectError || !projectExists) {
        console.error('Project validation failed:', { project_id: assetData.project_id, error: projectError })
        throw new Error(`Project with ID ${assetData.project_id} not found or access denied`)
      }
    }
    
    // Validate that the referenced scene exists (if provided and not bypassed)
    if (assetData.scene_id && assetData.scene_id !== null && typeof assetData.scene_id === 'string' && !assetData.metadata?.bypassSceneValidation) {
      const { data: sceneExists, error: sceneError } = await getSupabaseClient()
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
    
    // Validate that the referenced character exists (if provided and not bypassed)
    if (assetData.character_id && assetData.character_id !== null && typeof assetData.character_id === 'string' && !assetData.metadata?.bypassCharacterValidation) {
      const { data: characterExists, error: characterError } = await getSupabaseClient()
        .from('characters')
        .select('id')
        .eq('id', assetData.character_id)
        .eq('user_id', user.id)
        .single()
      
      if (characterError || !characterExists) {
        console.error('Character validation failed:', { character_id: assetData.character_id, error: characterError })
        throw new Error(`Character with ID ${assetData.character_id} not found or access denied`)
      }
    }
    
    // Check if there's an existing asset for this scene to determine version
    let version = assetData.version || 1  // Use provided version or default to 1
    let parentAssetId: string | undefined = undefined
    
    if (assetData.scene_id && typeof assetData.scene_id === 'string') {
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
          await getSupabaseClient()
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
      scene_id: (assetData.scene_id && typeof assetData.scene_id === 'string') ? assetData.scene_id : null,
      treatment_id: assetData.treatment_id || null,
      character_id: (assetData.character_id && typeof assetData.character_id === 'string') ? assetData.character_id : null,
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
      locked_sections: assetData.locked_sections || null,
      is_default_cover: (assetData.metadata?.is_default_cover || false) && assetData.content_type === 'image' && (assetData.project_id || assetData.treatment_id) ? true : false,
    }

    console.log('Attempting to insert asset with data:', JSON.stringify(insertData, null, 2))
    console.log('User ID:', user.id)
    console.log('Project ID:', assetData.project_id)
    console.log('Scene ID:', assetData.scene_id)
    console.log('Content type:', assetData.content_type)
    console.log('Scene ID type:', typeof assetData.scene_id)
    console.log('Scene ID value:', assetData.scene_id)

    // Validate required fields (project_id is optional for standalone content)
    if (!insertData.project_id && !isStandaloneContent) {
      throw new Error('Project ID is required for non-standalone content')
    }
    if (!insertData.title) {
      throw new Error('Title is required')
    }
    if (!insertData.content_type) {
      throw new Error('Content type is required')
    }

    const { data, error } = await getSupabaseClient()
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
      // If character_id column doesn't exist (e.g., migration not run)
      if (error.code === '42703' || error.message?.includes('column "character_id"')) {
        console.error('character_id column may not exist. Please run migration 039_add_character_id_to_assets.sql')
        throw new Error('Database migration required: Please run migration 039_add_character_id_to_assets.sql to enable character assets. ' + error.message)
      }
      throw error
    }

    return data as Asset
  }

  static async getAssetsForProject(projectId: string): Promise<Asset[]> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
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
    const { data: allUserAssets, error: allUserError } = await getSupabaseClient()
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
    const { data, error } = await getSupabaseClient()
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

  static async getAssetsForCharacter(characterId: string): Promise<Asset[]> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .select('*')
      .eq('character_id', characterId)
      .eq('user_id', user.id)
      .eq('is_latest_version', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching character assets:', error)
      // If column doesn't exist (e.g., migration not run), return empty array
      if (error.code === '42703' || error.message?.includes('column "character_id"')) {
        console.warn('character_id column may not exist. Please run migration 039_add_character_id_to_assets.sql')
        return []
      }
      throw error
    }

    return (data || []) as Asset[]
  }

  static async getAssetById(assetId: string): Promise<Asset | null> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
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
    
    const { data, error } = await getSupabaseClient()
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
    
    console.log('AssetService - Starting smart delete for asset:', assetId)
    
    try {
      // Step 1: Get the asset and check if it has children
      const { data: asset, error: assetError } = await getSupabaseClient()
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .eq('user_id', user.id)
        .single()
      
      if (assetError) {
        throw new Error(`Asset not found: ${assetError.message}`)
      }
      
      console.log('AssetService - Asset to delete:', { id: asset.id, title: asset.title, content_type: asset.content_type })
      
      // Step 2: Find all assets that reference this asset as parent
      const { data: children, error: childrenError } = await getSupabaseClient()
        .from('assets')
        .select('id, title, parent_asset_id')
        .eq('parent_asset_id', assetId)
        .eq('user_id', user.id)
      
      if (childrenError) {
        console.error('AssetService - Error finding children:', childrenError)
        throw childrenError
      }
      
      console.log('AssetService - Found children:', children?.length || 0)
      
      if (children && children.length > 0) {
        // Option 1: Update children to remove parent reference (safer approach)
        console.log('AssetService - Updating children to remove parent reference...')
        
        for (const child of children) {
          const { error: updateError } = await getSupabaseClient()
            .from('assets')
            .update({ parent_asset_id: null })
            .eq('id', child.id)
            .eq('user_id', user.id)
          
          if (updateError) {
            console.error('AssetService - Error updating child:', child.id, updateError)
            throw updateError
          }
          
          console.log('AssetService - Updated child:', child.id, 'removed parent reference')
        }
        
        console.log('AssetService - All children updated successfully')
      }
      
      // Step 3: Delete the asset from storage if it has a content_url
      if (asset.content_url && asset.content_url.includes('cinema_files')) {
        try {
          // Extract the file path from the URL
          const urlParts = asset.content_url.split('cinema_files/')
          if (urlParts.length > 1) {
            const filePath = urlParts[1]
            console.log('AssetService - Deleting from storage:', filePath)
            
            const { error: storageError } = await getSupabaseClient().storage
              .from('cinema_files')
              .remove([filePath])
            
            if (storageError) {
              console.warn('AssetService - Warning: Could not delete from storage:', storageError)
              // Continue with database deletion even if storage deletion fails
            } else {
              console.log('AssetService - Successfully deleted from storage:', filePath)
            }
          }
        } catch (storageError) {
          console.warn('AssetService - Warning: Storage deletion failed:', storageError)
          // Continue with database deletion
        }
      }
      
      // Step 4: Delete the asset record from the database
      console.log('AssetService - Deleting asset from database:', assetId)
      
      const { error: deleteError } = await getSupabaseClient()
        .from('assets')
        .delete()
        .eq('id', assetId)
        .eq('user_id', user.id)
      
      if (deleteError) {
        console.error('AssetService - Failed to delete asset from database:', deleteError)
        throw deleteError
      }
      
      console.log('AssetService - Asset deleted successfully:', assetId)
      
    } catch (error) {
      console.error('AssetService - Smart delete failed:', error)
      throw error
    }
  }

  // Get cover image assets for a project (all image assets that could be covers)
  static async getCoverImageAssets(projectId: string): Promise<Asset[]> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('content_type', 'image')
      .eq('is_latest_version', true)
      .is('scene_id', null) // Only project-level images (not scene-specific)
      .order('is_default_cover', { ascending: false }) // Default cover first
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching cover image assets:', error)
      throw error
    }

    return data as Asset[]
  }

  // Get cover image assets for a treatment (by treatment_id)
  static async getCoverImageAssetsForTreatment(treatmentId: string): Promise<Asset[]> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .select('*')
      .eq('treatment_id', treatmentId)
      .eq('user_id', user.id)
      .eq('content_type', 'image')
      .eq('is_latest_version', true)
      .is('scene_id', null) // Only treatment-level images (not scene-specific)
      .order('is_default_cover', { ascending: false }) // Default cover first
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching cover image assets for treatment:', error)
      throw error
    }

    return data as Asset[]
  }

  // Get the default cover asset for a project
  static async getDefaultCoverAsset(projectId: string): Promise<Asset | null> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('content_type', 'image')
      .eq('is_default_cover', true)
      .eq('is_latest_version', true)
      .is('scene_id', null)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // No default cover found
      }
      console.error('Error fetching default cover asset:', error)
      throw error
    }

    return data as Asset
  }

  // Set an asset as the default cover for a project or treatment
  static async setDefaultCover(assetId: string): Promise<Asset> {
    const user = await this.ensureAuthenticated()
    
    // First, get the asset to check it exists and get project_id/treatment_id
    const asset = await this.getAssetById(assetId)
    if (!asset) {
      throw new Error('Asset not found')
    }
    
    if (asset.content_type !== 'image') {
      throw new Error('Only image assets can be set as default cover')
    }
    
    if (!asset.project_id && !asset.treatment_id) {
      throw new Error('Asset must have a project_id or treatment_id to be set as default cover')
    }
    
    // Update this asset to be the default cover
    // The database trigger will automatically unset other default covers for the same project
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .update({ is_default_cover: true })
      .eq('id', assetId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error setting default cover:', error)
      throw error
    }

    return data as Asset
  }

  // Unset the default cover for an asset
  static async unsetDefaultCover(assetId: string): Promise<Asset> {
    const user = await this.ensureAuthenticated()
    
    // First, get the asset to verify it exists
    const asset = await this.getAssetById(assetId)
    if (!asset) {
      throw new Error('Asset not found')
    }
    
    // Update this asset to remove default cover status
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .update({ is_default_cover: false })
      .eq('id', assetId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error unsetting default cover:', error)
      throw error
    }

    return data as Asset
  }
}
