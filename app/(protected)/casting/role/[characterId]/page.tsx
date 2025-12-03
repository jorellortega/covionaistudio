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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuthReady } from "@/components/auth-hooks"
import { 
  ArrowLeft,
  User,
  DollarSign,
  Calendar,
  MapPin,
  FileText,
  Mail,
  Phone,
  Upload,
  Star,
  Loader2,
  CheckCircle,
  Video,
  Image as ImageIcon,
  FileText as FileTextIcon,
  Users,
  Eye,
  Trash2,
  Edit
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { CharactersService, type Character } from "@/lib/characters-service"
import { CastingService, type ActorSubmission } from "@/lib/casting-service"
import { MovieService, type Movie } from "@/lib/movie-service"
import { getSupabaseClient } from "@/lib/supabase"
import Link from "next/link"

const statusColors = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  reviewing: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  shortlisted: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  accepted: "bg-purple-500/20 text-purple-400 border-purple-500/30",
}

export default function RoleDetailsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const characterId = params?.characterId as string
  const movieId = searchParams?.get('movie') as string
  
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  const router = useRouter()

  const [character, setCharacter] = useState<Character | null>(null)
  const [movie, setMovie] = useState<Movie | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [showSubmissionForm, setShowSubmissionForm] = useState(false)
  const [submissions, setSubmissions] = useState<ActorSubmission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<ActorSubmission | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
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

  // Role details edit form state
  const [roleDetailsForm, setRoleDetailsForm] = useState({
    role_compensation_type: '' as 'paid' | 'unpaid' | 'deferred' | 'stipend' | 'negotiable' | '',
    role_compensation_rate: '',
    role_description: '',
    role_requirements: '',
    role_preferred_qualifications: '',
    role_shooting_dates: '',
    role_location: '',
    role_union_status: '' as 'union' | 'non-union' | 'both' | 'tbd' | '',
    role_audition_required: true,
    role_audition_info: '',
    role_contact_email: '',
    role_contact_phone: '',
  })

  useEffect(() => {
    if (characterId && (ready || !user)) {
      loadData()
    }
  }, [characterId, movieId, ready, user])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load character
      let characterData: Character | null = null
      if (user && userId) {
        characterData = await CharactersService.getCharacterById(characterId)
      } else {
        // For unauthenticated users, try to load character directly
        const { data, error } = await getSupabaseClient()
          .from('characters')
          .select('*')
          .eq('id', characterId)
          .maybeSingle()
        
        if (!error && data) {
          characterData = data as Character
        }
      }

      if (!characterData) {
        toast({
          title: "Character Not Found",
          description: "This role is not available.",
          variant: "destructive",
        })
        router.push('/movies')
        return
      }

      // Check if character is visible on casting
      if (characterData.show_on_casting === false) {
        toast({
          title: "Access Denied",
          description: "This role is not currently available for casting.",
          variant: "destructive",
        })
        router.push(movieId ? `/casting/${movieId}` : '/movies')
        return
      }

      setCharacter(characterData)

      // Initialize role details form if owner
      if (characterData) {
        setRoleDetailsForm({
          role_compensation_type: characterData.role_compensation_type || '',
          role_compensation_rate: characterData.role_compensation_rate || '',
          role_description: characterData.role_description || '',
          role_requirements: characterData.role_requirements || '',
          role_preferred_qualifications: characterData.role_preferred_qualifications || '',
          role_shooting_dates: characterData.role_shooting_dates || '',
          role_location: characterData.role_location || '',
          role_union_status: characterData.role_union_status || '',
          role_audition_required: characterData.role_audition_required ?? true,
          role_audition_info: characterData.role_audition_info || '',
          role_contact_email: characterData.role_contact_email || '',
          role_contact_phone: characterData.role_contact_phone || '',
        })
      }

      // Load movie
      const projectId = characterData.project_id || movieId
      if (projectId) {
        let movieData: Movie | null = null
        if (user && userId) {
          movieData = await MovieService.getMovieById(projectId)
        } else {
          const { data, error } = await getSupabaseClient()
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .eq('project_type', 'movie')
            .maybeSingle()
          
          if (!error && data) {
            movieData = data as Movie
          }
        }
        
        if (movieData) {
          setMovie(movieData)
          const owner = user && userId && movieData.user_id === userId
          setIsOwner(owner || false)
          
          // Load submissions for this role if owner
          if (owner && characterData) {
            await loadSubmissions(movieData.id, characterData.name)
          }
        }
      }
    } catch (error) {
      console.error('Error loading role details:', error)
      toast({
        title: "Error",
        description: "Failed to load role details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadSubmissions = async (movieId: string, characterName: string) => {
    try {
      const allSubmissions = await CastingService.getSubmissionsForMovie(movieId)
      // Filter submissions for this specific role
      const roleSubmissions = allSubmissions.filter(
        sub => sub.role_applying_for?.toLowerCase() === characterName.toLowerCase()
      )
      setSubmissions(roleSubmissions)
    } catch (error) {
      console.error('Error loading submissions:', error)
    }
  }

  const handleUpdateSubmissionStatus = async (submissionId: string, status: ActorSubmission['status'], notes?: string) => {
    if (!isOwner) return
    
    try {
      await CastingService.updateSubmission(submissionId, { status, notes })
      
      toast({
        title: "Status Updated",
        description: "Submission status updated successfully",
      })
      
      if (movie && character) {
        await loadSubmissions(movie.id, character.name)
      }
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
    if (!isOwner) return
    
    if (!confirm('Are you sure you want to delete this submission?')) {
      return
    }
    
    try {
      await CastingService.deleteSubmission(submissionId)
      
      toast({
        title: "Submission Deleted",
        description: "Submission deleted successfully",
      })
      
      if (movie && character) {
        await loadSubmissions(movie.id, character.name)
      }
    } catch (error) {
      console.error('Error deleting submission:', error)
      toast({
        title: "Error",
        description: "Failed to delete submission",
        variant: "destructive",
      })
    }
  }

  const handleSaveRoleDetails = async () => {
    if (!isOwner || !character) return

    try {
      setIsSaving(true)

      // Prepare update data - convert empty strings to null
      const updateData: any = {}
      Object.keys(roleDetailsForm).forEach(key => {
        const value = roleDetailsForm[key as keyof typeof roleDetailsForm]
        updateData[key] = value === '' ? null : value
      })

      const updated = await CharactersService.updateCharacter(character.id, updateData)
      setCharacter(updated)
      
      toast({
        title: "Role Details Updated",
        description: "Role details have been saved successfully",
      })
      
      setShowEditForm(false)
    } catch (error) {
      console.error('Error saving role details:', error)
      toast({
        title: "Error",
        description: "Failed to save role details",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
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

    if (!movie) {
      toast({
        title: "Error",
        description: "Movie information not found",
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
        headshotUrl = await CastingService.uploadFile(headshotFile, 'headshots', movie.id)
      }
      
      if (videoFile) {
        videoUrl = await CastingService.uploadFile(videoFile, 'videos', movie.id)
      }
      
      if (resumeFile) {
        resumeUrl = await CastingService.uploadFile(resumeFile, 'resumes', movie.id)
      }
      
      if (additionalPhotos.length > 0) {
        for (const photo of additionalPhotos) {
          const url = await CastingService.uploadFile(photo, 'photos', movie.id)
          additionalPhotoUrls.push(url)
        }
      }
      
      // Submit application
      await CastingService.submitActorApplication({
        movie_id: movie.id,
        ...submissionForm,
        role_applying_for: character?.name || submissionForm.role_applying_for,
        headshot_url: headshotUrl,
        video_url: videoUrl,
        resume_url: resumeUrl,
        additional_photos: additionalPhotoUrls,
      })
      
      toast({
        title: "Application Submitted!",
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
      if (isOwner && movie && character) {
        await loadSubmissions(movie.id, character.name)
      }
      
    } catch (error: any) {
      console.error('Error submitting application:', error)
      
      let errorMessage = "Failed to submit your application. Please try again."
      
      // Check if it's a bucket not found error
      if (error?.message?.includes('Bucket not found') || error?.message?.includes('not found')) {
        errorMessage = "Storage bucket not configured. Please contact the project owner to set up the actor-submissions bucket."
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getCompensationBadgeColor = (type: string | null | undefined) => {
    switch (type) {
      case 'paid': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'unpaid': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'deferred': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'stipend': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'negotiable': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-4xl px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    )
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-4xl px-6 py-8">
          <Card className="cinema-card">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Character not found</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 sm:px-6 py-4 sm:py-8">
        {/* Back Button and Manage Submissions */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {isOwner && (
            <Link href="/manage-submissions">
              <Button
                variant="outline"
                size="sm"
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Submissions
              </Button>
            </Link>
          )}
        </div>

        {/* Role Header */}
        <Card className="cinema-card mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Character Image */}
              <div className="w-full md:w-48 flex-shrink-0">
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                  {character.image_url ? (
                    <img
                      src={character.image_url}
                      alt={character.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              {/* Role Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-2xl sm:text-3xl mb-2 break-words">{character.name}</CardTitle>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {character.character_type && (
                        <Badge variant="outline" className="flex-shrink-0">
                          {character.character_type.charAt(0).toUpperCase() + character.character_type.slice(1)} Role
                        </Badge>
                      )}
                      {character.role_compensation_type && (
                        <Badge className={`flex-shrink-0 ${getCompensationBadgeColor(character.role_compensation_type)}`}>
                          {character.role_compensation_type.charAt(0).toUpperCase() + character.role_compensation_type.slice(1)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Edit Button - Owner Only */}
                  {isOwner && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEditForm(true)}
                      className="flex-shrink-0 w-full sm:w-auto"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Edit Role Details</span>
                      <span className="sm:hidden">Edit</span>
                    </Button>
                  )}
                </div>

                {character.description && (
                  <CardDescription className="text-base mb-4">
                    {character.description}
                  </CardDescription>
                )}

                {/* Role Details */}
                <div className="space-y-3">
                  {character.role_compensation_rate && (
                    <div className="flex items-start sm:items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 sm:mt-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">Compensation: </span>
                        <span className="break-words">{character.role_compensation_rate}</span>
                      </div>
                    </div>
                  )}

                  {character.role_shooting_dates && (
                    <div className="flex items-start sm:items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 sm:mt-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">Shooting Dates: </span>
                        <span className="break-words">{character.role_shooting_dates}</span>
                      </div>
                    </div>
                  )}

                  {character.role_location && (
                    <div className="flex items-start sm:items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 sm:mt-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">Location: </span>
                        <span className="break-words">{character.role_location}</span>
                      </div>
                    </div>
                  )}

                  {character.role_union_status && (
                    <div className="flex items-start sm:items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 sm:mt-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">Union Status: </span>
                        <span className="capitalize break-words">{character.role_union_status}</span>
                      </div>
                    </div>
                  )}

                  {(character.role_contact_email || character.role_contact_phone) && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-sm pt-2">
                      {character.role_contact_email && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <a href={`mailto:${character.role_contact_email}`} className="text-primary hover:underline break-all">
                            {character.role_contact_email}
                          </a>
                        </div>
                      )}
                      {character.role_contact_phone && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <a href={`tel:${character.role_contact_phone}`} className="text-primary hover:underline break-all">
                            {character.role_contact_phone}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Role Description */}
        {character.role_description && (
          <Card className="cinema-card mb-6">
            <CardHeader>
              <CardTitle>Role Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{character.role_description}</p>
            </CardContent>
          </Card>
        )}

        {/* Requirements */}
        {character.role_requirements && (
          <Card className="cinema-card mb-6">
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{character.role_requirements}</p>
            </CardContent>
          </Card>
        )}

        {/* Preferred Qualifications */}
        {character.role_preferred_qualifications && (
          <Card className="cinema-card mb-6">
            <CardHeader>
              <CardTitle>Preferred Qualifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{character.role_preferred_qualifications}</p>
            </CardContent>
          </Card>
        )}

        {/* Audition Info */}
        {character.role_audition_info && (
          <Card className="cinema-card mb-6">
            <CardHeader>
              <CardTitle>Audition Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{character.role_audition_info}</p>
            </CardContent>
          </Card>
        )}

        {/* Character Details (for actors) */}
        <Card className="cinema-card mb-6">
          <CardHeader>
            <CardTitle>Character Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {character.archetype && (
              <div>
                <Label className="text-sm font-semibold">Archetype</Label>
                <p className="text-sm text-muted-foreground">{character.archetype}</p>
              </div>
            )}

            {(character.age || character.gender) && (
              <div className="flex flex-col sm:flex-row gap-4">
                {character.age && (
                  <div>
                    <Label className="text-sm font-semibold">Age</Label>
                    <p className="text-sm text-muted-foreground">{character.age}</p>
                  </div>
                )}
                {character.gender && (
                  <div>
                    <Label className="text-sm font-semibold">Gender</Label>
                    <p className="text-sm text-muted-foreground">{character.gender}</p>
                  </div>
                )}
              </div>
            )}

            {character.backstory && (
              <div>
                <Label className="text-sm font-semibold">Backstory</Label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{character.backstory}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Apply Button - Show for everyone */}
        <div className="flex justify-center mb-6">
          <Button
            className="gradient-button text-white w-full sm:w-auto"
            size="lg"
            onClick={() => setShowSubmissionForm(true)}
          >
            <Star className="h-5 w-5 mr-2" />
            Apply for This Role
          </Button>
        </div>

        {/* Owner View - Submissions for This Role */}
        {isOwner && (
          <Card className="cinema-card mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Submissions for {character.name} ({submissions.length})
              </CardTitle>
              <CardDescription>Review and manage actor applications for this role</CardDescription>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No submissions for this role yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <Card key={submission.id} className="border-border">
                      <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-lg flex items-center gap-2 break-words">
                              <User className="h-4 w-4 flex-shrink-0" />
                              <span className="break-words">{submission.actor_name}</span>
                            </h4>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1 min-w-0">
                                <Mail className="h-3 w-3 flex-shrink-0" />
                                <span className="break-all">{submission.actor_email}</span>
                              </span>
                              {submission.actor_phone && (
                                <span className="flex items-center gap-1 min-w-0">
                                  <Phone className="h-3 w-3 flex-shrink-0" />
                                  <span className="break-all">{submission.actor_phone}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <Badge className={`flex-shrink-0 ${statusColors[submission.status]}`}>
                            {submission.status}
                          </Badge>
                        </div>

                        {submission.cover_letter && (
                          <div className="mb-3">
                            <Label className="text-sm font-semibold">Cover Letter</Label>
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              {submission.cover_letter}
                            </p>
                          </div>
                        )}

                        {submission.experience && (
                          <div className="mb-3">
                            <Label className="text-sm font-semibold">Experience</Label>
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              {submission.experience}
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
                          {submission.additional_photos && submission.additional_photos.length > 0 && (
                            <div className="flex gap-2">
                              {submission.additional_photos.map((photo, idx) => (
                                <a
                                  key={idx}
                                  href={photo}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs"
                                >
                                  <Button variant="outline" size="sm">
                                    <ImageIcon className="h-3 w-3 mr-1" />
                                    Photo {idx + 1}
                                  </Button>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={submission.status}
                            onValueChange={(value) => handleUpdateSubmissionStatus(submission.id, value as ActorSubmission['status'])}
                          >
                            <SelectTrigger className="w-full sm:w-40 flex-shrink-0">
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
                            className="flex-shrink-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSubmission(submission.id)}
                            className="flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {submission.notes && (
                          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                            <Label className="text-sm font-semibold">Internal Notes</Label>
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              {submission.notes}
                            </p>
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

        {/* Submission Detail Dialog */}
        {selectedSubmission && (
          <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
            <DialogContent className="cinema-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedSubmission.actor_name}</DialogTitle>
                <DialogDescription>
                  Full submission details
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Email</Label>
                  <p className="text-sm">{selectedSubmission.actor_email}</p>
                </div>

                {selectedSubmission.actor_phone && (
                  <div>
                    <Label className="text-sm font-semibold">Phone</Label>
                    <p className="text-sm">{selectedSubmission.actor_phone}</p>
                  </div>
                )}

                {selectedSubmission.cover_letter && (
                  <div>
                    <Label className="text-sm font-semibold">Cover Letter</Label>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                      {selectedSubmission.cover_letter}
                    </p>
                  </div>
                )}

                {selectedSubmission.experience && (
                  <div>
                    <Label className="text-sm font-semibold">Experience</Label>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                      {selectedSubmission.experience}
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-semibold">Status</Label>
                  <Select
                    value={selectedSubmission.status}
                    onValueChange={(value) => {
                      handleUpdateSubmissionStatus(selectedSubmission.id, value as ActorSubmission['status'])
                      setSelectedSubmission({ ...selectedSubmission, status: value as ActorSubmission['status'] })
                    }}
                  >
                    <SelectTrigger className="w-40 mt-1">
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
                </div>

                <div>
                  <Label className="text-sm font-semibold">Internal Notes</Label>
                  <Textarea
                    value={selectedSubmission.notes || ''}
                    onChange={(e) => setSelectedSubmission({ ...selectedSubmission, notes: e.target.value })}
                    placeholder="Add internal notes..."
                    rows={4}
                    className="mt-1"
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={async () => {
                      await handleUpdateSubmissionStatus(selectedSubmission.id, selectedSubmission.status, selectedSubmission.notes || undefined)
                      setSelectedSubmission(null)
                    }}
                  >
                    Save Notes
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Submission Form Dialog */}
        <Dialog open={showSubmissionForm} onOpenChange={setShowSubmissionForm}>
          <DialogContent className="cinema-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Apply for {character.name}</DialogTitle>
              <DialogDescription>
                Submit your application for this role
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="actor_name">Name *</Label>
                <Input
                  id="actor_name"
                  value={submissionForm.actor_name}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, actor_name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>

              <div>
                <Label htmlFor="actor_email">Email *</Label>
                <Input
                  id="actor_email"
                  type="email"
                  value={submissionForm.actor_email}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, actor_email: e.target.value })}
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <Label htmlFor="actor_phone">Phone</Label>
                <Input
                  id="actor_phone"
                  type="tel"
                  value={submissionForm.actor_phone}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, actor_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <Label htmlFor="cover_letter">Cover Letter</Label>
                <Textarea
                  id="cover_letter"
                  value={submissionForm.cover_letter}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, cover_letter: e.target.value })}
                  placeholder="Tell us why you're perfect for this role..."
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="experience">Experience</Label>
                <Textarea
                  id="experience"
                  value={submissionForm.experience}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, experience: e.target.value })}
                  placeholder="Your acting experience, training, credits..."
                  rows={4}
                />
              </div>

              <div>
                <Label>Headshot Photo</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setHeadshotFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>

              <div>
                <Label>Demo Reel / Video</Label>
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>

              <div>
                <Label>Resume</Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>

              <div>
                <Label>Additional Photos</Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    setAdditionalPhotos(files)
                  }}
                  className="cursor-pointer"
                />
                {additionalPhotos.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {additionalPhotos.length} photo(s) selected
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowSubmissionForm(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleSubmitApplication} disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit Application
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Role Details Dialog */}
        <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
          <DialogContent className="cinema-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Role Details for {character.name}</DialogTitle>
              <DialogDescription>
                Update the role information that actors will see when applying
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Compensation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="compensation_type">Compensation Type</Label>
                  <Select
                    value={roleDetailsForm.role_compensation_type}
                    onValueChange={(value) => setRoleDetailsForm({ ...roleDetailsForm, role_compensation_type: value as any })}
                  >
                    <SelectTrigger id="compensation_type">
                      <SelectValue placeholder="Select compensation type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="deferred">Deferred</SelectItem>
                      <SelectItem value="stipend">Stipend</SelectItem>
                      <SelectItem value="negotiable">Negotiable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="compensation_rate">Compensation Rate</Label>
                  <Input
                    id="compensation_rate"
                    value={roleDetailsForm.role_compensation_rate}
                    onChange={(e) => setRoleDetailsForm({ ...roleDetailsForm, role_compensation_rate: e.target.value })}
                    placeholder="e.g., $500/day, $50,000, TBD"
                  />
                </div>
              </div>

              {/* Role Description */}
              <div>
                <Label htmlFor="role_description">Role Description</Label>
                <Textarea
                  id="role_description"
                  value={roleDetailsForm.role_description}
                  onChange={(e) => setRoleDetailsForm({ ...roleDetailsForm, role_description: e.target.value })}
                  placeholder="Detailed description of the role for actors..."
                  rows={5}
                />
              </div>

              {/* Requirements */}
              <div>
                <Label htmlFor="role_requirements">Requirements</Label>
                <Textarea
                  id="role_requirements"
                  value={roleDetailsForm.role_requirements}
                  onChange={(e) => setRoleDetailsForm({ ...roleDetailsForm, role_requirements: e.target.value })}
                  placeholder="Required qualifications, skills, age range, etc..."
                  rows={4}
                />
              </div>

              {/* Preferred Qualifications */}
              <div>
                <Label htmlFor="role_preferred">Preferred Qualifications</Label>
                <Textarea
                  id="role_preferred"
                  value={roleDetailsForm.role_preferred_qualifications}
                  onChange={(e) => setRoleDetailsForm({ ...roleDetailsForm, role_preferred_qualifications: e.target.value })}
                  placeholder="Preferred but not required qualifications..."
                  rows={3}
                />
              </div>

              {/* Shooting Dates & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="shooting_dates">Shooting Dates</Label>
                  <Input
                    id="shooting_dates"
                    value={roleDetailsForm.role_shooting_dates}
                    onChange={(e) => setRoleDetailsForm({ ...roleDetailsForm, role_shooting_dates: e.target.value })}
                    placeholder="e.g., March 15-30, 2024"
                  />
                </div>

                <div>
                  <Label htmlFor="role_location">Location</Label>
                  <Input
                    id="role_location"
                    value={roleDetailsForm.role_location}
                    onChange={(e) => setRoleDetailsForm({ ...roleDetailsForm, role_location: e.target.value })}
                    placeholder="e.g., Los Angeles, CA"
                  />
                </div>
              </div>

              {/* Union Status */}
              <div>
                <Label htmlFor="union_status">Union Status</Label>
                <Select
                  value={roleDetailsForm.role_union_status}
                  onValueChange={(value) => setRoleDetailsForm({ ...roleDetailsForm, role_union_status: value as any })}
                >
                  <SelectTrigger id="union_status">
                    <SelectValue placeholder="Select union status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="union">Union</SelectItem>
                    <SelectItem value="non-union">Non-Union</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="tbd">TBD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Audition Required */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <Label htmlFor="audition_required">Audition Required</Label>
                  <p className="text-sm text-muted-foreground">
                    Whether an audition is required for this role
                  </p>
                </div>
                <Switch
                  id="audition_required"
                  checked={roleDetailsForm.role_audition_required}
                  onCheckedChange={(checked) => setRoleDetailsForm({ ...roleDetailsForm, role_audition_required: checked })}
                  className="flex-shrink-0"
                />
              </div>

              {/* Audition Info */}
              {roleDetailsForm.role_audition_required && (
                <div>
                  <Label htmlFor="audition_info">Audition Information</Label>
                  <Textarea
                    id="audition_info"
                    value={roleDetailsForm.role_audition_info}
                    onChange={(e) => setRoleDetailsForm({ ...roleDetailsForm, role_audition_info: e.target.value })}
                    placeholder="Audition date, location, format, what to prepare..."
                    rows={3}
                  />
                </div>
              )}

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={roleDetailsForm.role_contact_email}
                    onChange={(e) => setRoleDetailsForm({ ...roleDetailsForm, role_contact_email: e.target.value })}
                    placeholder="contact@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    type="tel"
                    value={roleDetailsForm.role_contact_phone}
                    onChange={(e) => setRoleDetailsForm({ ...roleDetailsForm, role_contact_phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowEditForm(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleSaveRoleDetails} disabled={isSaving} className="w-full sm:w-auto">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

