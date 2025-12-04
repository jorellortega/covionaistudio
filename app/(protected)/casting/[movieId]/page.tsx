"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useAuthReady } from "@/components/auth-hooks"
import { 
  Settings, 
  Film, 
  Users, 
  Upload, 
  Plus, 
  X,
  Loader2,
  Calendar,
  Mail,
  Phone,
  FileText,
  Image as ImageIcon,
  Video,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  Star,
  User,
  Save,
  Edit,
  Share2
} from "lucide-react"
import { CastingService, type CastingSetting, type ActorSubmission } from "@/lib/casting-service"
import { MovieService, type Movie } from "@/lib/movie-service"
import { StoryboardsService, type Storyboard } from "@/lib/storyboards-service"
import { CharactersService, type Character } from "@/lib/characters-service"
import { getSupabaseClient } from "@/lib/supabase"
import Link from "next/link"

const statusColors = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  reviewing: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  shortlisted: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  accepted: "bg-purple-500/20 text-purple-400 border-purple-500/30",
}

export default function CastingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const movieId = params?.movieId as string
  const isPublicView = searchParams?.get('view') === 'public'
  
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  const router = useRouter()

  // State
  const [movie, setMovie] = useState<Movie | null>(null)
  const [castingSettings, setCastingSettings] = useState<CastingSetting | null>(null)
  const [submissions, setSubmissions] = useState<ActorSubmission[]>([])
  const [scenes, setScenes] = useState<any[]>([])
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [timeline, setTimeline] = useState<any>(null)
  const [treatment, setTreatment] = useState<any>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSubmissionForm, setShowSubmissionForm] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<ActorSubmission | null>(null)
  
  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    show_script: false,
    show_scenes: false,
    show_timeline: false,
    show_storyboard: false,
    roles_available: [] as string[],
    show_character_types: ['main', 'supporting'] as string[],
    submission_deadline: '',
    casting_notes: '',
    is_active: true,
  })
  
  const [roleInput, setRoleInput] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  
  // Submission form state
  const [submissionForm, setSubmissionForm] = useState({
    actor_name: '',
    actor_email: '',
    actor_phone: '',
    role_applying_for: '',
    cover_letter: '',
    experience: '',
  })
  
  const [headshotFile, setHeadshotFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [additionalPhotos, setAdditionalPhotos] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load data
  useEffect(() => {
    if (movieId) {
      // Load even if not ready (for unauthenticated users)
      if (ready || !user) {
        loadData()
      }
    }
  }, [ready, movieId, user])

  const loadData = async () => {
    try {
      setLoading(true)
      
      let movieData: Movie | null = null
      
      // Try to load movie - authenticated users get full access check
      if (user && userId) {
        movieData = await MovieService.getMovieById(movieId)
      } else {
        // For unauthenticated users, try to load movie directly if casting is active
        try {
          const { data, error } = await getSupabaseClient()
            .from('projects')
            .select('*')
            .eq('id', movieId)
            .eq('project_type', 'movie')
            .maybeSingle()
          
          if (!error && data) {
            movieData = data as Movie
          }
        } catch (error) {
          console.error('Error loading movie for public view:', error)
        }
      }
      
      if (!movieData) {
        // Check if casting is active - if so, allow public access
        const { data: settingsData } = await getSupabaseClient()
          .from('casting_settings')
          .select('is_active')
          .eq('movie_id', movieId)
          .maybeSingle()
        
        if (settingsData?.is_active) {
          // Casting is active, load movie for public view
          const { data, error } = await getSupabaseClient()
            .from('projects')
            .select('*')
            .eq('id', movieId)
            .eq('project_type', 'movie')
            .maybeSingle()
          
          if (!error && data) {
            movieData = data as Movie
          }
        }
      }
      
      if (!movieData) {
        toast({
          title: "Access Denied",
          description: "You don't have access to this project.",
          variant: "destructive",
        })
        if (user) {
          router.push('/movies')
        }
        return
      }
      
      setMovie(movieData)
      
      // Check if user is owner (only if authenticated)
      const owner = user && userId && movieData?.user_id === userId
      setIsOwner(owner || false)
      
      // Load casting settings (works for both authenticated and unauthenticated)
      let settings: CastingSetting | null = null
      try {
        const { data: settingsData, error: settingsError } = await getSupabaseClient()
          .from('casting_settings')
          .select('*')
          .eq('movie_id', movieId)
          .maybeSingle()
        
        if (!settingsError && settingsData) {
          settings = settingsData as CastingSetting
        }
      } catch (error) {
        console.error('Error loading casting settings:', error)
      }
      
      setCastingSettings(settings)
      
      if (settings) {
        // Convert ISO datetime to datetime-local format
        const deadlineValue = settings.submission_deadline 
          ? new Date(settings.submission_deadline).toISOString().slice(0, 16)
          : ''
        
        setSettingsForm({
          show_script: settings.show_script,
          show_scenes: settings.show_scenes,
          show_timeline: settings.show_timeline,
          show_storyboard: settings.show_storyboard,
          roles_available: settings.roles_available || [],
          show_character_types: settings.show_character_types || ['main', 'supporting'],
          submission_deadline: deadlineValue,
          casting_notes: settings.casting_notes || '',
          is_active: settings.is_active,
        })
      }
      
      // If owner, load submissions
      if (owner) {
        const submissionsData = await CastingService.getSubmissionsForMovie(movieId)
        setSubmissions(submissionsData)
      }
      
      // Load characters for this project (works for both authenticated and unauthenticated)
      try {
        if (user) {
          // Authenticated users use the service
          const charactersData = await CharactersService.getCharacters(movieId)
          setCharacters(charactersData)
        } else {
          // Unauthenticated users query directly
          const { data: charactersData, error: charsError } = await getSupabaseClient()
            .from('characters')
            .select('*')
            .eq('project_id', movieId)
            .order('updated_at', { ascending: false })
          
          if (!charsError && charactersData) {
            setCharacters(charactersData as Character[])
          }
        }
      } catch (error) {
        console.error('Error loading characters:', error)
        // Don't fail the whole page if characters fail to load
      }
      
      // Load additional data based on settings
      if (settings) {
        if (settings.show_script) {
          try {
            // Get treatment for this project
            const { data: treatmentData } = await getSupabaseClient()
              .from('treatments')
              .select('*')
              .eq('project_id', movieId)
              .maybeSingle()

            if (treatmentData) {
              setTreatment(treatmentData)
            }
          } catch (error) {
            console.error('Error loading treatment:', error)
          }
        }

        if (settings.show_scenes) {
          try {
            // Get timeline first, then scenes
            // RLS policy will handle access control for shared users
            const { data: timelineData } = await getSupabaseClient()
              .from('timelines')
              .select('id')
              .eq('project_id', movieId)
              .maybeSingle()

            if (timelineData) {
              // RLS policy will handle access control for shared users
              const { data: scenesData } = await getSupabaseClient()
                .from('scenes')
                .select('*')
                .eq('timeline_id', timelineData.id)
                .order('start_time_seconds', { ascending: true })

              setScenes(scenesData || [])
            }
          } catch (error) {
            console.error('Error loading scenes:', error)
          }
        }
        
        if (settings.show_storyboard) {
          try {
            const storyboardsData = await StoryboardsService.getStoryboardsByProject(movieId)
            setStoryboards(storyboardsData)
          } catch (error) {
            console.error('Error loading storyboards:', error)
          }
        }
      }
      
    } catch (error) {
      console.error('Error loading casting data:', error)
      toast({
        title: "Error",
        description: "Failed to load casting information",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    // Only owners can save settings
    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only the project owner can save casting settings",
        variant: "destructive",
      })
      return
    }
    
    try {
      setIsSavingSettings(true)
      
      // Convert datetime-local to ISO format for PostgreSQL
      const settingsToSave = {
        ...settingsForm,
        submission_deadline: settingsForm.submission_deadline 
          ? new Date(settingsForm.submission_deadline).toISOString()
          : null
      }
      
      await CastingService.upsertCastingSettings(movieId, settingsToSave)
      
      toast({
        title: "Settings Saved",
        description: "Casting settings updated successfully",
      })
      
      setShowSettings(false)
      await loadData()
      
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleAddRole = () => {
    if (roleInput.trim() && !settingsForm.roles_available.includes(roleInput.trim())) {
      setSettingsForm({
        ...settingsForm,
        roles_available: [...settingsForm.roles_available, roleInput.trim()]
      })
      setRoleInput('')
    }
  }

  const handleRemoveRole = (role: string) => {
    setSettingsForm({
      ...settingsForm,
      roles_available: settingsForm.roles_available.filter(r => r !== role)
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'headshot' | 'video' | 'resume' | 'photos') => {
    const files = e.target.files
    if (!files) return
    
    if (type === 'headshot') {
      setHeadshotFile(files[0])
    } else if (type === 'video') {
      setVideoFile(files[0])
    } else if (type === 'resume') {
      setResumeFile(files[0])
    } else if (type === 'photos') {
      setAdditionalPhotos([...additionalPhotos, ...Array.from(files)])
    }
  }

  const handleSubmitApplication = async () => {
    if (!submissionForm.actor_name || !submissionForm.actor_email) {
      toast({
        title: "Missing Information",
        description: "Please provide your name and email",
        variant: "destructive",
      })
      return
    }
    
    try {
      setIsSubmitting(true)
      
      // Upload files
      let headshotUrl = ''
      let videoUrl = ''
      let resumeUrl = ''
      const additionalPhotoUrls: string[] = []
      
      if (headshotFile) {
        headshotUrl = await CastingService.uploadFile(headshotFile, 'headshots', movieId)
      }
      
      if (videoFile) {
        videoUrl = await CastingService.uploadFile(videoFile, 'videos', movieId)
      }
      
      if (resumeFile) {
        resumeUrl = await CastingService.uploadFile(resumeFile, 'resumes', movieId)
      }
      
      if (additionalPhotos.length > 0) {
        for (const photo of additionalPhotos) {
          const url = await CastingService.uploadFile(photo, 'photos', movieId)
          additionalPhotoUrls.push(url)
        }
      }
      
      // Submit application
      await CastingService.submitActorApplication({
        movie_id: movieId,
        ...submissionForm,
        headshot_url: headshotUrl,
        video_url: videoUrl,
        resume_url: resumeUrl,
        additional_photos: additionalPhotoUrls,
      })
      
      toast({
        title: "Application Submitted",
        description: "Your application has been submitted successfully!",
      })
      
      // Reset form
      setSubmissionForm({
        actor_name: '',
        actor_email: '',
        actor_phone: '',
        role_applying_for: '',
        cover_letter: '',
        experience: '',
      })
      setHeadshotFile(null)
      setVideoFile(null)
      setResumeFile(null)
      setAdditionalPhotos([])
      setShowSubmissionForm(false)
      
      // Reload submissions if owner
      if (isOwner) {
        await loadData()
      }
      
    } catch (error) {
      console.error('Error submitting application:', error)
      toast({
        title: "Submission Failed",
        description: "Failed to submit your application. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateSubmissionStatus = async (submissionId: string, status: ActorSubmission['status'], notes?: string) => {
    // Only owners can update submission status
    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only the project owner can update submission status",
        variant: "destructive",
      })
      return
    }
    
    try {
      await CastingService.updateSubmission(submissionId, { status, notes })
      
      toast({
        title: "Status Updated",
        description: "Submission status updated successfully",
      })
      
      await loadData()
      
    } catch (error) {
      console.error('Error updating submission:', error)
      toast({
        title: "Error",
        description: "Failed to update submission status",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSubmission = async (submissionId: string) => {
    // Only owners can delete submissions
    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only the project owner can delete submissions",
        variant: "destructive",
      })
      return
    }
    
    if (!confirm('Are you sure you want to delete this submission?')) {
      return
    }
    
    try {
      await CastingService.deleteSubmission(submissionId)
      
      toast({
        title: "Submission Deleted",
        description: "Submission deleted successfully",
      })
      
      await loadData()
      
    } catch (error) {
      console.error('Error deleting submission:', error)
      toast({
        title: "Error",
        description: "Failed to delete submission",
        variant: "destructive",
      })
    }
  }

  const handleShareLink = () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    navigator.clipboard.writeText(url)
    toast({
      title: "Link Copied!",
      description: "Casting page link copied to clipboard",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Header />
        <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Header />
        <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8">
          <div className="text-center py-12 px-4">
            <Film className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">Movie Not Found</h3>
            <p className="text-sm sm:text-base text-muted-foreground">The movie you're looking for doesn't exist.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8">
        {/* Movie Header */}
        <Card className="cinema-card mb-6">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              {/* Movie Poster */}
              <div className="w-full md:w-48 flex-shrink-0 mx-auto md:mx-0">
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted max-w-[200px] md:max-w-none">
                  <img
                    src={movie.thumbnail || "/placeholder.svg?height=300&width=200"}
                    alt={movie.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Movie Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-2xl sm:text-3xl mb-2 break-words">{movie.name}</CardTitle>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {movie.genre && <Badge variant="outline" className="text-xs">{movie.genre}</Badge>}
                      <Badge variant="outline" className="text-xs">{movie.movie_status}</Badge>
                      {castingSettings?.is_active && (
                        <Badge className="bg-green-500/20 text-green-400 text-xs">Casting Open</Badge>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Share Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShareLink}
                      title="Copy link to share"
                      className="text-xs"
                    >
                      <Share2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Share</span>
                    </Button>

                    {/* Manage Submissions Button - Owner Only */}
                    {isOwner && (
                      <Link href="/manage-submissions">
                        <Button
                          variant="outline"
                          size="sm"
                          title="Manage all actor submissions"
                          className="text-xs"
                        >
                          <Users className="h-4 w-4 sm:mr-2" />
                          <span className="hidden md:inline">Manage Submissions</span>
                          <span className="md:hidden">Manage</span>
                        </Button>
                      </Link>
                    )}

                    {/* Owner Settings Button */}
                    {isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSettings(true)}
                        className="text-xs"
                      >
                        <Settings className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Settings</span>
                      </Button>
                    )}
                  </div>
                </div>

                {movie.description && (
                  <CardDescription className="text-sm sm:text-base mb-4 break-words">
                    {movie.description}
                  </CardDescription>
                )}

                {castingSettings?.casting_notes && (
                  <div className="p-3 sm:p-4 bg-muted/50 rounded-lg mb-4">
                    <h4 className="font-semibold mb-2 text-sm sm:text-base">Casting Director's Notes</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">{castingSettings.casting_notes}</p>
                  </div>
                )}

                {castingSettings?.submission_deadline && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-4 flex-wrap">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span className="break-words">
                      Deadline: {new Date(castingSettings.submission_deadline).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Available Roles */}
                {castingSettings?.roles_available && castingSettings.roles_available.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm sm:text-base">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      Available Roles
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {castingSettings.roles_available.map((role, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">{role}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Characters */}
                {(() => {
                  // Filter characters based on casting settings
                  const visibleTypes = castingSettings?.show_character_types || ['main', 'supporting']
                  const filteredCharacters = characters.filter(char => {
                    // Must have show_on_casting enabled (defaults to true if null)
                    if (char.show_on_casting === false) return false
                    // Must match visible character types
                    if (char.character_type && !visibleTypes.includes(char.character_type)) return false
                    return true
                  })
                  
                  if (filteredCharacters.length === 0) return null
                  
                  const getTypeBadgeColor = (type: string | null | undefined) => {
                    switch (type) {
                      case 'main': return 'bg-purple-500/90 text-white'
                      case 'supporting': return 'bg-blue-500/90 text-white'
                      case 'extra': return 'bg-gray-500/90 text-white'
                      case 'cameo': return 'bg-yellow-500/90 text-white'
                      case 'voice': return 'bg-green-500/90 text-white'
                      case 'stunt': return 'bg-red-500/90 text-white'
                      default: return 'bg-gray-500/90 text-white'
                    }
                  }
                  
                  const getTypeLabel = (type: string | null | undefined) => {
                    switch (type) {
                      case 'main': return 'Main'
                      case 'supporting': return 'Supporting'
                      case 'extra': return 'Extra'
                      case 'cameo': return 'Cameo'
                      case 'voice': return 'Voice'
                      case 'stunt': return 'Stunt'
                      default: return 'Character'
                    }
                  }
                  
                  return (
                    <div className="mb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <h4 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                          <User className="h-4 w-4 flex-shrink-0" />
                          Characters
                        </h4>
                        {isOwner && (
                          <Link href={`/characters?movie=${movieId}`}>
                            <Button variant="outline" size="sm" className="text-xs sm:text-sm w-full sm:w-auto">
                              <Edit className="h-3 w-3 mr-1" />
                              Manage All
                            </Button>
                          </Link>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        {filteredCharacters.map((character) => {
                          return (
                            <Link 
                              key={character.id} 
                              href={`/casting/role/${character.id}?movie=${movieId}`}
                              className="block"
                            >
                              <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
                                <CardContent className="p-3">
                                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2">
                                  {character.image_url ? (
                                    <img
                                      src={character.image_url}
                                      alt={character.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <User className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                  )}
                                  {/* Character Type Badge */}
                                  {character.character_type && (
                                    <Badge 
                                      className={`absolute top-2 right-2 ${getTypeBadgeColor(character.character_type)} text-xs font-semibold px-2 py-0.5`}
                                    >
                                      {getTypeLabel(character.character_type)}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold break-words">{character.name}</p>
                                    {character.archetype && (
                                      <p className="text-xs text-muted-foreground break-words">{character.archetype}</p>
                                    )}
                                    {character.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">
                                        {character.description}
                                      </p>
                                    )}
                                  </div>
                                  {/* Toggle for owners */}
                                  {isOwner && (
                                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <Switch
                                        checked={character.show_on_casting !== false}
                                        onCheckedChange={async (checked) => {
                                          // Double-check ownership before allowing toggle
                                          if (!isOwner) {
                                            toast({
                                              title: "Access Denied",
                                              description: "Only the project owner can modify character visibility",
                                              variant: "destructive",
                                            })
                                            return
                                          }
                                          
                                          try {
                                            const updated = await CharactersService.updateCharacter(character.id, {
                                              show_on_casting: checked
                                            })
                                            setCharacters(prev => prev.map(c => c.id === character.id ? updated : c))
                                            toast({ 
                                              title: checked ? "Character visible" : "Character hidden", 
                                              description: `"${character.name}" ${checked ? "will" : "won't"} appear on the casting page.` 
                                            })
                                            // Reload data to refresh the display
                                            await loadData()
                                          } catch (e) {
                                            console.error('Toggle show on casting failed:', e)
                                            toast({ title: "Error", description: "Failed to update character.", variant: "destructive" })
                                          }
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Apply Button */}
                {castingSettings?.is_active && !isOwner && (
                  <Button
                    className="gradient-button text-white w-full sm:w-auto"
                    onClick={() => setShowSubmissionForm(true)}
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Apply for Role
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Owner View - Submissions */}
        {isOwner && (
          <Card className="cinema-card mb-6">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Users className="h-5 w-5" />
                Actor Submissions ({submissions.length})
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Review and manage actor applications</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {submissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No submissions yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <Card key={submission.id} className="border-border">
                      <CardContent className="p-4 sm:pt-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-base sm:text-lg flex items-center gap-2 break-words">
                              <User className="h-4 w-4 flex-shrink-0" />
                              {submission.actor_name}
                            </h4>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1 break-all">
                                <Mail className="h-3 w-3 flex-shrink-0" />
                                {submission.actor_email}
                              </span>
                              {submission.actor_phone && (
                                <span className="flex items-center gap-1 break-all">
                                  <Phone className="h-3 w-3 flex-shrink-0" />
                                  {submission.actor_phone}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <Badge className={`${statusColors[submission.status]} text-xs sm:text-sm flex-shrink-0 self-start`}>
                            {submission.status}
                          </Badge>
                        </div>

                        {submission.role_applying_for && (
                          <div className="mb-3">
                            <span className="text-xs sm:text-sm font-semibold">Applying for: </span>
                            <Badge variant="outline" className="text-xs">{submission.role_applying_for}</Badge>
                          </div>
                        )}

                        {submission.cover_letter && (
                          <div className="mb-3">
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 break-words">
                              {submission.cover_letter}
                            </p>
                          </div>
                        )}

                        {/* Media Files */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {submission.headshot_url && (
                            <a
                              href={submission.headshot_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs"
                            >
                              <Button variant="outline" size="sm" className="text-xs">
                                <ImageIcon className="h-3 w-3 mr-1" />
                                Headshot
                              </Button>
                            </a>
                          )}
                          {submission.video_url && (
                            <a
                              href={submission.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs"
                            >
                              <Button variant="outline" size="sm" className="text-xs">
                                <Video className="h-3 w-3 mr-1" />
                                Reel
                              </Button>
                            </a>
                          )}
                          {submission.resume_url && (
                            <a
                              href={submission.resume_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs"
                            >
                              <Button variant="outline" size="sm" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                Resume
                              </Button>
                            </a>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={submission.status}
                            onValueChange={(value) => handleUpdateSubmissionStatus(submission.id, value as ActorSubmission['status'])}
                          >
                            <SelectTrigger className="w-full sm:w-40 text-xs sm:text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="reviewing">Reviewing</SelectItem>
                              <SelectItem value="shortlisted">Shortlisted</SelectItem>
                              <SelectItem value="accepted">Accepted</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedSubmission(submission)}
                            className="flex-1 sm:flex-initial"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSubmission(submission.id)}
                            className="flex-1 sm:flex-initial"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {submission.notes && (
                          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs sm:text-sm break-words"><strong>Notes:</strong> {submission.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Conditional Content Tabs */}
        {castingSettings && (castingSettings.show_script || castingSettings.show_scenes || castingSettings.show_timeline || castingSettings.show_storyboard) && (
          <Card className="cinema-card">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Production Materials</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Review materials shared by the production team</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <Tabs defaultValue="script" className="w-full">
                <TabsList className="w-full overflow-x-auto flex-nowrap sm:flex-wrap">
                  {castingSettings.show_script && <TabsTrigger value="script" className="text-xs sm:text-sm">Script</TabsTrigger>}
                  {castingSettings.show_scenes && <TabsTrigger value="scenes" className="text-xs sm:text-sm">Scenes</TabsTrigger>}
                  {castingSettings.show_timeline && <TabsTrigger value="timeline" className="text-xs sm:text-sm">Timeline</TabsTrigger>}
                  {castingSettings.show_storyboard && <TabsTrigger value="storyboard" className="text-xs sm:text-sm">Storyboard</TabsTrigger>}
                </TabsList>

                {castingSettings.show_script && (
                  <TabsContent value="script" className="space-y-4">
                    {treatment ? (
                      <div className="space-y-4">
                        <div className="border rounded-lg p-4 sm:p-6 bg-background">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg sm:text-xl font-bold break-words">{treatment.title}</h3>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">{treatment.genre}</Badge>
                                <Badge variant="outline" className="text-xs">{treatment.status}</Badge>
                              </div>
                            </div>
                          </div>
                          
                          {treatment.logline && (
                            <div className="mb-4 p-3 sm:p-4 bg-muted/50 rounded-lg">
                              <h4 className="font-semibold mb-2 text-sm sm:text-base">Logline</h4>
                              <p className="text-xs sm:text-sm break-words">{treatment.logline}</p>
                            </div>
                          )}
                          
                          {treatment.synopsis && (
                            <div className="mb-4">
                              <h4 className="font-semibold mb-2 text-sm sm:text-base">Synopsis</h4>
                              <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{treatment.synopsis}</p>
                            </div>
                          )}
                          
                          {treatment.characters && (
                            <div className="mb-4">
                              <h4 className="font-semibold mb-2 text-sm sm:text-base">Characters</h4>
                              <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{treatment.characters}</p>
                            </div>
                          )}
                          
                          {treatment.themes && (
                            <div className="mb-4">
                              <h4 className="font-semibold mb-2 text-sm sm:text-base">Themes</h4>
                              <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{treatment.themes}</p>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-2">
                            {treatment.id ? (
                              <Link href={`/treatments/${treatment.id}`}>
                              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                                <FileText className="h-4 w-4 mr-2" />
                                View Full Treatment
                              </Button>
                            </Link>
                            ) : (
                              <Link href={`/screenplay/${movieId}`}>
                                <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Screenplay
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 sm:p-6 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">No treatment available for this movie</p>
                        <Link href={`/treatments`}>
                          <Button variant="outline" size="sm" className="mt-4 text-xs sm:text-sm">
                            <FileText className="h-4 w-4 mr-2" />
                            Go to Treatments
                          </Button>
                        </Link>
                      </div>
                    )}
                  </TabsContent>
                )}

                {castingSettings.show_scenes && (
                  <TabsContent value="scenes" className="space-y-4">
                    <div className="p-4 sm:p-6 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Scene breakdown will be displayed here</p>
                    </div>
                  </TabsContent>
                )}

                {castingSettings.show_timeline && (
                  <TabsContent value="timeline" className="space-y-4">
                    <div className="p-4 sm:p-6 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Production timeline will be displayed here</p>
                      <Link href={`/timeline?movie=${movieId}`}>
                        <Button variant="outline" size="sm" className="mt-4 text-xs sm:text-sm">
                          <Calendar className="h-4 w-4 mr-2" />
                          View Timeline
                        </Button>
                      </Link>
                    </div>
                  </TabsContent>
                )}

                {castingSettings.show_storyboard && (
                  <TabsContent value="storyboard" className="space-y-4">
                    {storyboards.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        {storyboards.map((board) => (
                          <Card key={board.id} className="border-border h-full">
                            <CardContent className="p-3">
                              {board.image_url && (
                                <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-2">
                                  <img
                                    src={board.image_url}
                                    alt={board.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <p className="text-xs font-semibold break-words">{board.title}</p>
                              <p className="text-xs text-muted-foreground">Scene {board.scene_number}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 sm:p-6 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">No storyboards available yet</p>
                      </div>
                    )}
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Settings Dialog (Owner Only) */}
      <Dialog open={showSettings && isOwner} onOpenChange={(open) => {
        // Only allow opening if user is owner
        if (open && !isOwner) {
          toast({
            title: "Access Denied",
            description: "Only the project owner can access casting settings",
            variant: "destructive",
          })
          return
        }
        setShowSettings(open)
      }}>
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Casting Settings</DialogTitle>
            <DialogDescription>
              Configure what actors can see and manage casting call details
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 overflow-x-auto">
              <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
              <TabsTrigger value="visibility" className="text-xs">Visibility</TabsTrigger>
              <TabsTrigger value="characters" className="text-xs">Types</TabsTrigger>
              <TabsTrigger value="individual" className="text-xs">Individual</TabsTrigger>
              <TabsTrigger value="roles" className="text-xs">Roles</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              {/* Active Status */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is-active">Casting Call Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow actors to submit applications
                  </p>
                </div>
                <Switch
                  id="is-active"
                  checked={settingsForm.is_active}
                  onCheckedChange={(checked) =>
                    setSettingsForm({ ...settingsForm, is_active: checked })
                  }
                />
              </div>

              <Separator />

              {/* Deadline */}
              <div>
                <Label htmlFor="deadline">Submission Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={settingsForm.submission_deadline}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, submission_deadline: e.target.value })
                  }
                  className="mt-2"
                />
              </div>

              <Separator />

              {/* Casting Notes */}
              <div>
                <Label htmlFor="casting-notes">Casting Notes</Label>
                <Textarea
                  id="casting-notes"
                  placeholder="Add any notes or special instructions for actors..."
                  value={settingsForm.casting_notes}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, casting_notes: e.target.value })
                  }
                  className="mt-2"
                  rows={4}
                />
              </div>
            </TabsContent>

            <TabsContent value="visibility" className="space-y-4 mt-4">
              <div>
                <h3 className="font-semibold mb-3">Visibility Settings</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Control which production materials actors can view
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-script">Show Script</Label>
                    <Switch
                      id="show-script"
                      checked={settingsForm.show_script}
                      onCheckedChange={(checked) =>
                        setSettingsForm({ ...settingsForm, show_script: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-scenes">Show Scenes</Label>
                    <Switch
                      id="show-scenes"
                      checked={settingsForm.show_scenes}
                      onCheckedChange={(checked) =>
                        setSettingsForm({ ...settingsForm, show_scenes: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-timeline">Show Timeline</Label>
                    <Switch
                      id="show-timeline"
                      checked={settingsForm.show_timeline}
                      onCheckedChange={(checked) =>
                        setSettingsForm({ ...settingsForm, show_timeline: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-storyboard">Show Storyboard</Label>
                    <Switch
                      id="show-storyboard"
                      checked={settingsForm.show_storyboard}
                      onCheckedChange={(checked) =>
                        setSettingsForm({ ...settingsForm, show_storyboard: checked })
                      }
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="characters" className="space-y-4 mt-4">
              <div>
                <Label className="mb-3 block">Show Character Types</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Select which character types to display on the public casting page
                </p>
                <div className="space-y-2">
                  {['main', 'supporting', 'extra', 'cameo', 'voice', 'stunt'].map((type) => {
                    const typeLabels: Record<string, string> = {
                      main: 'Main Actors',
                      supporting: 'Supporting Actors',
                      extra: 'Extras',
                      cameo: 'Cameos',
                      voice: 'Voice Actors',
                      stunt: 'Stunt Performers'
                    }
                    
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <Label htmlFor={`show-${type}`} className="font-normal">
                          {typeLabels[type]}
                        </Label>
                        <Switch
                          id={`show-${type}`}
                          checked={settingsForm.show_character_types.includes(type)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSettingsForm({
                                ...settingsForm,
                                show_character_types: [...settingsForm.show_character_types, type]
                              })
                            } else {
                              setSettingsForm({
                                ...settingsForm,
                                show_character_types: settingsForm.show_character_types.filter(t => t !== type)
                              })
                            }
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="individual" className="space-y-4 mt-4">
              <div>
                <Label className="mb-3 block">Individual Characters</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Show or hide specific characters on the casting page
                </p>
                {characters.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No characters found for this project.</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {characters.map((character) => {
                      const getTypeLabel = (type: string | null | undefined) => {
                        switch (type) {
                          case 'main': return 'Main'
                          case 'supporting': return 'Supporting'
                          case 'extra': return 'Extra'
                          case 'cameo': return 'Cameo'
                          case 'voice': return 'Voice'
                          case 'stunt': return 'Stunt'
                          default: return ''
                        }
                      }
                      
                      return (
                        <div 
                          key={character.id} 
                          className={`flex items-center justify-between p-3 rounded-md border ${
                            character.show_on_casting === false 
                              ? 'bg-muted/50 border-muted' 
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {character.image_url ? (
                              <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                                <img
                                  src={character.image_url}
                                  alt={character.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                <User className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{character.name}</p>
                                {character.character_type && (
                                  <Badge variant="outline" className="text-xs">
                                    {getTypeLabel(character.character_type)}
                                  </Badge>
                                )}
                              </div>
                              {character.archetype && (
                                <p className="text-xs text-muted-foreground truncate">{character.archetype}</p>
                              )}
                              {character.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1 truncate">
                                  {character.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <Switch
                            checked={character.show_on_casting !== false}
                            onCheckedChange={async (checked) => {
                              try {
                                const updated = await CharactersService.updateCharacter(character.id, {
                                  show_on_casting: checked
                                })
                                setCharacters(prev => prev.map(c => c.id === character.id ? updated : c))
                                toast({ 
                                  title: checked ? "Character visible" : "Character hidden", 
                                  description: `"${character.name}" ${checked ? "will" : "won't"} appear on the casting page.` 
                                })
                                // Reload data to refresh the display
                                await loadData()
                              } catch (e) {
                                console.error('Toggle show on casting failed:', e)
                                toast({ title: "Error", description: "Failed to update character.", variant: "destructive" })
                              }
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="roles" className="space-y-4 mt-4">
              <div>
                <Label className="mb-3 block">Available Roles</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Add roles that actors can apply for
                </p>
                <div className="space-y-2">
                  {settingsForm.roles_available.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {settingsForm.roles_available.map((role) => (
                        <Badge key={role} variant="secondary" className="flex items-center gap-1">
                          {role}
                          <button
                            onClick={() => handleRemoveRole(role)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Lead Actor, Supporting Role"
                      value={roleInput}
                      onChange={(e) => setRoleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddRole()
                        }
                      }}
                    />
                    <Button onClick={handleAddRole} variant="outline" size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
              {isSavingSettings ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission Form Dialog */}
      <Dialog open={showSubmissionForm} onOpenChange={setShowSubmissionForm}>
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply for {movie.name}</DialogTitle>
            <DialogDescription>
              Submit your application to join this production
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid gap-4">
              <div>
                <Label htmlFor="actor-name">Full Name *</Label>
                <Input
                  id="actor-name"
                  value={submissionForm.actor_name}
                  onChange={(e) =>
                    setSubmissionForm({ ...submissionForm, actor_name: e.target.value })
                  }
                  placeholder="Your full name"
                />
              </div>

              <div>
                <Label htmlFor="actor-email">Email *</Label>
                <Input
                  id="actor-email"
                  type="email"
                  value={submissionForm.actor_email}
                  onChange={(e) =>
                    setSubmissionForm({ ...submissionForm, actor_email: e.target.value })
                  }
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <Label htmlFor="actor-phone">Phone</Label>
                <Input
                  id="actor-phone"
                  type="tel"
                  value={submissionForm.actor_phone}
                  onChange={(e) =>
                    setSubmissionForm({ ...submissionForm, actor_phone: e.target.value })
                  }
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div>
                <Label htmlFor="role">Role Applying For</Label>
                {castingSettings?.roles_available && castingSettings.roles_available.length > 0 ? (
                  <Select
                    value={submissionForm.role_applying_for}
                    onValueChange={(value) =>
                      setSubmissionForm({ ...submissionForm, role_applying_for: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {castingSettings.roles_available.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="role"
                    value={submissionForm.role_applying_for}
                    onChange={(e) =>
                      setSubmissionForm({ ...submissionForm, role_applying_for: e.target.value })
                    }
                    placeholder="Specify the role you're interested in"
                  />
                )}
              </div>

              <div>
                <Label htmlFor="cover-letter">Cover Letter</Label>
                <Textarea
                  id="cover-letter"
                  value={submissionForm.cover_letter}
                  onChange={(e) =>
                    setSubmissionForm({ ...submissionForm, cover_letter: e.target.value })
                  }
                  placeholder="Tell us why you're perfect for this role..."
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="experience">Experience</Label>
                <Textarea
                  id="experience"
                  value={submissionForm.experience}
                  onChange={(e) =>
                    setSubmissionForm({ ...submissionForm, experience: e.target.value })
                  }
                  placeholder="Describe your acting experience..."
                  rows={4}
                />
              </div>
            </div>

            <Separator />

            {/* File Uploads */}
            <div className="space-y-4">
              <h3 className="font-semibold">Upload Materials</h3>

              <div>
                <Label htmlFor="headshot">Headshot</Label>
                <Input
                  id="headshot"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'headshot')}
                  className="mt-2"
                />
                {headshotFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {headshotFile.name}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="video">Demo Reel / Audition Video</Label>
                <Input
                  id="video"
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileChange(e, 'video')}
                  className="mt-2"
                />
                {videoFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {videoFile.name}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="resume">Resume / CV</Label>
                <Input
                  id="resume"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileChange(e, 'resume')}
                  className="mt-2"
                />
                {resumeFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {resumeFile.name}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="photos">Additional Photos</Label>
                <Input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileChange(e, 'photos')}
                  className="mt-2"
                />
                {additionalPhotos.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {additionalPhotos.length} photo(s) selected
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmissionForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitApplication} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission Details Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedSubmission.actor_name}</DialogTitle>
                <DialogDescription>Application for {movie.name}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <Label className="text-xs sm:text-sm">Email</Label>
                    <p className="text-xs sm:text-sm break-all">{selectedSubmission.actor_email}</p>
                  </div>
                  {selectedSubmission.actor_phone && (
                    <div className="min-w-0">
                      <Label className="text-xs sm:text-sm">Phone</Label>
                      <p className="text-xs sm:text-sm break-all">{selectedSubmission.actor_phone}</p>
                    </div>
                  )}
                </div>

                {selectedSubmission.role_applying_for && (
                  <div>
                    <Label className="text-xs sm:text-sm">Role</Label>
                    <p className="text-xs sm:text-sm break-words">{selectedSubmission.role_applying_for}</p>
                  </div>
                )}

                {selectedSubmission.cover_letter && (
                  <div>
                    <Label className="text-xs sm:text-sm">Cover Letter</Label>
                    <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{selectedSubmission.cover_letter}</p>
                  </div>
                )}

                {selectedSubmission.experience && (
                  <div>
                    <Label className="text-xs sm:text-sm">Experience</Label>
                    <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{selectedSubmission.experience}</p>
                  </div>
                )}

                {/* Media Preview */}
                <div className="space-y-3">
                  {selectedSubmission.headshot_url && (
                    <div>
                      <Label className="text-xs sm:text-sm">Headshot</Label>
                      <img
                        src={selectedSubmission.headshot_url}
                        alt="Headshot"
                        className="w-full max-w-md rounded-lg mt-2"
                      />
                    </div>
                  )}

                  {selectedSubmission.video_url && (
                    <div>
                      <Label className="text-xs sm:text-sm">Demo Reel</Label>
                      <video
                        src={selectedSubmission.video_url}
                        controls
                        className="w-full max-w-2xl rounded-lg mt-2"
                      />
                    </div>
                  )}

                  {selectedSubmission.additional_photos && selectedSubmission.additional_photos.length > 0 && (
                    <div>
                      <Label className="text-xs sm:text-sm">Additional Photos</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {selectedSubmission.additional_photos.map((photo, idx) => (
                          <img
                            key={idx}
                            src={photo}
                            alt={`Additional photo ${idx + 1}`}
                            className="w-full aspect-square object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Internal Notes */}
                <div>
                  <Label htmlFor="notes">Internal Notes</Label>
                  <Textarea
                    id="notes"
                    defaultValue={selectedSubmission.notes || ''}
                    placeholder="Add internal notes about this applicant..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

