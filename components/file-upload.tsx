"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, 
  File, 
  Video, 
  Image, 
  Music, 
  FileText, 
  X, 
  Download,
  Play,
  Eye
} from 'lucide-react'
import { StorageService, type StoredFile } from '@/lib/storage-service'
import { useToast } from '@/hooks/use-toast'

interface FileUploadProps {
  projectId: string
  onFileUploaded?: (file: StoredFile) => void
  onFileDeleted?: (fileId: string) => void
  className?: string
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('video/')) return <Video className="h-4 w-4" />
  if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />
  if (mimeType.startsWith('audio/')) return <Music className="h-4 w-4" />
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return <FileText className="h-4 w-4" />
  return <File className="h-4 w-4" />
}

const getFileType = (mimeType: string): 'video' | 'image' | 'audio' | 'document' | 'other' => {
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return 'document'
  return 'other'
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function FileUpload({ 
  projectId, 
  onFileUploaded, 
  onFileDeleted,
  className = "" 
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<StoredFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStorageAvailable, setIsStorageAvailable] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Check if StorageService is available
  useEffect(() => {
    setIsStorageAvailable(typeof StorageService !== 'undefined')
  }, [])

  const loadProjectFiles = useCallback(async () => {
    if (!projectId || !isStorageAvailable) return
    
    try {
      setIsLoading(true)
      const files = await StorageService.getProjectFiles(projectId)
      setUploadedFiles(files)
    } catch (error) {
      console.error('Error loading project files:', error)
      // Don't show toast for initial load errors to avoid spam
      setUploadedFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId, isStorageAvailable])

  // Load existing files when component mounts
  useEffect(() => {
    loadProjectFiles()
  }, [loadProjectFiles])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      await uploadFile(file)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadFile = async (file: File) => {
    if (typeof StorageService === 'undefined') {
      toast({
        title: "Error",
        description: "File upload service not available",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUploading(true)
      setUploadProgress(0)

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 100)

      const fileType = getFileType(file.type)
      
      const uploadedFile = await StorageService.uploadFile({
        file,
        projectId,
        fileType,
        metadata: {
          originalName: file.name,
          size: file.size,
          type: file.type
        }
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      // Add to uploaded files list
      setUploadedFiles(prev => [uploadedFile, ...prev])

      // Notify parent component
      if (onFileUploaded) {
        onFileUploaded(uploadedFile)
      }

      toast({
        title: "Success",
        description: `${file.name} uploaded successfully!`,
      })

      // Reset progress after a delay
      setTimeout(() => setUploadProgress(0), 1000)
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Error",
        description: `Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteFile = async (file: StoredFile) => {
    if (typeof StorageService === 'undefined') {
      toast({
        title: "Error",
        description: "File delete service not available",
        variant: "destructive",
      })
      return
    }

    if (!confirm(`Are you sure you want to delete ${file.name}?`)) {
      return
    }

    try {
      await StorageService.deleteFile(file.id)
      
      // Remove from local state
      setUploadedFiles(prev => prev.filter(f => f.id !== file.id))
      
      // Notify parent component
      if (onFileDeleted) {
        onFileDeleted(file.id)
      }

      toast({
        title: "Success",
        description: `${file.name} deleted successfully!`,
      })
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: "Error",
        description: `Failed to delete ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    }
  }

  const handleDownloadFile = async (file: StoredFile) => {
    if (typeof StorageService === 'undefined') {
      toast({
        title: "Error",
        description: "File download service not available",
        variant: "destructive",
      })
      return
    }

    try {
      const blob = await StorageService.downloadFile(file.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: "Error",
        description: `Failed to download ${file.name}`,
        variant: "destructive",
      })
    }
  }

  const openFileInNewTab = (file: StoredFile) => {
    window.open(file.url, '_blank')
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Storage Service Not Available */}
      {!isStorageAvailable && (
        <Card className="cinema-card border-border">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <File className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Storage Service Unavailable</h3>
              <p className="text-muted-foreground mb-4">
                The file storage service is not currently available. Please check your configuration.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Section */}
      {isStorageAvailable && (
        <Card className="cinema-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* File Input */}
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="gradient-button text-white"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Files
                </Button>
                <span className="text-sm text-muted-foreground">
                  Max file size: 100MB
                </span>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Files List */}
      {isStorageAvailable && (
        <Card className="cinema-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <File className="h-5 w-5" />
              Project Files ({uploadedFiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading files...
              </div>
            ) : uploadedFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No files uploaded yet
              </div>
            ) : (
              <div className="space-y-3">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        {getFileIcon(file.mimeType)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* File Type Badge */}
                      <Badge variant="secondary" className="text-xs">
                        {getFileType(file.mimeType)}
                      </Badge>

                      {/* Action Buttons */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openFileInNewTab(file)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadFile(file)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteFile(file)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
