"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
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
  Edit
} from "lucide-react"
import { CastingService, type CastingSetting, type ActorSubmission } from "@/lib/casting-service"
import { MovieService, type Movie } from "@/lib/movie-service"
import { StoryboardsService, type Storyboard } from "@/lib/storyboards-service"
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

  // State
  const [movie, setMovie] = useState<Movie | null>(null)
  const [castingSettings, setCastingSettings] = useState<CastingSetting | null>(null)
  const [submissions, setSubmissions] = useState<ActorSubmission[]>([])
  const [scenes, setScenes] = useState<any[]>([])
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [timeline, setTimeline] = useState<any>(null)
  const [treatment, setTreatment] = useState<any>(null)
  
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
    if (ready && movieId) {
      loadData()
    }
  }, [ready, movieId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load movie
      const movieData = await MovieService.getMovieById(movieId)
      setMovie(movieData)
      
      // Check if user is owner
      const owner = movieData?.user_id === userId
      setIsOwner(owner)
      
      // Load casting settings
      const settings = await CastingService.getCastingSettings(movieId)
      setCastingSettings(settings)
      
      if (settings) {
        setSettingsForm({
          show_script: settings.show_script,
          show_scenes: settings.show_scenes,
          show_timeline: settings.show_timeline,
          show_storyboard: settings.show_storyboard,
          roles_available: settings.roles_available || [],
          submission_deadline: settings.submission_deadline || '',
          casting_notes: settings.casting_notes || '',
          is_active: settings.is_active,
        })
      }
      
      // If owner, load submissions
      if (owner) {
        const submissionsData = await CastingService.getSubmissionsForMovie(movieId)
        setSubmissions(submissionsData)
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
              .single()

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
            const { data: timelineData } = await getSupabaseClient()
              .from('timelines')
              .select('id')
              .eq('project_id', movieId)
              .single()

            if (timelineData) {
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
    try {
      setIsSavingSettings(true)
      
      await CastingService.upsertCastingSettings(movieId, settingsForm)
      
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-7xl px-6 py-8">
          <div className="text-center py-12">
            <Film className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Movie Not Found</h3>
            <p className="text-muted-foreground">The movie you're looking for doesn't exist.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {/* Movie Header */}
        <Card className="cinema-card mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Movie Poster */}
              <div className="w-full md:w-48 flex-shrink-0">
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                  <img
                    src={movie.thumbnail || "/placeholder.svg?height=300&width=200"}
                    alt={movie.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Movie Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <CardTitle className="text-3xl mb-2">{movie.name}</CardTitle>
                    <div className="flex gap-2 mb-3">
                      {movie.genre && <Badge variant="outline">{movie.genre}</Badge>}
                      <Badge variant="outline">{movie.movie_status}</Badge>
                      {castingSettings?.is_active && (
                        <Badge className="bg-green-500/20 text-green-400">Casting Open</Badge>
                      )}
                    </div>
                  </div>

                  {/* Owner Settings Button */}
                  {isOwner && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettings(true)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Casting Settings
                    </Button>
                  )}
                </div>

                {movie.description && (
                  <CardDescription className="text-base mb-4">
                    {movie.description}
                  </CardDescription>
                )}

                {castingSettings?.casting_notes && (
                  <div className="p-4 bg-muted/50 rounded-lg mb-4">
                    <h4 className="font-semibold mb-2">Casting Director's Notes</h4>
                    <p className="text-sm text-muted-foreground">{castingSettings.casting_notes}</p>
                  </div>
                )}

                {castingSettings?.submission_deadline && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Deadline: {new Date(castingSettings.submission_deadline).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Available Roles */}
                {castingSettings?.roles_available && castingSettings.roles_available.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Available Roles
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {castingSettings.roles_available.map((role, idx) => (
                        <Badge key={idx} variant="secondary">{role}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Apply Button */}
                {castingSettings?.is_active && !isOwner && (
                  <Button
                    className="gradient-button text-white"
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Actor Submissions ({submissions.length})
              </CardTitle>
              <CardDescription>Review and manage actor applications</CardDescription>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No submissions yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <Card key={submission.id} className="border-border">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="font-semibold text-lg flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {submission.actor_name}
                            </h4>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {submission.actor_email}
                              </span>
                              {submission.actor_phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {submission.actor_phone}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <Badge className={statusColors[submission.status]}>
                            {submission.status}
                          </Badge>
                        </div>

                        {submission.role_applying_for && (
                          <div className="mb-3">
                            <span className="text-sm font-semibold">Applying for: </span>
                            <Badge variant="outline">{submission.role_applying_for}</Badge>
                          </div>
                        )}

                        {submission.cover_letter && (
                          <div className="mb-3">
                            <p className="text-sm text-muted-foreground line-clamp-3">
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
                              <Button variant="outline" size="sm">
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
                              <Button variant="outline" size="sm">
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
                              <Button variant="outline" size="sm">
                                <FileText className="h-3 w-3 mr-1" />
                                Resume
                              </Button>
                            </a>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Select
                            value={submission.status}
                            onValueChange={(value) => handleUpdateSubmissionStatus(submission.id, value as ActorSubmission['status'])}
                          >
                            <SelectTrigger className="w-40">
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
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSubmission(submission.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {submission.notes && (
                          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm"><strong>Notes:</strong> {submission.notes}</p>
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
            <CardHeader>
              <CardTitle>Production Materials</CardTitle>
              <CardDescription>Review materials shared by the production team</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="script" className="w-full">
                <TabsList>
                  {castingSettings.show_script && <TabsTrigger value="script">Script</TabsTrigger>}
                  {castingSettings.show_scenes && <TabsTrigger value="scenes">Scenes</TabsTrigger>}
                  {castingSettings.show_timeline && <TabsTrigger value="timeline">Timeline</TabsTrigger>}
                  {castingSettings.show_storyboard && <TabsTrigger value="storyboard">Storyboard</TabsTrigger>}
                </TabsList>

                {castingSettings.show_script && (
                  <TabsContent value="script" className="space-y-4">
                    {treatment ? (
                      <div className="space-y-4">
                        <div className="border rounded-lg p-6 bg-background">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-bold">{treatment.title}</h3>
                              <div className="flex gap-2 mt-2">
                                <Badge variant="outline">{treatment.genre}</Badge>
                                <Badge variant="outline">{treatment.status}</Badge>
                              </div>
                            </div>
                          </div>
                          
                          {treatment.logline && (
                            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                              <h4 className="font-semibold mb-2">Logline</h4>
                              <p className="text-sm">{treatment.logline}</p>
                            </div>
                          )}
                          
                          <div className="mb-4">
                            <h4 className="font-semibold mb-2">Synopsis</h4>
                            <p className="text-sm whitespace-pre-wrap">{treatment.synopsis}</p>
                          </div>
                          
                          {treatment.characters && (
                            <div className="mb-4">
                              <h4 className="font-semibold mb-2">Characters</h4>
                              <p className="text-sm whitespace-pre-wrap">{treatment.characters}</p>
                            </div>
                          )}
                          
                          {treatment.themes && (
                            <div className="mb-4">
                              <h4 className="font-semibold mb-2">Themes</h4>
                              <p className="text-sm whitespace-pre-wrap">{treatment.themes}</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            {treatment.id ? (
                              <Link href={`/treatments/${treatment.id}`}>
                              <Button variant="outline">
                                <FileText className="h-4 w-4 mr-2" />
                                View Full Treatment
                              </Button>
                            </Link>
                            ) : (
                              <Link href={`/screenplay/${movieId}`}>
                                <Button variant="outline">
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Screenplay
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">No treatment available for this movie</p>
                        <Link href={`/treatments`}>
                          <Button variant="outline" className="mt-4">
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
                    <div className="p-6 bg-muted/30 rounded-lg">
                      <p className="text-muted-foreground">Scene breakdown will be displayed here</p>
                    </div>
                  </TabsContent>
                )}

                {castingSettings.show_timeline && (
                  <TabsContent value="timeline" className="space-y-4">
                    <div className="p-6 bg-muted/30 rounded-lg">
                      <p className="text-muted-foreground">Production timeline will be displayed here</p>
                      <Link href={`/timeline?movie=${movieId}`}>
                        <Button variant="outline" className="mt-4">
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
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {storyboards.map((board) => (
                          <Card key={board.id} className="border-border">
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
                              <p className="text-xs font-semibold">{board.title}</p>
                              <p className="text-xs text-muted-foreground">Scene {board.scene_number}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">No storyboards available yet</p>
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
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="cinema-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Casting Settings</DialogTitle>
            <DialogDescription>
              Configure what actors can see and manage casting call details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Visibility Settings */}
            <div>
              <h3 className="font-semibold mb-3">Visibility Settings</h3>
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

            <Separator />

            {/* Available Roles */}
            <div>
              <Label>Available Roles</Label>
              <div className="space-y-2 mt-2">
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
          </div>

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
        <DialogContent className="cinema-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="cinema-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedSubmission.actor_name}</DialogTitle>
                <DialogDescription>Application for {movie.name}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <p className="text-sm">{selectedSubmission.actor_email}</p>
                  </div>
                  {selectedSubmission.actor_phone && (
                    <div>
                      <Label>Phone</Label>
                      <p className="text-sm">{selectedSubmission.actor_phone}</p>
                    </div>
                  )}
                </div>

                {selectedSubmission.role_applying_for && (
                  <div>
                    <Label>Role</Label>
                    <p className="text-sm">{selectedSubmission.role_applying_for}</p>
                  </div>
                )}

                {selectedSubmission.cover_letter && (
                  <div>
                    <Label>Cover Letter</Label>
                    <p className="text-sm whitespace-pre-wrap">{selectedSubmission.cover_letter}</p>
                  </div>
                )}

                {selectedSubmission.experience && (
                  <div>
                    <Label>Experience</Label>
                    <p className="text-sm whitespace-pre-wrap">{selectedSubmission.experience}</p>
                  </div>
                )}

                {/* Media Preview */}
                <div className="space-y-3">
                  {selectedSubmission.headshot_url && (
                    <div>
                      <Label>Headshot</Label>
                      <img
                        src={selectedSubmission.headshot_url}
                        alt="Headshot"
                        className="w-full max-w-md rounded-lg mt-2"
                      />
                    </div>
                  )}

                  {selectedSubmission.video_url && (
                    <div>
                      <Label>Demo Reel</Label>
                      <video
                        src={selectedSubmission.video_url}
                        controls
                        className="w-full max-w-2xl rounded-lg mt-2"
                      />
                    </div>
                  )}

                  {selectedSubmission.additional_photos && selectedSubmission.additional_photos.length > 0 && (
                    <div>
                      <Label>Additional Photos</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
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

