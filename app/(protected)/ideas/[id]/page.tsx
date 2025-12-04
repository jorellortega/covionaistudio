"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit, Trash2, Image as ImageIcon, FileText, Film, Wand2, Loader2, List, File, Download, Sparkles, Eye, Copy, Save, Upload, ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react"
import { useAuthReady } from "@/components/auth-hooks"
import { MovieIdeasService, type MovieIdea } from "@/lib/movie-ideas-service"
import { IdeaImagesService } from "@/lib/idea-images-service"
import { getSupabaseClient } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import { Navigation } from "@/components/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { sanitizeFilename } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import AITextEditor from "@/components/ai-text-editor"

export default function IdeaDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, userId, ready } = useAuthReady()
  const [idea, setIdea] = useState<MovieIdea | null>(null)
  const [ideaImages, setIdeaImages] = useState<string[]>([])
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [showCoverImageDialog, setShowCoverImageDialog] = useState(false)
  const [ideaFiles, setIdeaFiles] = useState<Array<{url: string, name: string, type: string, id?: string}>>([])
  const [loading, setLoading] = useState(true)
  const [fileTexts, setFileTexts] = useState<{[key: string]: string}>({})
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [editingText, setEditingText] = useState<string>("")
  const [extractingFile, setExtractingFile] = useState<string | null>(null)
  const [showAITextEditor, setShowAITextEditor] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [aiEditData, setAiEditData] = useState<{selectedText: string, fullContent: string} | null>(null)
  const [textSelection, setTextSelection] = useState<{start: number, end: number} | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const filesPerPage = 5
  const [textPages, setTextPages] = useState<{[key: string]: number}>({})
  const textCharsPerPage = 5000 // Characters per page for text display
  const textareaRefs = useRef<{[key: string]: HTMLTextAreaElement | null}>({})
  const [textEnhancerSettings, setTextEnhancerSettings] = useState<{model: string; prefix: string}>({
    model: 'gpt-4o-mini',
    prefix: ''
  })
  const [userApiKeys, setUserApiKeys] = useState<{openai_api_key?: string; anthropic_api_key?: string}>({})
  const [isEnhancingText, setIsEnhancingText] = useState(false)

  // Treatment & Scenes state
  const [treatment, setTreatment] = useState<any>(null)
  const [scenes, setScenes] = useState<any[]>([])
  const [sceneList, setSceneList] = useState<any>(null)
  const [loadingTreatmentScenes, setLoadingTreatmentScenes] = useState(false)
  
  // Editing state for Treatment & Scenes tab
  const [editingSynopsis, setEditingSynopsis] = useState(false)
  const [synopsisValue, setSynopsisValue] = useState("")
  const [editingTreatment, setEditingTreatment] = useState(false)
  const [treatmentContent, setTreatmentContent] = useState("")
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [editingSceneData, setEditingSceneData] = useState<any>(null)
  const [isSavingSynopsis, setIsSavingSynopsis] = useState(false)
  const [isSavingTreatment, setIsSavingTreatment] = useState(false)
  const [isSavingScene, setIsSavingScene] = useState(false)

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editGenres, setEditGenres] = useState<string[]>([])
  const [editMainCreator, setEditMainCreator] = useState("")
  const [editCoCreators, setEditCoCreators] = useState<string[]>([])
  const [editSynopsis, setEditSynopsis] = useState("")
  const [editStatus, setEditStatus] = useState<"concept" | "development" | "pre-production" | "production" | "post-production" | "completed">("concept")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const ideaId = params.id as string

  const genres = [
    "Action", "Adventure", "Comedy", "Crime", "Drama", "Fantasy", 
    "Horror", "Mystery", "Romance", "Sci-Fi", "Thriller", "Western",
    "Animation", "Documentary", "Musical", "War", "Biography", "History"
  ]

  useEffect(() => {
    if (ready && userId && ideaId) {
      loadIdea()
      fetchTextEnhancerSettings()
      fetchUserApiKeys()
    }
  }, [ready, userId, ideaId])

  const loadTreatmentAndScenes = async () => {
    if (!userId || !ideaId || !idea) return
    
    setLoadingTreatmentScenes(true)
    try {
      const supabase = getSupabaseClient()
      
      // Load scenes for this idea
      const { data: existingSceneList } = await supabase
        .from('scene_lists')
        .select('*')
        .eq('movie_idea_id', ideaId)
        .single()
      
      if (existingSceneList) {
        setSceneList(existingSceneList)
        const { data: scenesData } = await supabase
          .from('scenes')
          .select('*')
          .eq('scene_list_id', existingSceneList.id)
          .order('order_index', { ascending: true })
        
        if (scenesData) {
          setScenes(scenesData)
        }
      }
      
      // Try to find a treatment - treatments are linked to projects, not ideas directly
      // We'll check if there's a treatment with a matching title
      // First try exact title match, then try partial match
      let treatmentsData = null
      
      // Try exact title match first (most reliable)
      const { data: exactMatch } = await supabase
        .from('treatments')
        .select('*')
        .eq('user_id', userId)
        .eq('title', idea.title)
        .order('updated_at', { ascending: false })
        .limit(1)
      
      if (exactMatch && exactMatch.length > 0) {
        treatmentsData = exactMatch
      } else {
        // Fallback to partial match
        const { data: partialMatch } = await supabase
          .from('treatments')
          .select('*')
          .eq('user_id', userId)
          .ilike('title', `%${idea.title}%`)
          .order('updated_at', { ascending: false })
          .limit(1)
        
        if (partialMatch && partialMatch.length > 0) {
          treatmentsData = partialMatch
        }
      }
      
      if (treatmentsData && treatmentsData.length > 0) {
        const foundTreatment = treatmentsData[0]
        console.log('✅ Found treatment for idea:', foundTreatment.id, foundTreatment.title)
        console.log('📝 Treatment prompt:', {
          hasPrompt: !!foundTreatment.prompt,
          promptLength: foundTreatment.prompt?.length || 0,
          promptPreview: foundTreatment.prompt?.substring(0, 100) || 'empty'
        })
        setTreatment(foundTreatment)
        // Sync treatmentContent state with loaded treatment
        setTreatmentContent(foundTreatment.prompt || "")
      } else {
        console.log('❌ No treatment found for idea:', idea.title)
        setTreatmentContent("")
      }
    } catch (error) {
      console.error('Error loading treatment and scenes:', error)
    } finally {
      setLoadingTreatmentScenes(false)
    }
  }

  // Debug: Log when fileTexts changes
  useEffect(() => {
    console.log('📊 fileTexts state updated:', Object.keys(fileTexts), 'Count:', Object.keys(fileTexts).length)
    Object.keys(fileTexts).forEach(key => {
      console.log(`  - ${key}: ${fileTexts[key].length} characters`)
    })
  }, [fileTexts])

  const loadIdea = async () => {
    try {
      setLoading(true)
      
      // Load the idea
      const ideaData = await MovieIdeasService.getMovieIdea(ideaId)
      
      if (!ideaData) {
        toast({
          title: "Not Found",
          description: "Idea not found",
          variant: "destructive"
        })
        router.push("/ideas")
        return
      }

      // Check if user owns this idea
      if (ideaData.user_id !== userId) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to view this idea",
          variant: "destructive"
        })
        router.push("/ideas")
        return
      }

      setIdea(ideaData)
      
      // Load all files for this idea
      const allFiles = await IdeaImagesService.getIdeaImages(ideaId)
      
      // Separate images from other files
      const images: string[] = []
      const files: Array<{url: string, name: string, type: string, id?: string}> = []
      const texts: {[key: string]: string} = {}
      
      allFiles.forEach(file => {
        const url = file.image_url
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url)
        
        if (isImage) {
          images.push(url)
        } else {
          // Extract filename from URL or prompt
          let fileName = file.prompt?.replace('Imported file: ', '') || 
                        url.split('/').pop() || 
                        'Unknown file'
          
          // If prompt starts with "Extracted text from", extract the filename
          if (file.prompt && file.prompt.startsWith('Extracted text from')) {
            const nameMatch = file.prompt.match(/Extracted text from ([^:]+):/)
            if (nameMatch && nameMatch[1]) {
              fileName = nameMatch[1].trim()
              console.log('📝 Extracted filename from prompt:', fileName)
            }
          }
          
          const fileExtension = fileName.split('.').pop()?.toLowerCase() || ''
          
          files.push({
            url: url,
            name: fileName,
            type: fileExtension,
            id: file.id
          })
          
          // Check if prompt contains extracted text (starts with "Extracted text from")
          if (file.prompt && file.prompt.startsWith('Extracted text from')) {
            // Extract the text part (everything after the filename and newlines)
            const textMatch = file.prompt.match(/Extracted text from [^:]+:\n\n(.+)/s)
            if (textMatch && textMatch[1]) {
              texts[fileName] = textMatch[1]
              console.log('📂 Loaded extracted text for:', fileName, 'Length:', textMatch[1].length)
            } else {
              console.log('⚠️ Could not extract text from prompt for:', fileName)
            }
          }
        }
      })
      
      setIdeaImages(images)
      setIdeaFiles(files)
      setFileTexts(texts)
      
      // Set cover image (first image if available)
      if (images.length > 0) {
        setCoverImage(images[0])
      } else {
        setCoverImage(null)
      }
      
      // Load treatment and scenes after idea is loaded
      await loadTreatmentAndScenes()
      
      console.log('📚 Loaded fileTexts on page load:', Object.keys(texts).length, 'files with extracted text')
      Object.keys(texts).forEach(key => {
        console.log(`  - ${key}: ${texts[key].length} characters`)
      })
    } catch (error) {
      console.error('Error loading idea:', error)
      toast({
        title: "Error",
        description: "Failed to load idea",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Text extraction utilities (similar to file-import.tsx)
  const extractTextFromFile = async (fileUrl: string, fileName: string, fileType: string): Promise<string> => {
    try {
      console.log('📥 Fetching file from URL:', fileUrl)
      // Fetch the file
      const response = await fetch(fileUrl)
      if (!response.ok) {
        console.error('❌ Failed to fetch file:', response.status, response.statusText)
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
      }
      
      console.log('📦 Converting to blob...')
      const blob = await response.blob()
      console.log('✅ Blob created, size:', blob.size, 'type:', blob.type)
      
      // Create a file-like object
      const file = {
        name: fileName,
        type: fileType || 'application/octet-stream',
        size: blob.size,
        arrayBuffer: () => blob.arrayBuffer(),
        text: () => blob.text()
      } as File

      // Extract based on file type
      console.log('🔍 Determining file type. File type:', file.type, 'File name:', fileName)
      if (file.type.startsWith('text/') || 
          fileName.toLowerCase().endsWith('.txt') || 
          fileName.toLowerCase().endsWith('.rtf') ||
          fileName.toLowerCase().endsWith('.md')) {
        // Text files - read directly
        console.log('📄 Extracting as text file...')
        const text = await file.text()
        console.log('✅ Text extracted, length:', text.length)
        return text
      } else if (file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        // PDF files - use PDF.js
        console.log('📄 Extracting as PDF file...')
        return await extractPDFText(file)
      } else if (file.type.includes('word') || file.type.includes('document') || 
                 fileName.toLowerCase().endsWith('.doc') || fileName.toLowerCase().endsWith('.docx')) {
        // Word documents - use mammoth.js
        console.log('📄 Extracting as Word document...')
        return await extractWordText(file)
      } else {
        console.error('❌ Unsupported file type:', file.type, fileName)
        throw new Error(`Unsupported file type for text extraction: ${file.type || 'unknown'}`)
      }
    } catch (error) {
      console.error('Text extraction error:', error)
      throw error
    }
  }

  const extractPDFText = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await import('pdfjs-dist')
      
      // Set worker path - try multiple CDN options
      // For pdfjs-dist 5.x, the worker is in build/pdf.worker.min.mjs
      const workerPaths = [
        `https://unpkg.com/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs`,
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs`,
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.54/pdf.worker.min.mjs`
      ]
      
      // Try first worker path
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerPaths[0]
      
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      
      let fullText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(' ')
        fullText += pageText + '\n\n'
      }
      
      return fullText.trim()
    } catch (error) {
      console.error('PDF extraction error:', error)
      // Try fallback CDNs
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs`
        
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          const pageText = textContent.items.map((item: any) => item.str).join(' ')
          fullText += pageText + '\n\n'
        }
        
        return fullText.trim()
      } catch (fallbackError) {
        console.error('Fallback PDF extraction also failed:', fallbackError)
        throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  const extractWordText = async (file: File): Promise<string> => {
    try {
      const mammoth = await import('mammoth')
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      return result.value
    } catch (error) {
      throw new Error(`Word extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const canExtractText = (fileType: string, fileName: string): boolean => {
    const textTypes = ['txt', 'rtf', 'md', 'pdf', 'doc', 'docx']
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    return textTypes.includes(extension) || 
           fileType.includes('text/') || 
           fileType.includes('pdf') || 
           fileType.includes('word') || 
           fileType.includes('document')
  }

  const handleImportFiles = async (files: File[]) => {
    if (!ready || !user || !idea || files.length === 0) {
      toast({
        title: "Error",
        description: "Please select files to import",
        variant: "destructive",
      })
      return
    }

    const results: { success: string[], failed: string[] } = { success: [], failed: [] }

    for (const file of files) {
      try {
        const fileName = file.name
        const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName)

        if (isImage) {
          // Handle image import
          const formData = new FormData()
          formData.append('image', file)
          formData.append('prompt', `Imported image: ${fileName}`)
          formData.append('ideaId', idea.id)

          const response = await fetch('/api/import/image-file', {
            method: 'POST',
            body: formData
          })

          if (response.ok) {
            results.success.push(fileName)
          } else {
            results.failed.push(fileName)
          }
        } else {
          // Handle all other file types - upload to storage and save to idea
          try {
            const timestamp = Date.now()
            const fileExtension = fileName.split('.').pop()
            const sanitizedName = sanitizeFilename(fileName)
            const storageFileName = `${timestamp}-${sanitizedName}.${fileExtension}`
            const filePath = `${user.id}/ideas/${idea.id}/${storageFileName}`

            // Upload to storage
            const { data: uploadData, error: uploadError } = await getSupabaseClient().storage
              .from('cinema_files')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
              })

            if (uploadError) {
              console.error(`Storage upload error for ${fileName}:`, uploadError)
              results.failed.push(fileName)
              continue
            }

            // Get public URL
            const { data: { publicUrl } } = getSupabaseClient().storage
              .from('cinema_files')
              .getPublicUrl(filePath)

            // Save file reference to idea_images table
            const { data: fileData, error: dbError } = await getSupabaseClient()
              .from('idea_images')
              .insert({
                user_id: user.id,
                idea_id: idea.id,
                image_url: publicUrl,
                prompt: `Imported file: ${fileName}`,
                bucket_path: filePath
              })
              .select()
              .single()

            if (dbError) {
              console.error(`Database insert error for ${fileName}:`, dbError)
              results.failed.push(fileName)
            } else {
              results.success.push(fileName)
              console.log(`File ${fileName} uploaded and saved successfully for idea ${idea.id}`)
            }
          } catch (error) {
            console.error(`Error processing file ${fileName}:`, error)
            results.failed.push(fileName)
          }
        }
      } catch (error) {
        console.error(`Error importing ${file.name}:`, error)
        results.failed.push(file.name)
      }
    }

    // Show results and reload files
    if (results.success.length > 0) {
      toast({
        title: "Success",
        description: `Successfully imported ${results.success.length} file${results.success.length !== 1 ? 's' : ''}${results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}`,
      })
      // Reload idea to refresh files
      loadIdea()
    }

    if (results.failed.length > 0) {
      toast({
        title: "Some Files Failed",
        description: `Failed to import ${results.failed.length} file${results.failed.length !== 1 ? 's' : ''}: ${results.failed.join(', ')}`,
        variant: "destructive",
      })
    }
  }

  const handleExtractText = async (file: {url: string, name: string, type: string, id?: string}) => {
    try {
      console.log('🔄 Starting text extraction for:', file.name, file.url)
      setExtractingFile(file.name)
      
      const text = await extractTextFromFile(file.url, file.name, file.type)
      console.log('✅ Text extracted, length:', text.length)
      
      // Save the extracted text to the database
      // First, ensure we have the file record ID
      let fileRecordId = file.id
      
      if (!fileRecordId) {
        // Try to find the file record by URL
        console.log('🔍 File ID not found, searching by URL:', file.url)
        const allFiles = await IdeaImagesService.getIdeaImages(ideaId)
        const fileRecord = allFiles.find(f => f.image_url === file.url)
        
        if (fileRecord) {
          fileRecordId = fileRecord.id
          console.log('✅ Found file record with ID:', fileRecordId)
          // Update the file with the id
          setIdeaFiles(prev => prev.map(f => 
            f.name === file.name ? { ...f, id: fileRecord.id } : f
          ))
        } else {
          console.error('❌ File record not found in database for URL:', file.url)
          toast({
            title: "Text Extracted",
            description: `Text extracted from ${file.name} but could not save - file record not found in database`,
            variant: "destructive",
          })
          // Still update local state even if we can't save
          setFileTexts(prev => ({ ...prev, [file.name]: text }))
          setTextPages(prev => ({ ...prev, [file.name]: 1 }))
          setExtractingFile(null)
          return
        }
      }
      
      // Now save to database
      if (idea && user && fileRecordId) {
        const promptText = `Extracted text from ${file.name}:\n\n${text}`
        console.log('💾 Saving to database - File ID:', fileRecordId, 'Filename:', file.name, 'Text length:', text.length)
        
        const { data, error } = await getSupabaseClient()
          .from('idea_images')
          .update({ 
            prompt: promptText
          })
          .eq('id', fileRecordId)
          .select()
        
        if (error) {
          console.error('❌ Database error saving extracted text:', error)
          toast({
            title: "Text Extracted",
            description: `Text extracted but failed to save to database: ${error.message}`,
            variant: "destructive",
          })
          // Still update local state even if save fails
          setFileTexts(prev => ({ ...prev, [file.name]: text }))
          setTextPages(prev => ({ ...prev, [file.name]: 1 }))
          setExtractingFile(null)
          return
        } else {
          console.log('✅ Successfully saved to database:', data)
          
          // Verify the save by reading it back
          const { data: verifyData, error: verifyError } = await getSupabaseClient()
            .from('idea_images')
            .select('prompt')
            .eq('id', fileRecordId)
            .single()
          
          if (verifyError) {
            console.error('⚠️ Could not verify save:', verifyError)
          } else {
            console.log('✅ Verified save - prompt length:', verifyData?.prompt?.length || 0)
            if (verifyData?.prompt?.startsWith('Extracted text from')) {
              console.log('✅ Confirmed: Text is saved in correct format')
            }
          }
          
          toast({
            title: "Text Extracted & Saved",
            description: `Successfully extracted and saved text from ${file.name}. It will be available when you refresh the page.`,
          })
        }
      } else {
        console.error('❌ Missing required data - idea:', !!idea, 'user:', !!user, 'fileRecordId:', !!fileRecordId)
        toast({
          title: "Text Extracted",
          description: `Text extracted but could not save - missing required data`,
          variant: "destructive",
        })
        // Still update local state
        setFileTexts(prev => ({ ...prev, [file.name]: text }))
        setTextPages(prev => ({ ...prev, [file.name]: 1 }))
        setExtractingFile(null)
        return
      }
      
      // Update local state and show the text immediately
      // Use the same filename format that will be used when loading
      // This ensures consistency between save and load
      const fileNameKey = file.name
      console.log('💾 Setting file text in state for:', fileNameKey, 'Text length:', text.length)
      setFileTexts(prev => {
        const updated = { ...prev, [fileNameKey]: text }
        console.log('📝 Updated fileTexts:', Object.keys(updated))
        return updated
      })
      setTextPages(prev => ({ ...prev, [fileNameKey]: 1 })) // Reset to page 1 for new text
      
      console.log('✅ State updated, text should now be visible')
      
    } catch (error) {
      console.error('❌ Text extraction error:', error)
      toast({
        title: "Text Extraction Failed",
        description: `Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setExtractingFile(null)
      console.log('🏁 Text extraction finished for:', file.name)
    }
  }

  const getTextPage = (text: string, page: number): string => {
    const start = (page - 1) * textCharsPerPage
    const end = start + textCharsPerPage
    return text.substring(start, end)
  }

  const getTotalTextPages = (text: string): number => {
    return Math.ceil(text.length / textCharsPerPage)
  }

  const startEditing = (fileName: string) => {
    const fullText = fileTexts[fileName] || ""
    const currentPage = textPages[fileName] || 1
    const pageText = getTextPage(fullText, currentPage)
    
    setEditingFile(fileName)
    setEditingText(pageText)
    setTextSelection(null)
    
    // Auto-resize textarea after a brief delay to ensure it's rendered
    setTimeout(() => {
      const textarea = textareaRefs.current[fileName]
      if (textarea) {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto'
        // Set height based on content, with minimum of 200px
        const newHeight = Math.max(200, textarea.scrollHeight)
        textarea.style.height = `${newHeight}px`
      }
    }, 10)
  }

  const cancelEditing = () => {
    setEditingFile(null)
    setEditingText("")
    setTextSelection(null)
  }

  const saveEditing = async () => {
    if (editingFile) {
      const fullText = fileTexts[editingFile] || ""
      const currentPage = textPages[editingFile] || 1
      const start = (currentPage - 1) * textCharsPerPage
      const end = start + textCharsPerPage
      
      // Replace only the current page in the full text
      const before = fullText.substring(0, start)
      const after = fullText.substring(end)
      const updatedFullText = before + editingText + after
      
      // Update local state
      setFileTexts(prev => ({ ...prev, [editingFile]: updatedFullText }))
      
      // Save to database
      const file = ideaFiles.find(f => f.name === editingFile)
      if (file && file.id && idea && user) {
        try {
          const promptText = `Extracted text from ${editingFile}:\n\n${updatedFullText}`
          const { error } = await getSupabaseClient()
            .from('idea_images')
            .update({ prompt: promptText })
            .eq('id', file.id)
          
          if (error) {
            console.error('Error saving edited text:', error)
            toast({
              title: "Text Saved Locally",
              description: "Your edits were saved locally but failed to save to database",
              variant: "default",
            })
          } else {
            toast({
              title: "Text Saved",
              description: `Page ${currentPage} saved successfully`,
            })
          }
        } catch (error) {
          console.error('Error saving edited text:', error)
          toast({
            title: "Text Saved Locally",
            description: "Your edits were saved locally but failed to save to database",
            variant: "default",
          })
        }
      } else {
        toast({
          title: "Text Saved",
          description: `Page ${currentPage} saved successfully`,
        })
      }
      
      setEditingFile(null)
      setEditingText("")
      setTextSelection(null)
    }
  }

  const handleTextSelection = () => {
    const textarea = document.querySelector(`[data-file-editor="${editingFile}"]`) as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selected = editingText.substring(start, end)
      setTextSelection({ start, end })
      if (selected.trim()) {
        setSelectedText(selected)
        setAiEditData({
          selectedText: selected,
          fullContent: editingText
        })
      }
    }
  }

  const handleAITextReplace = (newText: string) => {
    if (editingFile && textSelection) {
      // Replace the selected text in the current page's editing text
      const before = editingText.substring(0, textSelection.start)
      const after = editingText.substring(textSelection.end)
      const updatedPageText = before + newText + after
      setEditingText(updatedPageText)
      setTextSelection(null)
      setSelectedText("")
      
      // Update the full text with the modified page
      const fullText = fileTexts[editingFile] || ""
      const currentPage = textPages[editingFile] || 1
      const start = (currentPage - 1) * textCharsPerPage
      const end = start + textCharsPerPage
      
      const beforeFull = fullText.substring(0, start)
      const afterFull = fullText.substring(end)
      const updatedFullText = beforeFull + updatedPageText + afterFull
      
      // Update the full text in state
      setFileTexts(prev => ({ ...prev, [editingFile]: updatedFullText }))
      
      // Save to database
      const file = ideaFiles.find(f => f.name === editingFile)
      if (file && file.id && idea && user) {
        const promptText = `Extracted text from ${editingFile}:\n\n${updatedFullText}`
        getSupabaseClient()
          .from('idea_images')
          .update({ prompt: promptText })
          .eq('id', file.id)
          .then(({ error }) => {
            if (error) {
              console.error('Error saving AI-enhanced text:', error)
            }
          })
      }
    }
  }

  const fetchTextEnhancerSettings = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('system_ai_config')
        .select('setting_key, setting_value')
        .in('setting_key', ['text_enhancer_model', 'text_enhancer_prefix'])

      if (error) {
        console.error('Error fetching text enhancer settings:', error)
        return
      }

      const settings: { model: string; prefix: string } = {
        model: 'gpt-4o-mini',
        prefix: ''
      }

      data?.forEach((item) => {
        if (item.setting_key === 'text_enhancer_model') {
          settings.model = item.setting_value || 'gpt-4o-mini'
        } else if (item.setting_key === 'text_enhancer_prefix') {
          settings.prefix = item.setting_value || ''
        }
      })

      setTextEnhancerSettings(settings)
    } catch (error) {
      console.error('Error fetching text enhancer settings:', error)
    }
  }

  const fetchUserApiKeys = async () => {
    if (!userId) return
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('users')
        .select('openai_api_key, anthropic_api_key')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user API keys:', error)
        return
      }

      setUserApiKeys({
        openai_api_key: data?.openai_api_key || undefined,
        anthropic_api_key: data?.anthropic_api_key || undefined
      })
    } catch (error) {
      console.error('Error fetching user API keys:', error)
    }
  }

  const enhanceCurrentPage = async () => {
    if (!editingFile || !editingText.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text to enhance",
        variant: "destructive",
      })
      return
    }

    if (!userApiKeys.openai_api_key && !userApiKeys.anthropic_api_key) {
      toast({
        title: "API Key Missing",
        description: "Please add your OpenAI or Anthropic API key in Settings → Profile",
        variant: "destructive",
      })
      return
    }

    setIsEnhancingText(true)
    
    try {
      const model = textEnhancerSettings.model
      const prefix = textEnhancerSettings.prefix || 'You are a professional text enhancer. Fix grammar, spelling, and enhance the writing while keeping the same context and meaning. Return only the enhanced text without explanations.\n\nEnhance the following text:'
      const fullPrompt = `${prefix}\n\n${editingText}`

      // Determine which API to use based on model
      const isAnthropic = model.startsWith('claude-')
      const apiKey = isAnthropic ? userApiKeys.anthropic_api_key : userApiKeys.openai_api_key

      if (!apiKey) {
        throw new Error(`API key missing for ${isAnthropic ? 'Anthropic' : 'OpenAI'}`)
      }

      let response
      if (isAnthropic) {
        // Use Anthropic API
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 4000,
            messages: [
              { role: 'user', content: fullPrompt }
            ],
          }),
        })

        if (!anthropicResponse.ok) {
          const errorData = await anthropicResponse.json()
          throw new Error(errorData.error?.message || 'Failed to enhance text')
        }

        const data = await anthropicResponse.json()
        response = data.content[0].text
      } else {
        // Use OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'user', content: fullPrompt }
            ],
            temperature: 0.7,
          }),
        })

        if (!openaiResponse.ok) {
          const errorData = await openaiResponse.json()
          throw new Error(errorData.error?.message || 'Failed to enhance text')
        }

        const data = await openaiResponse.json()
        response = data.choices[0].message.content
      }

      // Update the current page text with enhanced version
      setEditingText(response)
      
      // Update the full text
      const fullText = fileTexts[editingFile] || ""
      const currentPage = textPages[editingFile] || 1
      const start = (currentPage - 1) * textCharsPerPage
      const end = start + textCharsPerPage
      
      const before = fullText.substring(0, start)
      const after = fullText.substring(end)
      const updatedFullText = before + response + after
      
      // Update state
      setFileTexts(prev => ({ ...prev, [editingFile]: updatedFullText }))
      
      // Save to database
      const file = ideaFiles.find(f => f.name === editingFile)
      if (file && file.id && idea && user) {
        const promptText = `Extracted text from ${editingFile}:\n\n${updatedFullText}`
        const { error } = await getSupabaseClient()
          .from('idea_images')
          .update({ prompt: promptText })
          .eq('id', file.id)
        
        if (error) {
          console.error('Error saving enhanced text:', error)
          toast({
            title: "Text Enhanced",
            description: "Text was enhanced but failed to save to database",
            variant: "default",
          })
        } else {
          toast({
            title: "Text Enhanced & Saved",
            description: "Successfully enhanced and saved the current page",
          })
        }
      } else {
        toast({
          title: "Text Enhanced",
          description: "Successfully enhanced the current page",
        })
      }
      
      // Auto-resize textarea
      setTimeout(() => {
        const textarea = textareaRefs.current[editingFile]
        if (textarea) {
          textarea.style.height = 'auto'
          const newHeight = Math.max(200, textarea.scrollHeight)
          textarea.style.height = `${newHeight}px`
        }
      }, 10)
      
    } catch (error) {
      console.error('Error enhancing text:', error)
      toast({
        title: "Enhancement Failed",
        description: error instanceof Error ? error.message : 'Failed to enhance text',
        variant: "destructive",
      })
    } finally {
      setIsEnhancingText(false)
    }
  }

  const deleteIdea = async () => {
    if (!idea) return
    
    if (!confirm(`Are you sure you want to delete "${idea.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await MovieIdeasService.deleteIdea(idea.id)
      toast({
        title: "Success",
        description: "Idea deleted successfully"
      })
      router.push("/ideas")
    } catch (error) {
      console.error('Error deleting idea:', error)
      toast({
        title: "Error",
        description: "Failed to delete idea",
        variant: "destructive"
      })
    }
  }

  const saveEdit = async () => {
    if (!idea || !editTitle.trim() || !editMainCreator.trim()) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in Title and Main Creator.",
        variant: "destructive",
      })
      return
    }

    setIsSavingEdit(true)

    try {
      const updatedIdea = await MovieIdeasService.updateIdea(idea.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        genre: editGenres[0] || "Unspecified",
        genres: editGenres,
        main_creator: editMainCreator.trim(),
        co_creators: editCoCreators,
        synopsis: editSynopsis.trim() || undefined,
        status: editStatus,
      })

      setIdea(updatedIdea)
      setShowEditDialog(false)
      toast({
        title: "Success",
        description: "Idea updated successfully",
      })
    } catch (error) {
      console.error('Error updating idea:', error)
      toast({
        title: "Error",
        description: "Failed to update idea",
        variant: "destructive",
      })
    } finally {
      setIsSavingEdit(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concept": return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "development": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "pre-production": return "bg-orange-500/20 text-orange-400 border-orange-500/30"
      case "production": return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      case "post-production": return "bg-pink-500/20 text-pink-400 border-pink-500/30"
      case "completed": return "bg-green-500/20 text-green-400 border-green-500/30"
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30"
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!idea) {
    return null
  }

  return (
    <>
      <Navigation />
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-6xl overflow-x-hidden">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/ideas")}
            className="mb-3 sm:mb-4 text-xs sm:text-sm w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back to Ideas</span>
            <span className="sm:hidden">Back</span>
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 flex-1 min-w-0">
              {/* Cover Image Thumbnail */}
              {coverImage && (
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                  <div className="w-20 h-28 sm:w-24 sm:h-32 rounded-lg overflow-hidden border border-border cursor-pointer hover:opacity-90 transition-opacity"
                       onClick={() => setShowCoverImageDialog(true)}>
                    <img
                      src={coverImage}
                      alt={`Cover for ${idea.title}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 break-words">{idea.title}</h1>
                <div className="flex items-center gap-2 flex-wrap mb-4">
                {(idea.genres && idea.genres.length > 0 ? idea.genres : (idea.genre ? [idea.genre] : [])).map((g, index) => (
                  <Badge key={index} variant="secondary" className="text-xs sm:text-sm flex-shrink-0">
                    {g}
                  </Badge>
                ))}
                <Badge className={`text-xs sm:text-sm flex-shrink-0 ${getStatusColor(idea.status)}`}>
                  {idea.status}
                </Badge>
                {idea.main_creator && (
                  <Badge variant="outline" className="text-xs sm:text-sm flex-shrink-0">
                    <span className="hidden sm:inline">👤 </span>
                    {idea.main_creator}
                  </Badge>
                )}
              </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => router.push(`/ideas/${idea.id}/scenes`)}
                className="flex-1 sm:flex-initial text-xs sm:text-sm"
              >
                <List className="h-4 w-4 sm:mr-2" />
                Scenes
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (idea) {
                    setEditTitle(idea.title)
                    setEditDescription(idea.description || "")
                    setEditGenres(idea.genres && idea.genres.length > 0 ? idea.genres : (idea.genre ? [idea.genre] : []))
                    setEditMainCreator(idea.main_creator || "")
                    setEditCoCreators(idea.co_creators || [])
                    setEditSynopsis(idea.synopsis || "")
                    setEditStatus(idea.status as any)
                    setShowEditDialog(true)
                  }
                }}
                className="flex-1 sm:flex-initial text-xs sm:text-sm"
              >
                <Edit className="h-4 w-4 sm:mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={deleteIdea}
                className="flex-1 sm:flex-initial text-xs sm:text-sm"
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 overflow-x-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="treatment" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Treatment & Scenes</span>
              <span className="sm:hidden">Treatment</span>
            </TabsTrigger>
            <TabsTrigger value="content" className="text-xs sm:text-sm">Content</TabsTrigger>
            <TabsTrigger value="images" className="text-xs sm:text-sm">Images</TabsTrigger>
            <TabsTrigger value="files" className="text-xs sm:text-sm">Files</TabsTrigger>
            <TabsTrigger value="details" className="text-xs sm:text-sm">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            {/* Description */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Description</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <p className="text-xs sm:text-sm lg:text-base text-muted-foreground whitespace-pre-wrap break-words">
                  {idea.description || "No description provided."}
                </p>
              </CardContent>
            </Card>


            {/* Creator Information */}
            {(idea.main_creator || (idea.co_creators && idea.co_creators.length > 0)) && (
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Creators</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-4 sm:p-6">
                  {idea.main_creator && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="font-medium text-xs sm:text-sm">Main Creator:</span>
                      <span className="text-xs sm:text-sm break-words">{idea.main_creator}</span>
                    </div>
                  )}
                  {idea.co_creators && idea.co_creators.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="font-medium text-xs sm:text-sm">Co-Creators:</span>
                      <span className="text-xs sm:text-sm break-words">{idea.co_creators.join(", ")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="treatment" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            {/* Synopsis */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <CardTitle className="text-lg sm:text-xl">Synopsis</CardTitle>
                  {!editingSynopsis && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSynopsisValue(idea.synopsis || "")
                        setEditingSynopsis(true)
                      }}
                      className="w-full sm:w-auto text-xs sm:text-sm"
                    >
                      <Edit className="h-4 w-4 sm:mr-2" />
                      {idea.synopsis ? "Edit" : "Add"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {editingSynopsis ? (
                  <div className="space-y-3">
                    <Textarea
                      value={synopsisValue}
                      onChange={(e) => setSynopsisValue(e.target.value)}
                      placeholder="Paste or type synopsis here..."
                      className="min-h-[200px] font-mono text-xs sm:text-sm"
                      rows={8}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          setIsSavingSynopsis(true)
                          try {
                            const updatedIdea = await MovieIdeasService.updateIdea(idea.id, {
                              synopsis: synopsisValue.trim() || undefined,
                            })
                            setIdea(updatedIdea)
                            setEditingSynopsis(false)
                            toast({
                              title: "Success",
                              description: "Synopsis updated successfully",
                            })
                          } catch (error) {
                            console.error('Error saving synopsis:', error)
                            toast({
                              title: "Error",
                              description: "Failed to save synopsis",
                              variant: "destructive",
                            })
                          } finally {
                            setIsSavingSynopsis(false)
                          }
                        }}
                        disabled={isSavingSynopsis}
                      >
                        {isSavingSynopsis ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingSynopsis(false)
                          setSynopsisValue(idea.synopsis || "")
                        }}
                        disabled={isSavingSynopsis}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm lg:text-base text-muted-foreground whitespace-pre-wrap break-words">
                    {idea.synopsis || "No synopsis available. Click Edit to add one."}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Treatment */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <CardTitle className="text-lg sm:text-xl">Treatment</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {!editingTreatment && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (treatment) {
                            setTreatmentContent(treatment.prompt || "")
                          } else {
                            setTreatmentContent("")
                          }
                          setEditingTreatment(true)
                        }}
                        className="text-xs sm:text-sm flex-1 sm:flex-initial"
                      >
                        <Edit className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">{treatment ? "Edit" : "Add Treatment"}</span>
                        <span className="sm:hidden">{treatment ? "Edit" : "Add"}</span>
                      </Button>
                    )}
                    {!treatment && !editingTreatment && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/treatments?createFromIdea=${idea.id}`)}
                        className="text-xs sm:text-sm flex-1 sm:flex-initial"
                      >
                        <span className="hidden sm:inline">Create Treatment</span>
                        <span className="sm:hidden">Create</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {editingTreatment ? (
                  <div className="space-y-4">
                    {treatment && (
                      <div>
                        <h3 className="font-semibold mb-2 text-base sm:text-lg break-words">{treatment.title}</h3>
                        {treatment.synopsis && (
                          <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap mb-4 break-words">
                            {treatment.synopsis}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <Label className="text-xs sm:text-sm font-medium mb-2 block">Treatment Content:</Label>
                      <Textarea
                        value={treatmentContent}
                        onChange={(e) => setTreatmentContent(e.target.value)}
                        placeholder="Paste or type treatment content here..."
                        className="min-h-[300px] sm:min-h-[400px] font-mono text-xs sm:text-sm"
                        rows={15}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          setIsSavingTreatment(true)
                          try {
                            const supabase = getSupabaseClient()
                            
                            if (treatment) {
                              // Update existing treatment
                              const { error } = await supabase
                                .from('treatments')
                                .update({ prompt: treatmentContent.trim() })
                                .eq('id', treatment.id)
                              
                              if (error) throw error
                              
                              setTreatment({ ...treatment, prompt: treatmentContent.trim() })
                            } else {
                              // Create new treatment with content
                              const { data: newTreatment, error } = await supabase
                                .from('treatments')
                                .insert({
                                  user_id: userId,
                                  title: idea.title,
                                  genre: (idea.genres && idea.genres.length > 0 ? idea.genres[0] : idea.genre) || "Unspecified",
                                  status: 'draft',
                                  synopsis: idea.synopsis || idea.description || "",
                                  prompt: treatmentContent.trim(),
                                })
                                .select()
                                .single()
                              
                              if (error) throw error
                              
                              setTreatment(newTreatment)
                            }
                            
                            setEditingTreatment(false)
                            toast({
                              title: "Success",
                              description: treatment ? "Treatment content updated successfully" : "Treatment created successfully",
                            })
                          } catch (error) {
                            console.error('Error saving treatment:', error)
                            toast({
                              title: "Error",
                              description: "Failed to save treatment content",
                              variant: "destructive",
                            })
                          } finally {
                            setIsSavingTreatment(false)
                          }
                        }}
                        disabled={isSavingTreatment}
                      >
                        {isSavingTreatment ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingTreatment(false)
                          setTreatmentContent(treatment?.prompt || "")
                        }}
                        disabled={isSavingTreatment}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : treatment ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">{treatment.title}</h3>
                      {treatment.synopsis && (
                        <p className="text-muted-foreground whitespace-pre-wrap mb-4">
                          {treatment.synopsis}
                        </p>
                      )}
                      {treatment.prompt ? (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Treatment Content:</p>
                          <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                              {treatment.prompt}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 p-4 border border-dashed rounded-lg">
                          <p className="text-sm text-muted-foreground italic mb-2">
                            No treatment content yet. Click Edit to add content.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/treatments/${treatment.id}`)}
                      >
                        View Full Treatment
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">
                    No treatment created yet. Click "Add Treatment" to paste content, or "Create Treatment" to generate one from this idea.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Scenes */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <CardTitle className="text-lg sm:text-xl">Scenes</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/ideas/${idea.id}/scenes`)}
                    className="w-full sm:w-auto text-xs sm:text-sm"
                  >
                    <List className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Manage Scenes</span>
                    <span className="sm:hidden">Manage</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {loadingTreatmentScenes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : scenes.length > 0 ? (
                  <div className="space-y-4">
                    {scenes.map((scene, index) => (
                      <div key={scene.id} className="border rounded-lg p-3 sm:p-4 overflow-x-hidden">
                        {editingSceneId === scene.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Title</Label>
                                <Input
                                  value={editingSceneData.title}
                                  onChange={(e) => setEditingSceneData({ ...editingSceneData, title: e.target.value })}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Scene Number</Label>
                                <Input
                                  type="number"
                                  value={editingSceneData.scene_number || ""}
                                  onChange={(e) => setEditingSceneData({ ...editingSceneData, scene_number: parseInt(e.target.value) || 0 })}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Description</Label>
                              <Textarea
                                value={editingSceneData.description || ""}
                                onChange={(e) => setEditingSceneData({ ...editingSceneData, description: e.target.value })}
                                className="mt-1 min-h-[100px]"
                                placeholder="Paste or type scene description..."
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs sm:text-sm">Location</Label>
                                <Input
                                  value={editingSceneData.location || ""}
                                  onChange={(e) => setEditingSceneData({ ...editingSceneData, location: e.target.value })}
                                  className="mt-1 text-xs sm:text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs sm:text-sm">Duration (minutes)</Label>
                                <Input
                                  type="number"
                                  value={editingSceneData.duration_minutes || ""}
                                  onChange={(e) => setEditingSceneData({ ...editingSceneData, duration_minutes: parseInt(e.target.value) || 0 })}
                                  className="mt-1 text-xs sm:text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs sm:text-sm">Characters (comma separated)</Label>
                              <Input
                                value={Array.isArray(editingSceneData.characters) ? editingSceneData.characters.join(', ') : (editingSceneData.characters || "")}
                                onChange={(e) => {
                                  const chars = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')
                                  setEditingSceneData({ ...editingSceneData, characters: chars })
                                }}
                                className="mt-1 text-xs sm:text-sm"
                                placeholder="Character 1, Character 2"
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={async () => {
                                  setIsSavingScene(true)
                                  try {
                                    const supabase = getSupabaseClient()
                                    const { error } = await supabase
                                      .from('scenes')
                                      .update({
                                        title: editingSceneData.title,
                                        description: editingSceneData.description || null,
                                        scene_number: editingSceneData.scene_number || null,
                                        location: editingSceneData.location || null,
                                        duration_minutes: editingSceneData.duration_minutes || null,
                                        characters: editingSceneData.characters || [],
                                      })
                                      .eq('id', scene.id)
                                    
                                    if (error) throw error
                                    
                                    setScenes(scenes.map(s => s.id === scene.id ? editingSceneData : s))
                                    setEditingSceneId(null)
                                    setEditingSceneData(null)
                                    toast({
                                      title: "Success",
                                      description: "Scene updated successfully",
                                    })
                                  } catch (error) {
                                    console.error('Error saving scene:', error)
                                    toast({
                                      title: "Error",
                                      description: "Failed to save scene",
                                      variant: "destructive",
                                    })
                                  } finally {
                                    setIsSavingScene(false)
                                  }
                                }}
                                disabled={isSavingScene || !editingSceneData.title.trim()}
                              >
                                {isSavingScene ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingSceneId(null)
                                  setEditingSceneData(null)
                                }}
                                disabled={isSavingScene}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold">
                                  {scene.scene_number ? `Scene ${scene.scene_number}: ` : ''}
                                  {scene.title}
                                </h4>
                                {scene.location && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Location: {scene.location}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {scene.duration_minutes && (
                                  <Badge variant="secondary">
                                    {scene.duration_minutes} min
                                  </Badge>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingSceneId(scene.id)
                                    setEditingSceneData({ ...scene })
                                  }}
                                  className="gap-1"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                  Edit
                                </Button>
                              </div>
                            </div>
                            {scene.description ? (
                              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                                {scene.description}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground italic mt-2">
                                No description. Click Edit to add one.
                              </p>
                            )}
                            {scene.characters && scene.characters.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {scene.characters.map((char: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {char}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">
                    No scenes created yet. Click "Manage Scenes" to add scenes to this idea.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Original Prompt</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <p className="text-xs sm:text-sm lg:text-base text-muted-foreground whitespace-pre-wrap break-words">
                  {idea.original_prompt || idea.prompt || "No prompt available."}
                </p>
              </CardContent>
            </Card>

            {idea.prompt && idea.prompt !== idea.original_prompt && (
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Current Prompt</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs sm:text-sm lg:text-base text-muted-foreground whitespace-pre-wrap break-words">
                    {idea.prompt}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="images" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            {ideaImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {ideaImages.map((imageUrl, index) => (
                  <div key={index} className="aspect-square overflow-hidden rounded-lg border">
                    <img 
                      src={imageUrl} 
                      alt={`Idea image ${index + 1}`}
                      className="h-full w-full object-cover hover:scale-105 transition-transform cursor-pointer"
                      onClick={() => window.open(imageUrl, '_blank')}
                      title="Click to view full size"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 sm:py-12 text-center px-4">
                  <ImageIcon className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-xs sm:text-sm text-muted-foreground break-words">No images available for this idea.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="files" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
              <h3 className="text-base sm:text-lg font-semibold">Files</h3>
              <Button
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm w-full sm:w-auto"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.multiple = true
                  input.accept = '*/*'
                  input.onchange = async (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (!files || files.length === 0) return
                    
                    const fileArray = Array.from(files)
                    await handleImportFiles(fileArray)
                  }
                  input.click()
                }}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Import Files
              </Button>
            </div>
            
            {ideaFiles.length > 0 ? (
              <div className="space-y-4">
                {/* Pagination */}
                {ideaFiles.length > filesPerPage && (
                  <div className="flex items-center justify-between pb-4 border-b">
                    <div className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * filesPerPage + 1} to {Math.min(currentPage * filesPerPage, ideaFiles.length)} of {ideaFiles.length} files
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {Math.ceil(ideaFiles.length / filesPerPage)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(ideaFiles.length / filesPerPage), prev + 1))}
                        disabled={currentPage >= Math.ceil(ideaFiles.length / filesPerPage)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {ideaFiles.slice((currentPage - 1) * filesPerPage, currentPage * filesPerPage).map((file, index) => {
                  const fileText = fileTexts[file.name]
                  const isEditing = editingFile === file.name
                  
                  // Debug: Log if we have text for this file
                  if (fileText) {
                    console.log('✅ Found text for file:', file.name, 'Length:', fileText.length)
                  } else if (Object.keys(fileTexts).length > 0) {
                    console.log('❌ No text found for file:', file.name, 'Available keys:', Object.keys(fileTexts))
                  }
                  
                  return (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          {/* File Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-muted rounded-lg">
                                {file.type === 'pdf' ? (
                                  <FileText className="h-5 w-5 text-red-500" />
                                ) : file.type === 'doc' || file.type === 'docx' ? (
                                  <FileText className="h-5 w-5 text-blue-500" />
                                ) : file.type === 'txt' ? (
                                  <FileText className="h-5 w-5 text-gray-500" />
                                ) : (
                                  <File className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{file.name}</p>
                                <p className="text-sm text-muted-foreground uppercase">{file.type || 'file'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {canExtractText(file.type, file.name) && !fileText && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  type="button"
                                  onClick={async (e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    console.log('🖱️ Convert to Text button clicked for:', file.name, 'File:', file)
                                    try {
                                      await handleExtractText(file)
                                    } catch (err) {
                                      console.error('❌ Error in onClick handler:', err)
                                    }
                                  }}
                                  disabled={extractingFile === file.name}
                                  className="border-green-500/30 text-green-600 hover:bg-green-500/10 hover:border-green-500/50 transition-colors"
                                >
                                  {extractingFile === file.name ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4 mr-2" />
                                  )}
                                  Convert to Text
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(file.url)
                                    const blob = await response.blob()
                                    const blobUrl = window.URL.createObjectURL(blob)
                                    const link = document.createElement('a')
                                    link.href = blobUrl
                                    link.download = file.name
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                    window.URL.revokeObjectURL(blobUrl)
                                  } catch (error) {
                                    console.error('Download error:', error)
                                    toast({
                                      title: "Download Failed",
                                      description: "Failed to download file. Opening in new tab instead.",
                                      variant: "destructive",
                                    })
                                    window.open(file.url, '_blank')
                                  }
                                }}
                                className="transition-colors hover:bg-accent hover:text-accent-foreground"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>

                          {/* Text Content */}
                          {(fileText || fileTexts[file.name]) && (
                            <div className="bg-muted/20 p-4 rounded-lg border border-border">
                              {isEditing ? (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium text-muted-foreground">
                                      Editing Page {textPages[file.name] || 1} of {getTotalTextPages(fileText || fileTexts[file.name] || '')}
                                    </Label>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={enhanceCurrentPage}
                                        disabled={isEnhancingText}
                                        className="h-8 px-3 text-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                      >
                                        {isEnhancingText ? (
                                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        ) : (
                                          <Sparkles className="h-4 w-4 mr-1" />
                                        )}
                                        Enhance
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={saveEditing}
                                        className="h-8 px-3 text-sm border-green-500/30 text-green-400 hover:bg-green-500/10"
                                      >
                                        <Save className="h-4 w-4 mr-1" />
                                        Save
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={cancelEditing}
                                        className="h-8 px-3 text-sm border-red-500/30 text-red-400 hover:bg-red-500/10"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                  <Textarea
                                    ref={(el) => {
                                      if (el) textareaRefs.current[file.name] = el
                                    }}
                                    data-file-editor={file.name}
                                    value={editingText}
                                    onChange={(e) => {
                                      setEditingText(e.target.value)
                                      // Auto-resize on input to match content
                                      const textarea = e.target
                                      textarea.style.height = 'auto'
                                      const newHeight = Math.max(200, textarea.scrollHeight)
                                      textarea.style.height = `${newHeight}px`
                                    }}
                                    onSelect={handleTextSelection}
                                    placeholder="Edit your text content here..."
                                    className="w-full min-h-[200px] p-4 border border-primary/30 focus:border-primary bg-background text-foreground resize-none font-mono text-sm leading-relaxed"
                                    style={{ 
                                      minHeight: '200px',
                                      overflow: 'hidden'
                                    }}
                                    autoFocus
                                  />
                                  
                                  {/* Text Selection Actions */}
                                  {textSelection && selectedText && (
                                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border">
                                      <span className="text-xs text-muted-foreground">
                                        Selected: {selectedText.length} characters
                                      </span>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            navigator.clipboard.writeText(selectedText)
                                            toast({
                                              title: "Copied!",
                                              description: "Selected text copied to clipboard",
                                            })
                                          }}
                                          className="h-6 px-2 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                        >
                                          <Copy className="h-3 w-3 mr-1" />
                                          Copy
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            if (textSelection) {
                                              const before = editingText.substring(0, textSelection.start)
                                              const after = editingText.substring(textSelection.end)
                                              setEditingText(before + after)
                                              setTextSelection(null)
                                              setSelectedText("")
                                              toast({
                                                title: "Cleared!",
                                                description: "Selected text has been removed",
                                              })
                                            }
                                          }}
                                          className="h-6 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                        >
                                          <Trash2 className="h-3 w-3 mr-1" />
                                          Clear
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setShowAITextEditor(true)
                                          }}
                                          className="h-6 px-2 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                        >
                                          <Sparkles className="h-3 w-3 mr-1" />
                                          AI Edit
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <Label className="text-sm font-medium">Extracted Text</Label>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                          // Get full text from fileTexts, not just current page
                                          const fullText = fileTexts[file.name] || fileText || ''
                                          if (!fullText.trim()) {
                                            toast({
                                              title: "No Text",
                                              description: "No text available to save. Please extract text first.",
                                              variant: "destructive",
                                            })
                                            return
                                          }
                                          
                                          try {
                                            const updatedIdea = await MovieIdeasService.updateIdea(idea.id, {
                                              synopsis: fullText.trim(),
                                            })
                                            setIdea(updatedIdea)
                                            toast({
                                              title: "Success",
                                              description: "Text saved to synopsis",
                                            })
                                          } catch (error) {
                                            console.error('Error saving to synopsis:', error)
                                            toast({
                                              title: "Error",
                                              description: "Failed to save to synopsis",
                                              variant: "destructive",
                                            })
                                          }
                                        }}
                                        className="h-7 px-2 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                        disabled={!fileTexts[file.name] && !fileText}
                                      >
                                        <Save className="h-3 w-3 mr-1" />
                                        Save to Synopsis
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                          // Get full text from fileTexts, not just current page
                                          const fullText = fileTexts[file.name] || fileText || ''
                                          if (!fullText.trim()) {
                                            toast({
                                              title: "No Text",
                                              description: "No text available to save. Please extract text first.",
                                              variant: "destructive",
                                            })
                                            return
                                          }
                                          
                                          try {
                                            const supabase = getSupabaseClient()
                                            
                                            if (treatment) {
                                              console.log('💾 Updating existing treatment:', treatment.id, 'with', fullText.trim().length, 'characters')
                                              
                                              // Update existing treatment
                                              const { error: updateError } = await supabase
                                                .from('treatments')
                                                .update({ prompt: fullText.trim() })
                                                .eq('id', treatment.id)
                                              
                                              if (updateError) {
                                                console.error('❌ Error updating treatment:', updateError)
                                                throw updateError
                                              }
                                              
                                              console.log('✅ Treatment updated successfully, reloading...')
                                              
                                              // Reload the treatment to get the latest data
                                              const { data: updatedTreatment, error: reloadError } = await supabase
                                                .from('treatments')
                                                .select('*')
                                                .eq('id', treatment.id)
                                                .single()
                                              
                                              if (reloadError) {
                                                console.error('❌ Error reloading treatment:', reloadError)
                                              }
                                              
                                              if (updatedTreatment) {
                                                console.log('✅ Reloaded treatment:', {
                                                  id: updatedTreatment.id,
                                                  hasPrompt: !!updatedTreatment.prompt,
                                                  promptLength: updatedTreatment.prompt?.length || 0
                                                })
                                                setTreatment(updatedTreatment)
                                                setTreatmentContent(updatedTreatment.prompt || "")
                                              } else {
                                                console.warn('⚠️ Updated treatment not found, using local state')
                                                const updated = { ...treatment, prompt: fullText.trim() }
                                                setTreatment(updated)
                                                setTreatmentContent(fullText.trim())
                                              }
                                              
                                              // Also reload to ensure everything is in sync
                                              await loadTreatmentAndScenes()
                                              
                                              toast({
                                                title: "Success",
                                                description: "Text saved to treatment",
                                              })
                                            } else {
                                              console.log('💾 Creating new treatment with', fullText.trim().length, 'characters')
                                              
                                              // Create new treatment with content
                                              const { data: newTreatment, error: insertError } = await supabase
                                                .from('treatments')
                                                .insert({
                                                  user_id: userId,
                                                  title: idea.title,
                                                  genre: (idea.genres && idea.genres.length > 0 ? idea.genres[0] : idea.genre) || "Unspecified",
                                                  status: 'draft',
                                                  synopsis: idea.synopsis || idea.description || "",
                                                  prompt: fullText.trim(),
                                                })
                                                .select()
                                                .single()
                                              
                                              if (insertError) {
                                                console.error('❌ Error creating treatment:', insertError)
                                                throw insertError
                                              }
                                              
                                              console.log('✅ Treatment created:', {
                                                id: newTreatment.id,
                                                title: newTreatment.title,
                                                hasPrompt: !!newTreatment.prompt,
                                                promptLength: newTreatment.prompt?.length || 0
                                              })
                                              
                                              setTreatment(newTreatment)
                                              setTreatmentContent(newTreatment.prompt || "")
                                              
                                              // Reload treatment and scenes to ensure everything is in sync
                                              await loadTreatmentAndScenes()
                                              
                                              toast({
                                                title: "Success",
                                                description: "Treatment created with text content",
                                              })
                                            }
                                          } catch (error) {
                                            console.error('❌ Error saving to treatment:', error)
                                            toast({
                                              title: "Error",
                                              description: error instanceof Error ? error.message : "Failed to save to treatment",
                                              variant: "destructive",
                                            })
                                          }
                                        }}
                                        className="h-7 px-2 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                        disabled={!fileTexts[file.name] && !fileText}
                                      >
                                        <Save className="h-3 w-3 mr-1" />
                                        Save to Treatment
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="group relative">
                                    <pre className="text-sm text-foreground whitespace-pre-wrap font-mono min-h-[200px] p-4 bg-muted/10 rounded border border-border">
                                      {getTextPage(fileText || fileTexts[file.name] || '', textPages[file.name] || 1)}
                                    </pre>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startEditing(file.name)}
                                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    >
                                      <Edit className="h-4 w-4 mr-1" />
                                      Edit
                                    </Button>
                                  </div>
                                  
                                  {/* Text Pagination */}
                                  {getTotalTextPages(fileText || fileTexts[file.name] || '') > 1 && (
                                    <div className="flex items-center justify-between pt-2 border-t">
                                      <div className="text-xs text-muted-foreground">
                                        Page {textPages[file.name] || 1} of {getTotalTextPages(fileText || fileTexts[file.name] || '')} 
                                        ({(textPages[file.name] || 1) * textCharsPerPage - textCharsPerPage + 1} - {Math.min((textPages[file.name] || 1) * textCharsPerPage, (fileText || fileTexts[file.name] || '').length)} of {(fileText || fileTexts[file.name] || '').length} characters)
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setTextPages(prev => ({ ...prev, [file.name]: Math.max(1, (prev[file.name] || 1) - 1) }))}
                                          disabled={(textPages[file.name] || 1) === 1}
                                          className="h-7 px-2 text-xs"
                                        >
                                          <ChevronLeft className="h-3 w-3 mr-1" />
                                          Previous
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setTextPages(prev => ({ ...prev, [file.name]: Math.min(getTotalTextPages(fileText || fileTexts[file.name] || ''), (prev[file.name] || 1) + 1) }))}
                                          disabled={(textPages[file.name] || 1) >= getTotalTextPages(fileText || fileTexts[file.name] || '')}
                                          className="h-7 px-2 text-xs"
                                        >
                                          Next
                                          <ChevronRight className="h-3 w-3 ml-1" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <File className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No files available for this idea.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Status</span>
                    <p className="mt-1">{idea.status}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Created</span>
                    <p className="mt-1">
                      {idea.created_at ? new Date(idea.created_at).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Last Updated</span>
                    <p className="mt-1">
                      {idea.updated_at ? new Date(idea.updated_at).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">ID</span>
                    <p className="mt-1 font-mono text-xs">{idea.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* AI Text Editor */}
        {showAITextEditor && aiEditData && (
          <AITextEditor
            isOpen={showAITextEditor}
            onClose={() => {
              setShowAITextEditor(false)
              setSelectedText("")
              setAiEditData(null)
              setTextSelection(null)
            }}
            selectedText={aiEditData.selectedText}
            fullContent={aiEditData.fullContent}
            onTextReplace={handleAITextReplace}
            contentType="script"
          />
        )}
      </div>

      {/* Cover Image Dialog */}
      {coverImage && (
        <Dialog open={showCoverImageDialog} onOpenChange={setShowCoverImageDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl p-4 sm:p-6">
            <DialogHeader className="pb-4 sm:pb-6">
              <DialogTitle className="text-lg sm:text-xl break-words">Cover Image - {idea.title}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-2 sm:p-4">
              <img
                src={coverImage}
                alt={`Cover for ${idea.title}`}
                className="max-w-full max-h-[70vh] sm:max-h-[80vh] object-contain rounded-lg"
              />
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => window.open(coverImage, '_blank')} className="w-full sm:w-auto text-xs sm:text-sm">
                <span className="hidden sm:inline">Open in New Tab</span>
                <span className="sm:hidden">Open</span>
              </Button>
              <Button onClick={() => setShowCoverImageDialog(false)} className="w-full sm:w-auto text-xs sm:text-sm">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Idea Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-4 sm:pb-6">
            <DialogTitle className="text-lg sm:text-xl">Edit Movie Idea</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Update your movie idea details
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder=""
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-genres">Genres</Label>
                </div>
                {editGenres.length > 0 && (
                  <div className="flex flex-wrap gap-2 py-2">
                    {editGenres.map((g) => (
                      <Badge 
                        key={g} 
                        variant="secondary" 
                        className="flex items-center gap-1"
                      >
                        {g}
                        <button
                          type="button"
                          onClick={() => {
                            setEditGenres(editGenres.filter(genre => genre !== g))
                          }}
                          className="ml-1 hover:text-destructive focus:outline-none"
                          aria-label={`Remove ${g}`}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      Select Genres
                      <ChevronDown className="h-3 w-3 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3">
                    <div className="max-h-56 overflow-y-auto">
                      <div className="grid grid-cols-1 gap-2">
                        {genres.map((g) => {
                          const isSelected = editGenres.includes(g)
                          return (
                            <div key={g} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-genre-${g}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setEditGenres([...editGenres, g])
                                  } else {
                                    setEditGenres(editGenres.filter(item => item !== g))
                                  }
                                }}
                              />
                              <label htmlFor={`edit-genre-${g}`} className="text-sm leading-none">
                                {g}
                              </label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-main-creator" className="text-xs sm:text-sm">Main Creator *</Label>
                <Input
                  id="edit-main-creator"
                  value={editMainCreator}
                  onChange={(e) => setEditMainCreator(e.target.value)}
                  placeholder=""
                  className="text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label htmlFor="edit-co-creators" className="text-xs sm:text-sm">Co-Creators</Label>
                <Input
                  id="edit-co-creators"
                  value={editCoCreators.join(', ')}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value.trim() === '') {
                      setEditCoCreators([])
                    } else {
                      setEditCoCreators(value.split(',').map(s => s.trim()).filter(s => s !== ''))
                    }
                  }}
                  placeholder=""
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-description" className="text-xs sm:text-sm">Description *</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder=""
                rows={3}
                className="text-xs sm:text-sm"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-synopsis" className="text-xs sm:text-sm">Synopsis</Label>
              <Textarea
                id="edit-synopsis"
                value={editSynopsis}
                onChange={(e) => setEditSynopsis(e.target.value)}
                placeholder=""
                rows={4}
                className="text-xs sm:text-sm"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-status" className="text-xs sm:text-sm">Status</Label>
              <Select value={editStatus} onValueChange={(value: any) => setEditStatus(value)}>
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concept" className="text-xs sm:text-sm">Concept</SelectItem>
                  <SelectItem value="development" className="text-xs sm:text-sm">Development</SelectItem>
                  <SelectItem value="pre-production" className="text-xs sm:text-sm">Pre-Production</SelectItem>
                  <SelectItem value="production" className="text-xs sm:text-sm">Production</SelectItem>
                  <SelectItem value="post-production" className="text-xs sm:text-sm">Post-Production</SelectItem>
                  <SelectItem value="completed" className="text-xs sm:text-sm">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSavingEdit} className="w-full sm:w-auto text-xs sm:text-sm">
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={isSavingEdit} className="w-full sm:w-auto text-xs sm:text-sm">
              {isSavingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                  <span className="sm:hidden">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Save Changes</span>
                  <span className="sm:hidden">Save</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

