"use client"

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Upload, 
  File, 
  FileText, 
  AlertCircle,
  Eye,
  Trash2,
  Save,
  Edit3,
  Info,
  RefreshCw,
  Move,
  Tag,
  Copy,
  Plus,
  FileDown,
  Sparkles
} from 'lucide-react'
import { AssetService, type CreateAssetData } from '@/lib/asset-service'
import { StorageService, type StoredFile } from '@/lib/storage-service'
import { useToast } from '@/hooks/use-toast'
import { getSupabaseClient } from '@/lib/supabase'

interface FileImportProps {
  projectId: string
  sceneId: string | null
  onFileImported?: (assetId: string) => void
  className?: string
}

interface ImportedFile {
  id: string
  name: string
  type: string
  size: number
  content: string
  mimeType: string
  uploadedAt: Date
  storedFile?: StoredFile
  assetType?: 'script' | 'image' | 'video' | 'audio'
  version?: string
  versionName?: string
  isProcessed?: boolean
  extractedText?: string
  isExtracting?: boolean
}

// Text extraction utilities
const extractTextFromFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('text/') || 
        file.name.toLowerCase().endsWith('.txt') || 
        file.name.toLowerCase().endsWith('.rtf') ||
        file.name.toLowerCase().endsWith('.md')) {
      // Text files - read directly with preserved formatting
      const reader = new FileReader()
      reader.onload = (e) => {
        let text = e.target?.result as string
        // Preserve line breaks and screenplay formatting
        resolve(preserveScreenplayFormatting(text))
      }
      reader.onerror = () => reject(new Error('Failed to read text file'))
      reader.readAsText(file)
    } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      // PDF files - use PDF.js for text extraction with formatting
      extractPDFText(file).then(resolve).catch(reject)
    } else if (file.type.includes('word') || file.type.includes('document') || 
               file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) {
      // Word documents - use mammoth.js for text extraction with formatting
      extractWordText(file).then(resolve).catch(reject)
    } else {
      reject(new Error('Unsupported file type for text extraction'))
    }
  })
}

const extractPDFText = async (file: File): Promise<string> => {
  try {
    // Dynamic import of PDF.js
    const pdfjsLib = await import('pdfjs-dist')
    
    // Set worker path
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
    
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      
      // Preserve positioning and structure with better spacing detection
      let pageText = ''
      let lastY = -1
      let lineText = ''
      let lineSpacing = 0
      
      for (const item of textContent.items) {
        // Type guard to ensure we have a TextItem
        if ('str' in item && 'transform' in item) {
          const itemY = (item as any).transform[5] // Y position
          
          // Calculate line spacing for the first few items
          if (lastY !== -1 && lineSpacing === 0) {
            lineSpacing = Math.abs(itemY - lastY)
          }
          
          // If Y position changes significantly, it's a new line
          const significantYChange = lastY === -1 || Math.abs(itemY - lastY) > 5
          const largeYChange = lastY !== -1 && Math.abs(itemY - lastY) > (lineSpacing * 1.5)
          
          if (significantYChange) {
            if (lineText.trim()) {
              pageText += lineText.trim() + '\n'
              
              // Add extra line break for larger spacing (paragraph breaks)
              if (largeYChange) {
                pageText += '\n'
              }
              
              lineText = ''
            }
            lastY = itemY
          }
          
          // Add text item to current line with proper spacing
          const textToAdd = item.str
          if (lineText && !lineText.endsWith(' ') && !textToAdd.startsWith(' ')) {
            lineText += ' ' + textToAdd
          } else {
            lineText += textToAdd
          }
        }
      }
      
      // Add the last line
      if (lineText.trim()) {
        pageText += lineText.trim() + '\n'
      }
      
      // Add to full text with page separator
      fullText += pageText + '\n'
    }
    
      // Clean up and preserve structure with screenplay formatting
      return preserveScreenplayFormatting(fullText)
  } catch (error) {
    console.error('PDF text extraction error:', error)
    throw new Error('Failed to extract text from PDF. Please ensure the PDF contains selectable text.')
  }
}

