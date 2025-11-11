"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useAuthReady } from "@/components/auth-hooks"
import { getSupabaseClient } from "@/lib/supabase"
import { GlobalAISetting } from "@/lib/ai-chat-types"
import { useToast } from "@/hooks/use-toast"
import { Save, Sparkles, Plus, X, Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface PromptSection {
  name: string
  content: string
}

// Parse prompt into sections with names (split by ### or ## headers)
function parsePromptIntoSections(prompt: string): PromptSection[] {
  if (!prompt) return [{ name: '', content: '' }]
  
  const sections: PromptSection[] = []
  const lines = prompt.split('\n')
  let currentSection: PromptSection | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Check if line is a header (starts with ### or ##)
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/)
    
    if (headerMatch) {
      // Save previous section if it exists
      if (currentSection) {
        sections.push(currentSection)
      }
      // Start new section with header name
      currentSection = {
        name: headerMatch[2].trim(),
        content: ''
      }
    } else {
      // Add line to current section's content
      if (currentSection) {
        // Add to existing section
        if (currentSection.content) {
          currentSection.content += '\n' + line
        } else {
          currentSection.content = line
        }
      } else {
        // No header found yet, create a section without a name
        currentSection = {
          name: '',
          content: line
        }
      }
    }
  }
  
  // Add the last section
  if (currentSection) {
    sections.push(currentSection)
  }
  
  // Clean up content (remove leading/trailing whitespace from each section)
  sections.forEach(section => {
    section.content = section.content.trim()
  })
  
  // If no sections found, return one section with the full prompt
  if (sections.length === 0) {
    return [{ name: '', content: prompt.trim() }]
  }
  
  return sections
}

// Combine sections back into full prompt with headers
function combineSections(sections: PromptSection[]): string {
  return sections
    .filter(s => s.name.trim() || s.content.trim())
    .map(s => {
      if (s.name.trim() && s.content.trim()) {
        return `### ${s.name}\n\n${s.content}`
      } else if (s.content.trim()) {
        return s.content
      }
      return ''
    })
    .filter(s => s.trim())
    .join('\n\n')
}

