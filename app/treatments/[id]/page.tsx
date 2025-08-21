"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context-fixed'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Edit, Trash2, FileText, Clock, Calendar, User, Target, DollarSign, Film, Eye } from 'lucide-react'
import { TreatmentsService, Treatment } from '@/lib/treatments-service'
import Header from '@/components/header'
import Link from 'next/link'

export default function TreatmentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const [treatment, setTreatment] = useState<Treatment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (id) {
      loadTreatment(id as string)
    }
  }, [id])

  const loadTreatment = async (treatmentId: string) => {
    try {
      setIsLoading(true)
      const data = await TreatmentsService.getTreatment(treatmentId)
      if (data) {
        setTreatment(data)
      } else {
        toast({
          title: "Error",
          description: "Treatment not found",
          variant: "destructive",
        })
        router.push('/treatments')
      }
    } catch (error) {
      console.error('Error loading treatment:', error)
      toast({
        title: "Error",
        description: "Failed to load treatment",
        variant: "destructive",
      })
      router.push('/treatments')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!treatment || !confirm('Are you sure you want to delete this treatment?')) return
    
    try {
      setIsDeleting(true)
      await TreatmentsService.deleteTreatment(treatment.id)
      toast({
        title: "Success",
        description: "Treatment deleted successfully",
      })
      router.push('/treatments')
    } catch (error) {
      console.error('Error deleting treatment:', error)
      toast({
        title: "Error",
        description: "Failed to delete treatment",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'in-progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Please log in to view treatments</h1>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading treatment...</p>
          </div>
        </div>
      </>
    )
  }

  if (!treatment) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Treatment not found</h1>
            <Button asChild>
              <Link href="/treatments">Back to Treatments</Link>
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/treatments" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Treatments
            </Link>
          </Button>
        </div>

        {/* Treatment Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{treatment.title}</h1>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {treatment.genre}
                </Badge>
                <Badge className={`text-lg px-3 py-1 ${getStatusColor(treatment.status)}`}>
                  {treatment.status.replace('-', ' ')}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>

        {/* Cover Image */}
        {treatment.cover_image_url && (
          <Card className="mb-8 overflow-hidden">
            <div className="relative h-64 md:h-80 bg-muted">
              <img
                src={treatment.cover_image_url}
                alt={`${treatment.title} cover`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden absolute inset-0 flex items-center justify-center bg-muted">
                <div className="text-center text-muted-foreground">
                  <Film className="h-16 w-16 mx-auto mb-4" />
                  <p className="text-lg">Cover Image</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Synopsis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Synopsis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg leading-relaxed">{treatment.synopsis}</p>
              </CardContent>
            </Card>

            {/* Logline */}
            {treatment.logline && (
              <Card>
                <CardHeader>
                  <CardTitle>Logline</CardTitle>
                  <CardDescription>One-sentence summary</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-medium italic">"{treatment.logline}"</p>
                </CardContent>
              </Card>
            )}

            {/* Characters */}
            {treatment.characters && (
              <Card>
                <CardHeader>
                  <CardTitle>Characters</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line">{treatment.characters}</p>
                </CardContent>
              </Card>
            )}

            {/* Themes */}
            {treatment.themes && (
              <Card>
                <CardHeader>
                  <CardTitle>Themes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line">{treatment.themes}</p>
                </CardContent>
              </Card>
            )}

            {/* Visual References */}
            {treatment.visual_references && (
              <Card>
                <CardHeader>
                  <CardTitle>Visual References</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line">{treatment.visual_references}</p>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {treatment.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line">{treatment.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Project Details */}
            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Target Audience</p>
                    <p className="text-sm text-muted-foreground">
                      {treatment.target_audience || 'Not specified'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Estimated Budget</p>
                    <p className="text-sm text-muted-foreground">
                      {treatment.estimated_budget || 'Not specified'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Estimated Duration</p>
                    <p className="text-sm text-muted-foreground">
                      {treatment.estimated_duration || 'Not specified'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(treatment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(treatment.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Treatment
                </Button>
                <Button variant="outline" className="w-full" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View in Timeline
                </Button>
                <Button variant="outline" className="w-full" size="sm">
                  <Film className="h-4 w-4 mr-2" />
                  Create Movie Project
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