const extractWordText = async (file: File): Promise<string> => {
  try {
    // Dynamic import of mammoth.js
    const mammoth = await import('mammoth')
    
    const arrayBuffer = await file.arrayBuffer()
    
    // Extract with basic options
    const result = await mammoth.extractRawText({ arrayBuffer })
    
    let text = result.value || 'No text content found in document'
    
    // Clean up and preserve structure with screenplay formatting
    return preserveScreenplayFormatting(text)
  } catch (error) {
    console.error('Word document text extraction error:', error)
    throw new Error('Failed to extract text from Word document. Please ensure the document contains text content.')
  }
}

const getFileIcon = (mimeType: string) => {
  if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="h-4 w-4 text-blue-500" />
  if (mimeType.startsWith('text/')) return <FileText className="h-4 w-4 text-green-500" />
  return <File className="h-4 w-4" />
}

const getFileType = (mimeType: string): string => {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'Word'
  if (mimeType.startsWith('text/')) return 'Text'
  return 'Document'
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Function to clean up and preserve text formatting
const preserveTextFormatting = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n') // Normalize Windows line breaks
    .replace(/\r/g, '\n')   // Normalize Mac line breaks
    .replace(/\n{4,}/g, '\n\n\n') // Allow up to 3 line breaks for scene separation
    .replace(/[ \t]+/g, ' ') // Normalize multiple spaces/tabs to single space, but preserve single spaces
    .replace(/\n +/g, '\n') // Remove leading spaces after line breaks
    .replace(/ +\n/g, '\n') // Remove trailing spaces before line breaks
    .replace(/\n\n\n+/g, '\n\n') // Limit to max 2 consecutive line breaks
    .trim()
}

// Enhanced function for screenplay formatting preservation
const preserveScreenplayFormatting = (text: string): string => {
  let formatted = text
    .replace(/\r\n/g, '\n') // Normalize Windows line breaks
    .replace(/\r/g, '\n')   // Normalize Mac line breaks
  
  // Split into lines to analyze structure
  const lines = formatted.split('\n')
  const processedLines: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    // Skip completely empty lines but preserve intentional breaks
    if (trimmedLine === '') {
      // Only add empty line if the previous line wasn't empty
      if (processedLines.length > 0 && processedLines[processedLines.length - 1] !== '') {
        processedLines.push('')
      }
      continue
    }
    
    // Detect scene headings (usually all caps, contains scene indicators)
    if (isSceneHeading(trimmedLine)) {
      // Add extra space before scene headings (except first line)
      if (processedLines.length > 0) {
        processedLines.push('')
      }
      processedLines.push(trimmedLine)
      processedLines.push('') // Add space after scene heading
      continue
    }
    
    // Detect location headings (EXT./INT.)
    if (isLocationHeading(trimmedLine)) {
      processedLines.push('')
      processedLines.push(trimmedLine)
      processedLines.push('')
      continue
    }
    
    // Detect character names (usually all caps, centered-ish)
    if (isCharacterName(trimmedLine)) {
      processedLines.push('')
      processedLines.push(trimmedLine)
      continue
    }
    
    // Regular action/dialogue lines
    processedLines.push(trimmedLine)
  }
  
  return processedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive empty lines
    .trim()
}

// Helper functions for screenplay format detection
const isSceneHeading = (line: string): boolean => {
  const upper = line.toUpperCase()
  return (
    upper.includes('SCENE') ||
    upper.includes('ACT ') ||
    upper.includes('CHAPTER') ||
    (upper === line && line.length > 10 && line.includes(' - '))
  )
}

const isLocationHeading = (line: string): boolean => {
  const upper = line.toUpperCase()
  return (
    upper.startsWith('EXT.') ||
    upper.startsWith('INT.') ||
    upper.startsWith('EXTERIOR') ||
    upper.startsWith('INTERIOR')
  )
}