export default function AIInfoPage() {
  const { user, userId, ready } = useAuthReady()
  const router = useRouter()
  const { toast } = useToast()
  const [sections, setSections] = useState<PromptSection[]>([{ name: '', content: '' }])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userRole, setUserRole] = useState<string>('user')
  const [hasAccess, setHasAccess] = useState(false)

  // Check if user is CEO or Admin
  useEffect(() => {
    if (!ready || !userId || !user) return

    const checkAccess = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single()

        if (error) {
          console.error('Error fetching user role:', error)
          // Try by email as fallback
          if (user.email) {
            const { data: emailData, error: emailError } = await supabase
              .from('users')
              .select('role')
              .eq('email', user.email)
              .single()
            
            if (!emailError && emailData) {
              const role = emailData?.role || 'user'
              setUserRole(role)
              if (role === 'ceo' || role === 'admin') {
                setHasAccess(true)
                loadSystemPrompt()
                return
              }
            }
          }
          router.push('/')
          return
        }

        const role = data?.role || 'user'
        console.log('🔍 AI Info Page - User role:', role)
        setUserRole(role)

        if (role === 'ceo' || role === 'admin') {
          setHasAccess(true)
          loadSystemPrompt()
        } else {
          // Redirect non-admin users
          console.log('❌ Access denied - user role:', role)
          router.push('/')
        }
      } catch (error) {
        console.error('Error checking access:', error)
        router.push('/')
      }
    }

    checkAccess()
  }, [ready, userId, user, router])

  const loadSystemPrompt = async () => {
    try {
      setIsLoading(true)
      const supabase = getSupabaseClient()
      console.log('🔍 Loading system prompt for user:', userId)
      const { data, error } = await supabase
        .from('system_ai_config')
        .select('setting_key, setting_value')
        .eq('setting_key', 'system_prompt')
        .maybeSingle()

      if (error) {
        console.error('❌ Error loading system prompt:', error)
        if (error.code === '42501' || error.message?.includes('permission')) {
          toast({
            title: "Permission Denied",
            description: "You don't have permission to access this. Make sure your role is 'ceo' or 'admin' and RLS policies are updated.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error",
            description: `Failed to load system prompt: ${error.message}`,
            variant: "destructive",
          })
        }
        throw error
      }

      const prompt = (data as GlobalAISetting | null)?.setting_value || ''
      console.log('✅ System prompt loaded, length:', prompt.length)
      setSections(parsePromptIntoSections(prompt))
    } catch (error) {
      console.error('Error loading system prompt:', error)
      // Don't show toast if already shown above
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const fullPrompt = combineSections(sections)

      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('system_ai_config')
        .upsert({
          setting_key: 'system_prompt',
          setting_value: fullPrompt,
          description: 'The system prompt that defines how Covion Intelligence behaves.',
        }, {
          onConflict: 'setting_key',
        })

      if (error) throw error

      toast({
        title: "Success",
        description: "System prompt saved successfully",
      })
    } catch (error) {
      console.error('Error saving system prompt:', error)
      toast({
        title: "Error",
        description: "Failed to save system prompt",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEnhancePrompt = async () => {
    try {
      setIsSaving(true)
      const fullPrompt = combineSections(sections)

      const response = await fetch('/api/generate-ai-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: fullPrompt }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate enhanced prompt')
      }

      const data = await response.json()
      const improvedPrompt = data.prompt

      if (improvedPrompt) {
        setSections(parsePromptIntoSections(improvedPrompt))
        toast({
          title: "Success",
          description: "Prompt enhanced successfully",
        })
      }
    } catch (error) {
      console.error('Error enhancing prompt:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to enhance prompt",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const addSection = () => {
    setSections([...sections, { name: '', content: '' }])
  }

  const removeSection = (index: number) => {
    if (sections.length > 1) {
      setSections(sections.filter((_, i) => i !== index))
    }
  }

  const updateSectionName = (index: number, name: string) => {
    const newSections = [...sections]
    newSections[index] = { ...newSections[index], name }
    setSections(newSections)
  }

  const updateSectionContent = (index: number, content: string) => {
    const newSections = [...sections]
    newSections[index] = { ...newSections[index], content }
    setSections(newSections)
  }

  if (!ready || isLoading || !hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  if (userRole !== 'ceo' && userRole !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">AI System Prompt</h1>
          <p className="text-muted-foreground">
            Configure the system prompt that defines how Covion Intelligence behaves.
          </p>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Only users with CEO or Admin role can access and modify the system prompt. Changes will affect all AI chat interactions.
          </AlertDescription>
        </Alert>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Prompt Sections</CardTitle>
            <CardDescription>
              Edit the system prompt sections. Each section can have a name and content. Sections will be saved with headers (### Section Name).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sections.map((section, index) => (
              <div key={index} className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`section-name-${index}`} className="text-sm font-medium">
                      Section Name {index + 1}
                    </Label>
                    <Input
                      id={`section-name-${index}`}
                      value={section.name}
                      onChange={(e) => updateSectionName(index, e.target.value)}
                      placeholder="e.g., Role, Core Principles, Guidelines..."
                      className="font-medium"
                    />
                  </div>
                  {sections.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSection(index)}
                      className="mt-6"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`section-content-${index}`} className="text-sm font-medium">
                    Content
                  </Label>
                  <Textarea
                    id={`section-content-${index}`}
                    value={section.content}
                    onChange={(e) => updateSectionContent(index, e.target.value)}
                    placeholder="Enter section content..."
                    className="min-h-[150px] font-mono text-sm"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={addSection}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
          <Button
            onClick={handleEnhancePrompt}
            disabled={isSaving}
            variant="outline"
            className="flex-1"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enhancing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Enhance with AI
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

