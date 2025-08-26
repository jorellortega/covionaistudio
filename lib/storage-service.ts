import { getSupabaseClient } from './supabase'

export interface FileUpload {
  file: File
  projectId: string
  fileType: 'video' | 'image' | 'audio' | 'document' | 'other'
  metadata?: Record<string, any>
}

export interface StoredFile {
  id: string
  name: string
  url: string
  size: number
  mimeType: string
  uploadedAt: string
  metadata?: Record<string, any>
}

export class StorageService {
  private static readonly BUCKET_NAME = 'cinema_files'

  /**
   * Upload a file to the cinema_files bucket
   */
  static async uploadFile(upload: FileUpload): Promise<StoredFile> {
    const { data: { user } } = await getSupabaseClient().auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Generate file path: userId/projectId/fileType/timestamp_filename
    const timestamp = Date.now()
    const safeFileName = upload.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${user.id}/${upload.projectId}/${upload.fileType}/${timestamp}_${safeFileName}`

    console.log('Uploading file to path:', filePath)
    console.log('User ID:', user.id)
    console.log('Project ID:', upload.projectId)

    const { data, error } = await getSupabaseClient().storage
      .from(this.BUCKET_NAME)
      .upload(filePath, upload.file, {
        cacheControl: '3600',
        upsert: false,
        metadata: {
          ...upload.metadata,
          originalName: upload.file.name,
          uploadedBy: user.id,
          projectId: upload.projectId,
          fileType: upload.fileType
        }
      })

    if (error) {
      console.error('File upload error:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw new Error(`Failed to upload file: ${error.message}`)
    }

    // Get the public URL
    const { data: urlData } = getSupabaseClient().storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(filePath)

    const storedFile: StoredFile = {
      id: data.path,
      name: upload.file.name,
      url: urlData.publicUrl,
      size: upload.file.size,
      mimeType: upload.file.type,
      uploadedAt: new Date().toISOString(),
      metadata: upload.metadata
    }

    console.log('File uploaded successfully:', storedFile)
    return storedFile
  }

  /**
   * Get all files for a specific project
   */
  static async getProjectFiles(projectId: string): Promise<StoredFile[]> {
    const { data: { user } } = await getSupabaseClient().auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await getSupabaseClient().storage
      .from(this.BUCKET_NAME)
      .list(`${user.id}/${projectId}`, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error('Error listing project files:', error)
      throw new Error(`Failed to list files: ${error.message}`)
    }

    // Convert storage objects to StoredFile format
    const files: StoredFile[] = data
      .filter(item => !item.name.startsWith('.')) // Filter out hidden files
      .map(item => {
        const { data: urlData } = getSupabaseClient().storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(`${user.id}/${projectId}/${item.name}`)

        return {
          id: item.id || item.name,
          name: item.name,
          url: urlData.publicUrl,
          size: item.metadata?.size || 0,
          mimeType: item.metadata?.mimetype || 'application/octet-stream',
          uploadedAt: item.created_at || new Date().toISOString(),
          metadata: item.metadata
        }
      })

    return files
  }

  /**
   * Get files by type for a project
   */
  static async getProjectFilesByType(projectId: string, fileType: string): Promise<StoredFile[]> {
    const { data: { user } } = await getSupabaseClient().auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await getSupabaseClient().storage
      .from(this.BUCKET_NAME)
      .list(`${user.id}/${projectId}/${fileType}`, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error('Error listing project files by type:', error)
      throw new Error(`Failed to list files: ${error.message}`)
    }

    // Convert storage objects to StoredFile format
    const files: StoredFile[] = data
      .filter(item => !item.name.startsWith('.'))
      .map(item => {
        const { data: urlData } = getSupabaseClient().storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(`${user.id}/${projectId}/${fileType}/${item.name}`)

        return {
          id: item.id || item.name,
          name: item.name,
          url: urlData.publicUrl,
          size: item.metadata?.size || 0,
          mimeType: item.metadata?.mimetype || 'application/octet-stream',
          uploadedAt: item.created_at || new Date().toISOString(),
          metadata: item.metadata
        }
      })

    return files
  }

  /**
   * Delete a file
   */
  static async deleteFile(filePath: string): Promise<void> {
    const { data: { user } } = await getSupabaseClient().auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify the file belongs to the user
    if (!filePath.startsWith(user.id)) {
      throw new Error('Access denied: File does not belong to user')
    }

    const { error } = await getSupabaseClient().storage
      .from(this.BUCKET_NAME)
      .remove([filePath])

    if (error) {
      console.error('Error deleting file:', error)
      throw new Error(`Failed to delete file: ${error.message}`)
    }

    console.log('File deleted successfully:', filePath)
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(filePath: string): Promise<any> {
    const { data: { user } } = await getSupabaseClient().auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify the file belongs to the user
    if (!filePath.startsWith(user.id)) {
      throw new Error('Access denied: File does not belong to user')
    }

    const { data, error } = await getSupabaseClient().storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(filePath)

    if (error) {
      console.error('Error getting file metadata:', error)
      throw new Error(`Failed to get file metadata: ${error.message}`)
    }

    return data
  }

  /**
   * Download a file
   */
  static async downloadFile(filePath: string): Promise<Blob> {
    const { data: { user } } = await getSupabaseClient().auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify the file belongs to the user
    if (!filePath.startsWith(user.id)) {
      throw new Error('Access denied: File does not belong to user')
    }

    const { data, error } = await getSupabaseClient().storage
      .from(this.BUCKET_NAME)
      .download(filePath)

    if (error) {
      console.error('Error downloading file:', error)
      throw new Error(`Failed to download file: ${error.message}`)
    }

    return data
  }

  /**
   * Get storage usage statistics for a user
   */
  static async getUserStorageStats(): Promise<{
    totalFiles: number
    totalSize: number
    projects: Record<string, { files: number, size: number }>
  }> {
    const { data: { user } } = await getSupabaseClient().auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await getSupabaseClient().storage
      .from(this.BUCKET_NAME)
      .list(user.id, {
        limit: 1000,
        offset: 0
      })

    if (error) {
      console.error('Error getting storage stats:', error)
      throw new Error(`Failed to get storage stats: ${error.message}`)
    }

    let totalFiles = 0
    let totalSize = 0
    const projects: Record<string, { files: number, size: number }> = {}

    // Process each project folder
    for (const projectFolder of data) {
      if (projectFolder.name && !projectFolder.name.startsWith('.')) {
        const projectId = projectFolder.name
        
        try {
          const { data: projectFiles } = await getSupabaseClient().storage
            .from(this.BUCKET_NAME)
            .list(`${user.id}/${projectId}`, {
              limit: 1000,
              offset: 0
            })

          if (projectFiles) {
            let projectFileCount = 0
            let projectSize = 0

            for (const file of projectFiles) {
              if (file.name && !file.name.startsWith('.')) {
                projectFileCount++
                projectSize += file.metadata?.size || 0
              }
            }

            projects[projectId] = {
              files: projectFileCount,
              size: projectSize
            }

            totalFiles += projectFileCount
            totalSize += projectSize
          }
        } catch (projectError) {
          console.warn(`Error processing project ${projectId}:`, projectError)
        }
      }
    }

    return {
      totalFiles,
      totalSize,
      projects
    }
  }
}
