"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuthReady } from "@/components/auth-hooks"
import { 
  Users,
  Mail,
  Phone,
  FileText,
  Image as ImageIcon,
  Video,
  Eye,
  Trash2,
  Search,
  Filter,
  Loader2,
  Download,
  ArrowLeft,
  User,
  Film
} from "lucide-react"
import { CastingService, type ActorSubmission } from "@/lib/casting-service"
import { MovieService, type Movie } from "@/lib/movie-service"
import Link from "next/link"

const statusColors = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  reviewing: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  shortlisted: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  accepted: "bg-purple-500/20 text-purple-400 border-purple-500/30",
}

export default function ManageSubmissionsPage() {
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  const router = useRouter()

  const [submissions, setSubmissions] = useState<ActorSubmission[]>([])
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState<ActorSubmission | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [movieFilter, setMovieFilter] = useState<string>("all")

  useEffect(() => {
    if (ready && userId) {
      loadData()
    }
  }, [ready, userId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load movies and submissions in parallel
      const [moviesData, submissionsData] = await Promise.all([
        MovieService.getMovies(),
        CastingService.getAllSubmissionsForUser()
      ])
      
      setMovies(moviesData)
      setSubmissions(submissionsData)
    } catch (error) {
      console.error('Error loading submissions:', error)
      toast({
        title: "Error",
        description: "Failed to load submissions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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

  const getMovieName = (movieId: string) => {
    const movie = movies.find(m => m.id === movieId)
    return movie?.name || "Unknown Movie"
  }

  // Filter submissions
  const filteredSubmissions = submissions.filter(submission => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        submission.actor_name.toLowerCase().includes(query) ||
        submission.actor_email.toLowerCase().includes(query) ||
        submission.role_applying_for?.toLowerCase().includes(query) ||
        submission.cover_letter?.toLowerCase().includes(query) ||
        submission.experience?.toLowerCase().includes(query)
      
      if (!matchesSearch) return false
    }

    // Status filter
    if (statusFilter !== "all" && submission.status !== statusFilter) {
      return false
    }

    // Movie filter
    if (movieFilter !== "all" && submission.movie_id !== movieFilter) {
      return false
    }

    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">Manage Submissions</h1>
            <p className="text-muted-foreground mt-1">
              Review and manage all actor submissions across your movies
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="cinema-card mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by name, email, role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reviewing">Reviewing</SelectItem>
                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="movie-filter">Movie</Label>
                <Select value={movieFilter} onValueChange={setMovieFilter}>
                  <SelectTrigger id="movie-filter" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Movies</SelectItem>
                    {movies.map((movie) => (
                      <SelectItem key={movie.id} value={movie.id}>
                        {movie.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submissions List */}
        <Card className="cinema-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Submissions ({filteredSubmissions.length})
            </CardTitle>
            <CardDescription>
              {submissions.length} total submission{submissions.length !== 1 ? 's' : ''} across {movies.length} movie{movies.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-semibold mb-1">
                  {searchQuery || statusFilter !== "all" || movieFilter !== "all" 
                    ? "No submissions match your filters" 
                    : "No submissions yet"}
                </p>
                <p className="text-sm">
                  {searchQuery || statusFilter !== "all" || movieFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Actor submissions will appear here when actors apply for roles"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSubmissions.map((submission) => (
                  <Card key={submission.id} className="border-border">
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        {/* Thumbnail Section */}
                        {(submission.headshot_url || (submission.additional_photos && submission.additional_photos.length > 0)) && (
                          <div className="flex-shrink-0">
                            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden bg-muted border border-border">
                              <a
                                href={submission.headshot_url || submission.additional_photos?.[0]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full h-full"
                              >
                                <img
                                  src={submission.headshot_url || submission.additional_photos?.[0]}
                                  alt={`${submission.actor_name} headshot`}
                                  className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = "/placeholder.svg?height=128&width=128"
                                  }}
                                />
                              </a>
                            </div>
                          </div>
                        )}
                        
                        {/* Content Section */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="font-semibold text-lg break-words">
                                  {submission.actor_name}
                                </h4>
                                <Badge className={`flex-shrink-0 ${statusColors[submission.status]}`}>
                                  {submission.status}
                                </Badge>
                              </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
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
                          <div className="mt-2 flex items-center gap-2 text-sm">
                            <Film className="h-3 w-3 text-muted-foreground" />
                            <Link 
                              href={`/casting/${submission.movie_id}`}
                              className="text-primary hover:underline"
                            >
                              {getMovieName(submission.movie_id)}
                            </Link>
                            {submission.role_applying_for && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <Badge variant="outline" className="text-xs">
                                  {submission.role_applying_for}
                                </Badge>
                              </>
                            )}
                          </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {submission.cover_letter && (
                        <div className="mb-3">
                          <Label className="text-sm font-semibold">Cover Letter</Label>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">
                            {submission.cover_letter}
                          </p>
                        </div>
                      )}

                      {submission.experience && (
                        <div className="mb-3">
                          <Label className="text-sm font-semibold">Experience</Label>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">
                            {submission.experience}
                          </p>
                        </div>
                      )}

                      {/* Media Files Gallery */}
                      {(submission.headshot_url || submission.video_url || submission.resume_url || (submission.additional_photos && submission.additional_photos.length > 0)) && (
                        <div className="mb-4">
                          <Label className="text-sm font-semibold mb-2 block">Submitted Files</Label>
                          <div className="flex flex-wrap gap-2">
                            {submission.headshot_url && (
                              <a
                                href={submission.headshot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group"
                              >
                                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors">
                                  <img
                                    src={submission.headshot_url}
                                    alt="Headshot"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.src = "/placeholder.svg?height=80&width=80"
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">Headshot</span>
                                  </div>
                                </div>
                              </a>
                            )}
                            {submission.additional_photos && submission.additional_photos.length > 0 && (
                              <>
                                {submission.additional_photos.map((photo, idx) => (
                                  <a
                                    key={idx}
                                    href={photo}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group"
                                  >
                                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors">
                                      <img
                                        src={photo}
                                        alt={`Additional photo ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement
                                          target.src = "/placeholder.svg?height=80&width=80"
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <span className="text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">Photo {idx + 1}</span>
                                      </div>
                                    </div>
                                  </a>
                                ))}
                              </>
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
                        </div>
                      )}

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
                          <Eye className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">View Details</span>
                          <span className="sm:hidden">View</span>
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSubmission(submission.id)}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Delete</span>
                          <span className="sm:hidden">Del</span>
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
                  <Label className="text-sm font-semibold">Movie</Label>
                  <p className="text-sm">
                    <Link 
                      href={`/casting/${selectedSubmission.movie_id}`}
                      className="text-primary hover:underline"
                    >
                      {getMovieName(selectedSubmission.movie_id)}
                    </Link>
                  </p>
                </div>

                {selectedSubmission.role_applying_for && (
                  <div>
                    <Label className="text-sm font-semibold">Role</Label>
                    <p className="text-sm">{selectedSubmission.role_applying_for}</p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-semibold">Email</Label>
                  <p className="text-sm break-all">{selectedSubmission.actor_email}</p>
                </div>

                {selectedSubmission.actor_phone && (
                  <div>
                    <Label className="text-sm font-semibold">Phone</Label>
                    <p className="text-sm break-all">{selectedSubmission.actor_phone}</p>
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

                {/* Media Files */}
                <div>
                  <Label className="text-sm font-semibold">Submitted Files</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedSubmission.headshot_url && (
                      <a
                        href={selectedSubmission.headshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <ImageIcon className="h-3 w-3 mr-1" />
                          Headshot
                        </Button>
                      </a>
                    )}
                    {selectedSubmission.video_url && (
                      <a
                        href={selectedSubmission.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <Video className="h-3 w-3 mr-1" />
                          Demo Reel
                        </Button>
                      </a>
                    )}
                    {selectedSubmission.resume_url && (
                      <a
                        href={selectedSubmission.resume_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <FileText className="h-3 w-3 mr-1" />
                          Resume
                        </Button>
                      </a>
                    )}
                    {selectedSubmission.additional_photos && selectedSubmission.additional_photos.length > 0 && (
                      <>
                        {selectedSubmission.additional_photos.map((photo, idx) => (
                          <a
                            key={idx}
                            href={photo}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm">
                              <ImageIcon className="h-3 w-3 mr-1" />
                              Photo {idx + 1}
                            </Button>
                          </a>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedSubmission(null)} className="w-full sm:w-auto">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  )
}

