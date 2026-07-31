import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'
import { sanitizeFilename } from '@/lib/utils'
import { getCreativeImportCategory } from '@/lib/creative-workspace-import'
import { syncCreativeImportToProjectAsset } from '@/lib/creative-workspace-assets'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('id, project_id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const formData = await request.formData()
    const files = formData.getAll('files').filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const formProjectId = formData.get('projectId')
    const projectId =
      (typeof formProjectId === 'string' && formProjectId.trim()) ||
      workspace.project_id ||
      null

    let textContents: Record<string, string> = {}
    const textContentsRaw = formData.get('textContents')
    if (typeof textContentsRaw === 'string' && textContentsRaw.trim()) {
      try {
        textContents = JSON.parse(textContentsRaw) as Record<string, string>
      } catch {
        return NextResponse.json({ error: 'Invalid textContents payload' }, { status: 400 })
      }
    }

    const artifacts = []
    const syncedAssetIds: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const category = getCreativeImportCategory(file)
      const timestamp = Date.now()
      const extension = file.name.includes('.') ? file.name.split('.').pop() : ''
      const safeName = sanitizeFilename(file.name)
      const storageFileName = extension ? `${timestamp}_${safeName}.${extension}` : `${timestamp}_${safeName}`
      const filePath = `${user.id}/workspace-${workspaceId}/${category}/${storageFileName}`

      const { error: uploadError } = await supabase.storage
        .from('cinema_files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: {
            originalName: file.name,
            workspaceId,
            importedAt: new Date().toISOString(),
          },
        })

      if (uploadError) {
        return NextResponse.json(
          { error: `Failed to upload ${file.name}: ${uploadError.message}` },
          { status: 500 },
        )
      }

      const { data: { publicUrl } } = supabase.storage
        .from('cinema_files')
        .getPublicUrl(filePath)

      const extractedText = textContents[String(i)]?.trim() || null
      const artifactType = category === 'image' ? 'image' : 'document'
      const title =
        category === 'image'
          ? file.name.replace(/\.[^/.]+$/, '')
          : file.name

      const { data: artifact, error: artifactError } = await supabase
        .from('creative_artifacts')
        .insert([{
          user_id: user.id,
          workspace_id: workspaceId,
          project_id: projectId,
          artifact_type: artifactType,
          title,
          content: category === 'image' ? publicUrl : extractedText || publicUrl,
          metadata: {
            imported: true,
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            storagePath: filePath,
            url: publicUrl,
            ...(extractedText ? { extractedText } : {}),
          },
        }])
        .select()
        .single()

      if (artifactError) {
        return NextResponse.json({ error: artifactError.message }, { status: 500 })
      }

      let assetId: string | null = null
      if (projectId && artifact) {
        assetId = await syncCreativeImportToProjectAsset({
          supabase,
          userId: user.id,
          projectId,
          workspaceId,
          artifactId: artifact.id,
          fileName: file.name,
          category,
          publicUrl,
          extractedText,
          mimeType: file.type || 'application/octet-stream',
        })
        if (assetId) {
          syncedAssetIds.push(assetId)
          await supabase
            .from('creative_artifacts')
            .update({
              metadata: {
                ...(artifact.metadata || {}),
                asset_id: assetId,
                synced_to_project: true,
              },
            })
            .eq('id', artifact.id)

          artifact.metadata = {
            ...(artifact.metadata || {}),
            asset_id: assetId,
            synced_to_project: true,
          }
        }
      }

      artifacts.push(artifact)
    }

    await supabase
      .from('creative_workspaces')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    return NextResponse.json({ artifacts, syncedAssetIds, projectId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