const isCharacterName = (line: string): boolean => {
  const upper = line.toUpperCase()
  // Character names are usually all caps, short, and not action descriptions
  return (
    upper === line && 
    line.length < 50 && 
    line.length > 2 &&
    !line.includes('.') &&
    !line.includes(' - ') &&
    !line.includes('EXT') &&
    !line.includes('INT') &&
    !line.includes('SCENE')
  )
}

const isSupportedFile = (file: File): boolean => {
  const supportedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/rtf',
    'text/markdown'
  ]
  
  return supportedTypes.includes(file.type) || 
         file.name.toLowerCase().endsWith('.pdf') ||
         file.name.toLowerCase().endsWith('.doc') ||
         file.name.toLowerCase().endsWith('.docx') ||
         file.name.toLowerCase().endsWith('.txt') ||
         file.name.toLowerCase().endsWith('.rtf') ||
         file.name.toLowerCase().endsWith('.md')
}

export default function FileImport({ 
  projectId, 
  sceneId,
  onFileImported, 
  className = "" 
}: FileImportProps) {
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([])
  const [showImportForm, setShowImportForm] = useState(false)
  const [editingFile, setEditingFile] = useState<ImportedFile | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    content_type: 'script' as 'script' | 'image' | 'video' | 'audio',
    content: '',
    version_name: '',
    version: '1'
  })
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState<string | null>(null)
  const [showFileInfo, setShowFileInfo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Load existing imported files from storage on component mount
  useEffect(() => {
    loadExistingFiles()
  }, [projectId])

  const loadExistingFiles = async () => {
    if (!projectId) return
    
    try {
      setIsLoading(true)
      
      // First, let's get all files from the user's project folder
      const { data: { user } } = await getSupabaseClient().auth.getUser()
      if (!user) return
      
      // List files from the user's project folder
      const { data: projectFiles, error } = await getSupabaseClient().storage
        .from('cinema_files')
        .list(`${user.id}/${projectId}`, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        })
      
      if (error) {
        console.error('Error listing project files:', error)
        return
      }
      
      console.log('Project files found:', projectFiles)
      
      // Process each file type folder (document, image, video, audio)
      const allFiles: StoredFile[] = []
      
      for (const folder of projectFiles) {
        if (folder.name && !folder.name.startsWith('.')) {
          try {
            // List files in this subfolder
            const { data: subfolderFiles, error: subfolderError } = await getSupabaseClient().storage
              .from('cinema_files')
              .list(`${user.id}/${projectId}/${folder.name}`, {
                limit: 100,
                offset: 0,
                sortBy: { column: 'created_at', order: 'desc' }
              })
            
            if (subfolderError) {
              console.error(`Error listing ${folder.name} files:`, subfolderError)
              continue
            }
            
            // Convert storage objects to StoredFile format
            const subfolderStoredFiles: StoredFile[] = subfolderFiles
              .filter((item: any) => !item.name.startsWith('.'))
              .map((item: any) => {
                const { data: urlData } = getSupabaseClient().storage
                  .from('cinema_files')
                  .getPublicUrl(`${user.id}/${projectId}/${folder.name}/${item.name}`)
                
                // Extract original filename from metadata or remove timestamp prefix
                let originalName = item.name
                
                // First try to get the original name from metadata
                if (item.metadata?.originalName) {
                  originalName = item.metadata.originalName
                  console.log(`Using original name from metadata: ${originalName}`)
                } else if (item.name.includes('_')) {
                  // Remove timestamp prefix (format: timestamp_filename)
                  const parts = item.name.split('_')
                  if (parts.length > 1 && !isNaN(parseInt(parts[0]))) {
                    // First part is timestamp, rest is filename
                    originalName = parts.slice(1).join('_')
                    console.log(`Extracted filename from timestamp prefix: ${originalName} (from: ${item.name})`)
                  }
                }
                
                console.log(`File: ${item.name} -> Display name: ${originalName}`)
                
                return {
                  id: `${user.id}/${projectId}/${folder.name}/${item.name}`,
                  name: originalName,
                  url: urlData.publicUrl,
                  size: item.metadata?.size || 0,
                  mimeType: item.metadata?.mimetype || 'application/octet-stream',
                  uploadedAt: item.created_at || new Date().toISOString(),
                  metadata: item.metadata
                }
              })
            
            allFiles.push(...subfolderStoredFiles)
          } catch (subfolderError) {
            console.error(`Error processing ${folder.name} folder:`, subfolderError)
          }
        }
      }
      
      console.log('All files found:', allFiles)
      
      // Convert stored files to imported files format
      const existingFiles: ImportedFile[] = allFiles
        .filter(file => file.mimeType.includes('pdf') || 
                       file.mimeType.includes('word') || 
                       file.mimeType.includes('document') ||
                       file.mimeType.startsWith('text/'))
        .map(file => {
          console.log(`Processing file: ${file.name} (original: ${file.metadata?.originalName || 'not set'})`)
          return {
            id: file.id,
            name: file.name,
            type: getFileType(file.mimeType),
            size: file.size,
            content: `[Stored file: ${file.name}]\n\nThis file has been previously uploaded and stored in your project bucket.`,
            mimeType: file.mimeType,
            uploadedAt: new Date(file.uploadedAt),
            storedFile: file,
            assetType: undefined,
            version: '1',
            versionName: undefined,
            isProcessed: false,
            extractedText: undefined,
            isExtracting: false
          }
        })
      
      console.log('Converted to imported files:', existingFiles)
      setImportedFiles(existingFiles)
    } catch (error) {
      console.error('Error loading existing files:', error)
      // Don't show error toast for initial load
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      await processFile(file)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      if (isSupportedFile(file)) {
        await processFile(file)
      } else {
        toast({
          title: "Unsupported File",
          description: `${file.name} is not a supported file type.`,
          variant: "destructive",
        })
      }
    }
  }

  const processFile = async (file: File) => {
    if (!isSupportedFile(file)) {
      toast({
        title: "Unsupported File",
        description: `${file.name} is not a supported file type.`,
        variant: "destructive",
      })
      return
    }

    try {
      setIsImporting(true)
      setImportProgress(0)

      // Simulate processing progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 100)

      let content = ''
      let mimeType = file.type

      // Process different file types
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // For PDFs, show a message about future implementation
        content = `[PDF Content from ${file.name}]\n\nThis PDF file has been uploaded. In a future update, we will integrate PDF text extraction to automatically parse the content.\n\nFor now, you can manually copy and paste the text content from your PDF into the content field when saving as an asset.`
        mimeType = 'application/pdf'
      } else if (file.type.includes('word') || file.type.includes('document') || 
                 file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) {
        // For Word documents, show a message about future implementation
        content = `[Word Document Content from ${file.name}]\n\nThis Word document has been uploaded. In a future update, we will integrate Word document text extraction to automatically parse the content.\n\nFor now, you can manually copy and paste the text content from your Word document into the content field when saving as an asset.`
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      } else if (file.type.startsWith('text/') || 
                 file.name.toLowerCase().endsWith('.txt') || 
                 file.name.toLowerCase().endsWith('.rtf') ||
                 file.name.toLowerCase().endsWith('.md')) {
        // For text files, read directly
        content = await file.text()
        mimeType = file.type || 'text/plain'
      } else {
        throw new Error('Unsupported file type')
      }

      // Upload file to storage bucket
      const storedFile = await StorageService.uploadFile({
        file,
        projectId,
        fileType: 'document',
        metadata: {
          originalName: file.name,
          originalType: file.type,
          originalSize: file.size,
          importedAt: new Date().toISOString(),
          sceneId: sceneId
        }
      })

      clearInterval(progressInterval)
      setImportProgress(100)

      // Create imported file object
      const importedFile: ImportedFile = {
        id: storedFile.id,
        name: file.name,
        type: getFileType(mimeType),
        size: file.size,
        content: content,
        mimeType: mimeType,
        uploadedAt: new Date(),
        storedFile: storedFile,
        assetType: undefined,
        version: '1',
        versionName: undefined,
        isProcessed: false,
        extractedText: undefined,
        isExtracting: false
      }

      // Add to imported files list
      setImportedFiles(prev => [importedFile, ...prev])

      toast({
        title: "File Imported",
        description: `${file.name} has been imported and saved to your project bucket!`,
      })

      // Reset progress after a delay
      setTimeout(() => setImportProgress(0), 1000)
    } catch (error) {
      console.error('Import error:', error)
      toast({
        title: "Import Failed",
        description: `Failed to import ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleExtractText = async (file: ImportedFile) => {
    if (!file.storedFile) {
      toast({
        title: "Error",
        description: "File not found in storage",
        variant: "destructive",
      })
      return
    }

    try {
      // Mark file as extracting
      setImportedFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, isExtracting: true } : f
      ))

      // Fetch the file from storage
      const response = await fetch(file.storedFile.url)
      if (!response.ok) throw new Error('Failed to fetch file from storage')
      
      const blob = await response.blob()
      
      // Create a file-like object that works with our extraction functions
      const fileObject = {
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
        size: file.size,
        arrayBuffer: () => blob.arrayBuffer(),
        text: () => blob.text()
      } as File

      // Extract text
      const extractedText = await extractTextFromFile(fileObject)

      // Update the file with extracted text
      setImportedFiles(prev => prev.map(f => 
        f.id === file.id ? { 
          ...f, 
          extractedText,
          isExtracting: false,
          content: extractedText // Update content with extracted text
        } : f
      ))

      toast({
        title: "Text Extracted",
        description: `Successfully extracted text from ${file.name}`,
      })

      // Auto-open the edit form with extracted text
      setEditingFile(file)
      setEditForm({
        title: file.name,
        content_type: 'script',
        content: extractedText,
        version_name: `Extracted from ${file.name}`,
        version: '1'
      })
      setShowImportForm(true)

    } catch (error) {
      console.error('Text extraction error:', error)
      
      // Reset extracting state
      setImportedFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, isExtracting: false } : f
      ))

      toast({
        title: "Text Extraction Failed",
        description: `Failed to extract text from ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    }
  }

  const handleSaveToAssets = async (file: ImportedFile) => {
    try {
      setIsImporting(true)

      const assetData: CreateAssetData = {
        project_id: projectId,
        scene_id: sceneId,
        title: editForm.title || file.name,
        content_type: editForm.content_type,
        content: editForm.content || file.content,
        content_url: file.storedFile?.url, // Use the stored file URL
        version_name: editForm.version_name || `Imported from ${file.name}`,
        metadata: {
          originalFileName: file.name,
          originalFileType: file.type,
          originalFileSize: file.size,
          importedAt: new Date().toISOString(),
          importSource: 'file_upload',
          storedFileId: file.storedFile?.id,
          storedFileUrl: file.storedFile?.url,
          extractedText: file.extractedText,
          extractionMethod: file.extractedText ? 'automatic' : 'manual',
          // Add special metadata to bypass scene validation for imported scripts
          isImportedScript: true,
          bypassSceneValidation: true
        }
      }

      const newAsset = await AssetService.createAsset(assetData)

      // Update the imported file to mark it as processed
      setImportedFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, isProcessed: true, assetType: editForm.content_type, version: editForm.version, versionName: editForm.version_name }
          : f
      ))

      toast({
        title: "Asset Created",
        description: `${file.name} has been saved as an asset in your scene!`,
      })

      // Notify parent component
      if (onFileImported) {
        onFileImported(newAsset.id)
      }

      // Close form and reset
      setShowImportForm(false)
      setEditingFile(null)
      setEditForm({
        title: '',
        content_type: 'script',
        content: '',
        version_name: '',
        version: '1'
      })

    } catch (error) {
      console.error('Error saving asset:', error)
      toast({
        title: "Save Failed",
        description: `Failed to save ${file.name} as asset: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleEditFile = (file: ImportedFile) => {
    setEditingFile(file)
    setEditForm({
      title: file.name,
      content_type: file.assetType || 'script',
      content: file.content,
      version_name: file.versionName || `Imported from ${file.name}`,
      version: file.version || '1'
    })
    setShowImportForm(true)
  }

  const handleQuickAction = (file: ImportedFile, action: 'script' | 'image' | 'video' | 'audio') => {
    setEditingFile(file)
    setEditForm({
      title: file.name,
      content_type: action,
      content: file.content,
      version_name: `Imported ${action} from ${file.name}`,
      version: '1'
    })
    setShowImportForm(true)
    setShowQuickActions(null)
  }

  const handleDeleteFile = async (file: ImportedFile) => {
    if (confirm(`Are you sure you want to delete ${file.name}? This will remove it from both the import list and your storage bucket.`)) {
      try {
        // Delete from storage bucket if it exists there
        if (file.storedFile?.id) {
          await StorageService.deleteFile(file.storedFile.id)
        }
        
        // Remove from local state
        setImportedFiles(prev => prev.filter(f => f.id !== file.id))
        
        toast({
          title: "File Deleted",
          description: `${file.name} has been removed from your project.`,
        })
      } catch (error) {
        console.error('Error deleting file:', error)
        toast({
          title: "Delete Failed",
          description: `Failed to delete ${file.name} from storage.`,
          variant: "destructive",
        })
      }
    }
  }

  const openFileInNewTab = (file: ImportedFile) => {
    if (file.storedFile?.url) {
      // Open the stored file URL
      window.open(file.storedFile.url, '_blank')
    } else {
      // Create a blob URL for the file content (fallback)
      const blob = new Blob([file.content], { type: file.mimeType })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      window.URL.revokeObjectURL(url)
    }
  }

  const getAssetTypeColor = (type: string) => {
    switch (type) {
      case 'script': return 'bg-green-500/20 text-green-600 border-green-500/30'
      case 'image': return 'bg-blue-500/20 text-blue-600 border-blue-500/30'
      case 'video': return 'bg-purple-500/20 text-purple-600 border-purple-500/30'
      case 'audio': return 'bg-orange-500/20 text-orange-600 border-orange-500/30'
      default: return 'bg-gray-500/20 text-gray-600 border-gray-500/30'
    }
  }

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'script': return <FileText className="h-4 w-4" />
      case 'image': return <File className="h-4 w-4" />
      case 'video': return <File className="h-4 w-4" />
      case 'audio': return <File className="h-4 w-4" />
      default: return <File className="h-4 w-4" />
    }
  }

  const canExtractText = (file: ImportedFile): boolean => {
    return file.type === 'PDF' || file.type === 'Word' || file.type === 'Text'
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Import Section */}
      <Card className="bg-card border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-primary flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Documents
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadExistingFiles}
              disabled={isLoading}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">
                Drag & drop files here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click the button below to browse
              </p>
              
              {/* File Input */}
              <div className="flex items-center justify-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.rtf,.md"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Files
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground mt-4">
                Supported: PDF, Word (.doc, .docx), Text (.txt, .rtf, .md)
              </p>
            </div>

            {/* Import Progress */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing file...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="w-full" />
              </div>
            )}

            {/* Info Box - Collapsible */}
            <div className="border border-blue-500/20 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowFileInfo(!showFileInfo)}
                className="w-full p-3 bg-blue-500/10 hover:bg-blue-500/20 transition-colors flex items-center justify-between text-left group"
                title={showFileInfo ? "Click to hide file import information" : "Click to see detailed file import instructions"}
              >
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-blue-500 text-sm">File Import Information</span>
                  {!showFileInfo && (
                    <span className="text-xs bg-blue-500/20 text-blue-600 px-2 py-1 rounded-full">
                      {importedFiles.length > 0 ? 'Click for help' : 'Click for details'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-500 text-sm">
                    {showFileInfo ? 'Hide Details' : 'Show More'}
                  </span>
                  <div className={`w-4 h-4 transition-transform duration-200 ${showFileInfo ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>
              
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                showFileInfo ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="p-4 bg-blue-500/5 border-t border-blue-500/20">
                  <ul className="text-blue-600 space-y-1 text-sm">
                    <li>• <strong>Text files (.txt, .rtf, .md):</strong> Content is automatically extracted with screenplay formatting preserved</li>
                    <li>• <strong>PDF files:</strong> Use "Convert to Script" to extract text with scene headings, locations, and dialogue structure</li>
                    <li>• <strong>Word documents:</strong> Use "Convert to Script" to extract text with screenplay formatting intact</li>
                    <li>• <strong>All files:</strong> Are saved to your project bucket and can be saved as scene assets</li>
                    <li>• <strong>Persistent storage:</strong> Files remain available after page refresh</li>
                    <li>• <strong>Quick Actions:</strong> Use the move button to quickly categorize files</li>
                    <li>• <strong>Smart Extraction:</strong> Automatically detects and preserves screenplay elements (scenes, locations, characters)</li>
                    <li>• <strong>Format Preservation:</strong> Maintains proper spacing between scenes, paragraphs, and dialogue blocks</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Imported Files List */}
      <Card className="bg-card border-primary/20">
        <CardHeader>
          <CardTitle className="text-primary flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Imported Files ({importedFiles.length})
          </CardTitle>
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-muted-foreground">
              Debug: Project ID: {projectId} | Loading: {isLoading ? 'Yes' : 'No'}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading files...</p>
            </div>
          ) : importedFiles.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No imported files yet</p>
              <p className="text-sm text-muted-foreground">Upload files above to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {importedFiles.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    file.isProcessed 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-muted/30 border-border/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      {getFileIcon(file.mimeType)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        {file.isProcessed && (
                          <Badge className={getAssetTypeColor(file.assetType!)}>
                            {getAssetTypeIcon(file.assetType!)}
                            {file.assetType}
                          </Badge>
                        )}
                        {file.versionName && (
                          <Badge variant="outline" className="text-xs">
                            v{file.version}: {file.versionName}
                          </Badge>
                        )}
                        {file.extractedText && (
                          <Badge variant="outline" className="text-xs bg-green-500/20 text-green-600 border-green-500/30">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Text Extracted
                          </Badge>
                        )}
                      </div>
                      {process.env.NODE_ENV === 'development' && file.storedFile && (
                        <p className="text-xs text-muted-foreground">
                          Storage: {file.storedFile.name}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{file.type}</span>
                        <span>•</span>
                        <span>{file.uploadedAt.toLocaleDateString()}</span>
                        {file.storedFile && (
                          <>
                            <span>•</span>
                            <span className="text-green-500">✓ Stored</span>
                          </>
                        )}
                        {file.isProcessed && (
                          <>
                            <span>•</span>
                            <span className="text-blue-500">✓ Asset Created</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* File Type Badge */}
                    <Badge variant="secondary" className="text-xs">
                      {file.type}
                    </Badge>

                    {/* Convert to Script Button */}
                    {canExtractText(file) && !file.extractedText && !file.isProcessed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExtractText(file)}
                        disabled={file.isExtracting}
                        className="h-8 px-3 border-green-500/30 text-green-600 hover:bg-green-500/10"
                        title="Extract text and convert to script"
                      >
                        {file.isExtracting ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500 mr-2"></div>
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Convert to Script
                      </Button>
                    )}

                    {/* Quick Actions Menu */}
                    {!file.isProcessed && (
                      <div className="relative">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowQuickActions(showQuickActions === file.id ? null : file.id)}
                          className="h-8 w-8 p-0"
                          title="Quick actions"
                        >
                          <Move className="h-4 w-4" />
                        </Button>
                        
                        {showQuickActions === file.id && (
                          <div className="absolute right-0 top-10 z-50 w-48 bg-background border border-border rounded-lg shadow-lg p-2 space-y-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleQuickAction(file, 'script')}
                              className="w-full justify-start text-green-600 hover:bg-green-500/10"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Save as Script
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full justify-start text-blue-600 hover:bg-blue-500/10"
                            >
                              <File className="h-4 w-4 mr-2" />
                              Save as Image
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleQuickAction(file, 'video')}
                              className="w-full justify-start text-purple-600 hover:bg-purple-500/10"
                            >
                              <File className="h-4 w-4 mr-2" />
                              Save as Video
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleQuickAction(file, 'audio')}
                              className="w-full justify-start text-orange-600 hover:bg-orange-500/10"
                            >
                              <File className="h-4 w-4 mr-2" />
                              Save as Audio
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openFileInNewTab(file)}
                      className="h-8 w-8 p-0"
                      title="Preview file"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditFile(file)}
                      className="h-8 w-8 p-0"
                      title="Edit and save as asset"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteFile(file)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="Delete file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Form Dialog */}
      {showImportForm && editingFile && (
        <Card className="bg-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <Save className="h-5 w-5" />
              Save as Scene Asset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* File Info */}
              <div className="p-3 bg-muted/20 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  {getFileIcon(editingFile.mimeType)}
                  <span className="font-medium">{editingFile.name}</span>
                  <Badge variant="secondary">{editingFile.type}</Badge>
                  {editingFile.storedFile && (
                    <Badge className="bg-green-500 text-white text-xs">Stored in Bucket</Badge>
                  )}
                  {editingFile.extractedText && (
                    <Badge className="bg-green-500 text-white text-xs">Text Extracted</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Size: {formatFileSize(editingFile.size)} • 
                  Imported: {editingFile.uploadedAt.toLocaleDateString()}
                </p>
              </div>

              {/* Form Fields */}
              <div>
                <Label htmlFor="asset-title">Asset Title</Label>
                <Input
                  id="asset-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter a title for this asset"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="content-type">Content Type</Label>
                  <Select
                    value={editForm.content_type}
                    onValueChange={(value: 'script' | 'image' | 'video' | 'audio') => 
                      setEditForm(prev => ({ ...prev, content_type: value }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="script">Script</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="version">Version Number</Label>
                  <Input
                    id="version"
                    type="number"
                    min="1"
                    value={editForm.version}
                    onChange={(e) => setEditForm(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="1"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="version-name">Version Name</Label>
                <Input
                  id="version-name"
                  value={editForm.version_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, version_name: e.target.value }))}
                  placeholder="e.g., 'First Draft', 'Imported Version', 'Director Notes'"
                  className="mt-1"
                />
              </div>

              {editForm.content_type === 'script' && (
                <div>
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={editForm.content}
                    onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Edit the content if needed..."
                    className="mt-1 h-32"
                  />
                  {editingFile.type === 'PDF' || editingFile.type === 'Word' ? (
                    <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Manual Content Entry Required</span>
                      </div>
                      <p className="text-sm text-yellow-600 mt-1">
                        For {editingFile.type} files, please manually copy and paste the content from your document into the field above.
                      </p>
                    </div>
                  ) : null}
                  {editingFile.extractedText && (
                    <div className="mt-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-green-600">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-sm font-medium">Text Successfully Extracted!</span>
                      </div>
                      <p className="text-sm text-green-600 mt-1">
                        The text content has been automatically extracted from your {editingFile.type} file. You can edit it below if needed.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowImportForm(false)
                    setEditingFile(null)
                    setEditForm({
                      title: '',
                      content_type: 'script',
                      content: '',
                      version_name: '',
                      version: '1'
                    })
                  }}
                  className="border-border"
                >
                  Cancel
                </Button>
                
                <Button
                  onClick={() => handleSaveToAssets(editingFile)}
                  disabled={isImporting || !editForm.title.trim()}
                  className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save as Asset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
