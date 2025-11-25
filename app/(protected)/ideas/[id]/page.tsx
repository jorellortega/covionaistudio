"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit, Trash2, Image as ImageIcon, FileText, Film, Wand2, Loader2, List, File, Download, Sparkles, Eye, Copy, Save, Upload, ChevronLeft, ChevronRight } from "lucide-react"
import { useAuthReady } from "@/components/auth-hooks"
import { MovieIdeasService, type MovieIdea } from "@/lib/movie-ideas-service"
import { IdeaImagesService } from "@/lib/idea-images-service"
import { getSupabaseClient } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import { Navigation } from "@/components/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import AITextEditor from "@/components/ai-text-editor"

export default function IdeaDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, userId, ready } = useAuthReady()
  const [idea, setIdea] = useState<MovieIdea | null>(null)
  const [ideaImages, setIdeaImages] = useState<string[]>([])
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

  const ideaId = params.id as string

  useEffect(() => {
    if (ready && userId && ideaId) {
      loadIdea()
      fetchTextEnhancerSettings()
      fetchUserApiKeys()
    }
  }, [ready, userId, ideaId])

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
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/ideas")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Ideas
          </Button>
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{idea.title}</h1>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {(idea.genres && idea.genres.length > 0 ? idea.genres : (idea.genre ? [idea.genre] : [])).map((g, index) => (
                  <Badge key={index} variant="secondary" className="text-sm">
                    {g}
                  </Badge>
                ))}
                <Badge className={`text-sm ${getStatusColor(idea.status)}`}>
                  {idea.status}
                </Badge>
                {idea.main_creator && (
                  <Badge variant="outline" className="text-sm">
                    👤 {idea.main_creator}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/ideas/${idea.id}/scenes`)}
              >
                <List className="h-4 w-4 mr-2" />
                Scenes
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/ideas?edit=${idea.id}`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={deleteIdea}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {idea.description || "No description provided."}
                </p>
              </CardContent>
            </Card>

            {/* Synopsis */}
            {idea.synopsis && (
              <Card>
                <CardHeader>
                  <CardTitle>Synopsis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {idea.synopsis}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Creator Information */}
            {(idea.main_creator || (idea.co_creators && idea.co_creators.length > 0)) && (
              <Card>
                <CardHeader>
                  <CardTitle>Creators</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {idea.main_creator && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Main Creator:</span>
                      <span>{idea.main_creator}</span>
                    </div>
                  )}
                  {idea.co_creators && idea.co_creators.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Co-Creators:</span>
                      <span>{idea.co_creators.join(", ")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="content" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Original Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {idea.original_prompt || idea.prompt || "No prompt available."}
                </p>
              </CardContent>
            </Card>

            {idea.prompt && idea.prompt !== idea.original_prompt && (
              <Card>
                <CardHeader>
                  <CardTitle>Current Prompt</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {idea.prompt}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="images" className="space-y-6 mt-6">
            {ideaImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                <CardContent className="py-12 text-center">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No images available for this idea.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="files" className="space-y-6 mt-6">
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

          <TabsContent value="details" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
    </>
  )
}

