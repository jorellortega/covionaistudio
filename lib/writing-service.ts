import { AssetService, type Asset, type CreateAssetData } from './asset-service'
import { getSupabaseClient } from './supabase'

export type WritingContentType = 'lyrics' | 'poetry' | 'prose' | 'script'

export interface WritingContent extends Asset {
  content_type: WritingContentType
  metadata: {
    tags?: string[]
    description?: string
    content_category?: WritingContentType
    created_in_writers_page?: boolean
    [key: string]: any
  }
}

export interface CreateWritingContentData extends Omit<CreateAssetData, 'content_type'> {
  content_type: WritingContentType
  tags?: string[]
  description?: string
  content_category?: WritingContentType
}

export interface WritingContentStats {
  content_type: WritingContentType
  count: number
  total_versions: number
  latest_updated: string | null
}

export class WritingService {
  /**
   * Create new writing content
   */
  static async createWritingContent(data: CreateWritingContentData): Promise<WritingContent> {
    // For standalone writing content, we can use a special project ID or null
    const projectId = data.project_id || 'writers-workspace'
    
    const assetData: CreateAssetData = {
      ...data,
      project_id: projectId,
      metadata: {
        ...data.metadata,
        tags: data.tags || [],
        description: data.description || '',
        content_category: data.content_category || data.content_type,
        created_in_writers_page: true,
        created_at: new Date().toISOString()
      }
    }

    return await AssetService.createAsset(assetData) as WritingContent
  }

