import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { assetId, userId } = await request.json()
    
    if (!assetId || !userId) {
      return NextResponse.json({ error: 'Asset ID and User ID are required' }, { status: 400 })
    }

    console.log('🗑️ DELETE-ASSET - Starting deletion for:', { assetId, userId })

    // Get the asset to delete
    const { data: asset, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !asset) {
      console.error('🗑️ DELETE-ASSET - Asset not found or access denied:', { assetId, userId, fetchError })
      return NextResponse.json({ error: 'Asset not found or access denied' }, { status: 404 })
    }

    console.log('🗑️ DELETE-ASSET - Found asset:', { 
      id: asset.id, 
      title: asset.title, 
      content_type: asset.content_type,
      content_url: asset.content_url 
    })

    // Delete the file from storage bucket if it exists
    if (asset.content_url) {
      try {
        // Extract the file path from the URL
        let filePath = ''
        
        if (asset.content_url.includes('cinema_files')) {
          // If it's a Supabase storage URL, extract the path after the bucket name
          const urlParts = asset.content_url.split('cinema_files/')
          if (urlParts.length > 1) {
            filePath = urlParts[1]
          }
        } else {
          // Fallback: try to extract from the end of the URL
          const urlParts = asset.content_url.split('/')
          filePath = urlParts.slice(-2).join('/') // Get the last two parts (folder/filename)
        }
        
        if (filePath) {
          console.log('🗑️ DELETE-ASSET - Attempting to delete from storage:', { bucket: 'cinema_files', filePath })
          
          const { error: storageError } = await supabase.storage
            .from('cinema_files')
            .remove([filePath])

          if (storageError) {
            console.error('🗑️ DELETE-ASSET - Error deleting from storage:', storageError)
            // Continue with database deletion even if storage deletion fails
          } else {
            console.log('🗑️ DELETE-ASSET - Successfully deleted from storage:', filePath)
          }
        } else {
          console.warn('🗑️ DELETE-ASSET - Could not extract file path from URL:', asset.content_url)
        }
      } catch (storageError) {
        console.error('🗑️ DELETE-ASSET - Error in storage deletion:', storageError)
        // Continue with database deletion
      }
    } else {
      console.log('🗑️ DELETE-ASSET - No content_url to delete from storage')
    }

    // Handle foreign key constraints by updating child assets
    const { data: children, error: childrenError } = await supabase
      .from('assets')
      .select('id, title')
      .eq('parent_asset_id', assetId)
      .eq('user_id', userId)

    if (childrenError) {
      console.error('🗑️ DELETE-ASSET - Error finding children:', childrenError)
    } else if (children && children.length > 0) {
      console.log('🗑️ DELETE-ASSET - Found children to update:', children.length)
      
      // Update children to remove parent reference
      for (const child of children) {
        console.log('🗑️ DELETE-ASSET - Updating child asset:', child.id, child.title)
        const { error: updateError } = await supabase
          .from('assets')
          .update({ parent_asset_id: null })
          .eq('id', child.id)
          .eq('user_id', userId)
        
        if (updateError) {
          console.error('🗑️ DELETE-ASSET - Error updating child:', child.id, updateError)
        } else {
          console.log('🗑️ DELETE-ASSET - Updated child:', child.id, 'removed parent reference')
        }
      }
    } else {
      console.log('🗑️ DELETE-ASSET - No children found for this asset')
    }

    // Delete the asset record from the database
    console.log('🗑️ DELETE-ASSET - Deleting asset from database:', assetId)
    console.log('🗑️ DELETE-ASSET - Asset details before deletion:', {
      id: asset.id,
      title: asset.title,
      content_type: asset.content_type,
      parent_asset_id: asset.parent_asset_id,
      has_children: children && children.length > 0
    })
    
    const { error: deleteError } = await supabase
      .from('assets')
      .delete()
      .eq('id', assetId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('🗑️ DELETE-ASSET - Failed to delete asset from database:', deleteError)
      console.error('🗑️ DELETE-ASSET - Error details:', {
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint
      })
      return NextResponse.json({ error: `Failed to delete asset: ${deleteError.message}` }, { status: 500 })
    }

    console.log('🗑️ DELETE-ASSET - Asset deleted successfully:', assetId)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Asset deleted successfully',
      deletedAsset: {
        id: assetId,
        title: asset.title,
        content_type: asset.content_type
      }
    })

  } catch (error) {
    console.error('🗑️ DELETE-ASSET - Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