  /**
   * Get all writing content for a user
   */
  static async getUserWritingContent(userId: string, contentType?: WritingContentType): Promise<WritingContent[]> {
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .select('*')
      .eq('user_id', userId)
      .in('content_type', ['lyrics', 'poetry', 'prose', 'script'])
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch writing content: ${error.message}`)
    }

    let content = data as WritingContent[]

    // Filter by content type if specified
    if (contentType) {
      content = content.filter(item => item.content_type === contentType)
    }

    return content
  }

  /**
   * Get writing content by ID
   */
  static async getWritingContentById(contentId: string): Promise<WritingContent | null> {
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .select('*')
      .eq('id', contentId)
      .in('content_type', ['lyrics', 'poetry', 'prose', 'script'])
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Content not found
      }
      throw new Error(`Failed to fetch writing content: ${error.message}`)
    }

    return data as WritingContent
  }

  /**
   * Get writing content statistics for a user
   */
  static async getUserWritingStats(userId: string): Promise<WritingContentStats[]> {
    const { data, error } = await getSupabaseClient()
      .rpc('get_user_writing_stats', { user_uuid: userId })

    if (error) {
      throw new Error(`Failed to fetch writing stats: ${error.message}`)
    }

    return data.map((stat: any) => ({
      content_type: stat.content_type as WritingContentType,
      count: parseInt(stat.count),
      total_versions: parseInt(stat.total_versions),
      latest_updated: null // This would need to be calculated separately if needed
    }))
  }

  /**
   * Search writing content by text
   */
  static async searchWritingContent(
    userId: string, 
    query: string, 
    contentType?: WritingContentType
  ): Promise<WritingContent[]> {
    let queryBuilder = getSupabaseClient()
      .from('assets')
      .select('*')
      .eq('user_id', userId)
      .in('content_type', ['lyrics', 'poetry', 'prose', 'script'])
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)

    if (contentType) {
      queryBuilder = queryBuilder.eq('content_type', contentType)
    }

    const { data, error } = await queryBuilder.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to search writing content: ${error.message}`)
    }

    return data as WritingContent[]
  }

  /**
   * Get writing content by tags
   */
  static async getWritingContentByTags(
    userId: string, 
    tags: string[], 
    contentType?: WritingContentType
  ): Promise<WritingContent[]> {
    let queryBuilder = getSupabaseClient()
      .from('assets')
      .select('*')
      .eq('user_id', userId)
      .in('content_type', ['lyrics', 'poetry', 'prose', 'script'])

    if (contentType) {
      queryBuilder = queryBuilder.eq('content_type', contentType)
    }

    // Search for content containing any of the specified tags
    const tagConditions = tags.map(tag => `metadata->>'tags' ilike '%${tag}%'`).join(',')
    queryBuilder = queryBuilder.or(tagConditions)

    const { data, error } = await queryBuilder.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch writing content by tags: ${error.message}`)
    }

    return data as WritingContent[]
  }

  /**
   * Update writing content metadata
   */
  static async updateWritingContentMetadata(
    contentId: string, 
    userId: string, 
    updates: Partial<{
      tags: string[]
      description: string
      content_category: WritingContentType
      [key: string]: any
    }>
  ): Promise<WritingContent> {
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .update({
        metadata: updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', contentId)
      .eq('user_id', userId)
      .in('content_type', ['lyrics', 'poetry', 'prose', 'script'])
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update writing content metadata: ${error.message}`)
    }

    return data as WritingContent
  }

  /**
   * Get recent writing content
   */
  static async getRecentWritingContent(
    userId: string, 
    limit: number = 10, 
    contentType?: WritingContentType
  ): Promise<WritingContent[]> {
    let queryBuilder = getSupabaseClient()
      .from('assets')
      .select('*')
      .eq('user_id', userId)
      .in('content_type', ['lyrics', 'poetry', 'prose', 'script'])
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (contentType) {
      queryBuilder = queryBuilder.eq('content_type', contentType)
    }

    const { data, error } = await queryBuilder

    if (error) {
      throw new Error(`Failed to fetch recent writing content: ${error.message}`)
    }

    return data as WritingContent[]
  }

  /**
   * Get writing content by project (if associated with a project)
   */
  static async getWritingContentByProject(
    userId: string, 
    projectId: string, 
    contentType?: WritingContentType
  ): Promise<WritingContent[]> {
    let queryBuilder = getSupabaseClient()
      .from('assets')
      .select('*')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .in('content_type', ['lyrics', 'poetry', 'prose', 'script'])
      .order('created_at', { ascending: false })

    if (contentType) {
      queryBuilder = queryBuilder.eq('content_type', contentType)
    }

    const { data, error } = await queryBuilder

    if (error) {
      throw new Error(`Failed to fetch project writing content: ${error.message}`)
    }

    return data as WritingContent[]
  }

  /**
   * Delete writing content (soft delete by marking as archived)
   */
  static async archiveWritingContent(contentId: string, userId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('assets')
      .update({
        metadata: { archived: true, archived_at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      })
      .eq('id', contentId)
      .eq('user_id', userId)
      .in('content_type', ['lyrics', 'poetry', 'prose', 'script'])

    if (error) {
      throw new Error(`Failed to archive writing content: ${error.message}`)
    }
  }

  /**
   * Export writing content to different formats
   */
  static async exportWritingContent(
    contentId: string, 
    userId: string, 
    format: 'txt' | 'md' | 'json' = 'txt'
  ): Promise<string> {
    const content = await this.getWritingContentById(contentId)
    
    if (!content || content.user_id !== userId) {
      throw new Error('Content not found or access denied')
    }

    switch (format) {
      case 'txt':
        return `${content.title}\n\n${content.content || ''}\n\n---\nCreated: ${new Date(content.created_at).toLocaleDateString()}\nType: ${content.content_type}`
      
      case 'md':
        return `# ${content.title}\n\n${content.content || ''}\n\n---\n**Created:** ${new Date(content.created_at).toLocaleDateString()}\n**Type:** ${content.content_type}`
      
      case 'json':
        return JSON.stringify({
          title: content.title,
          content: content.content,
          content_type: content.content_type,
          version: content.version,
          version_name: content.version_name,
          tags: content.metadata?.tags || [],
          description: content.metadata?.description || '',
          created_at: content.created_at,
          updated_at: content.updated_at
        }, null, 2)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }
}
