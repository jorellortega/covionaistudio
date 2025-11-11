"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Film, Plus, ArrowRight, Clock, Users, TrendingUp, User, FileText, Image as ImageIcon, LogOut, Lightbulb, Palette } from "lucide-react"
import Link from "next/link"
import { useAuthReady } from "@/components/auth-hooks"
import { Skeleton } from "@/components/ui/skeleton"
import { TreatmentsService } from "@/lib/treatments-service"
import { ProjectsService, DashboardProject } from "@/lib/projects-service"
import { MovieIdeasService } from "@/lib/movie-ideas-service"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase"
import Header from "@/components/header"

export default function DashboardPage() {
  const { session, user, userId, ready } = useAuthReady()
  const router = useRouter()
  const [treatmentsCount, setTreatmentsCount] = useState(0)
  const [recentProjects, setRecentProjects] = useState<DashboardProject[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [totalProjects, setTotalProjects] = useState(0)
  const [totalScenes, setTotalScenes] = useState(0)

  const [ideasCount, setIdeasCount] = useState(0)
  const [hasFetchedData, setHasFetchedData] = useState(false)
  const [userName, setUserName] = useState<string>('User')

  // Fetch user name from public.users table
  useEffect(() => {
    const fetchUserName = async () => {
      if (!userId) return
      
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('users')
          .select('name')
          .eq('id', userId)
          .single()

        if (error) {
          console.error('Error fetching user name:', error)
          // Fallback to email or default
          setUserName(session?.user?.email?.split('@')[0] || 'User')
        } else if (data?.name) {
          setUserName(data.name)
        } else {
          // Fallback to email or default
          setUserName(session?.user?.email?.split('@')[0] || 'User')
        }
      } catch (error) {
        console.error('Error fetching user name:', error)
        setUserName(session?.user?.email?.split('@')[0] || 'User')
      }
    }

    if (ready && userId) {
      fetchUserName()
    }
  }, [ready, userId, session?.user?.email])

  // Memoize the fetch data function to prevent unnecessary re-renders
  const fetchData = useCallback(async () => {
    if (!ready || hasFetchedData) return
    
    console.log('🏠 DASHBOARD - Starting data fetch')
    setIsLoadingProjects(true)
    
    try {
      // Fetch treatments count
      const treatments = await TreatmentsService.getTreatments()
      setTreatmentsCount(treatments.length)

      // Fetch recent projects
      const projects = await ProjectsService.getRecentProjects()
      setRecentProjects(projects)
      
      // Fetch total counts
      const allProjects = await ProjectsService.getProjects()
      setTotalProjects(allProjects.length)
      
      // Calculate total scenes from all projects
      const totalScenesCount = allProjects.reduce((sum, project) => sum + (project.scenes || 0), 0)
      setTotalScenes(totalScenesCount)
      
      // Fetch ideas count
      const ideas = await MovieIdeasService.getUserIdeas(userId!)
      setIdeasCount(ideas.length)
      
      setHasFetchedData(true)
    } catch (error) {
      console.error('🏠 DASHBOARD - Error fetching dashboard data:', error)
    } finally {
      setIsLoadingProjects(false)
    }
  }, [ready, userId, hasFetchedData])

  // Fetch data only once when user is available
  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSignOut = useCallback(async () => {
    console.log('🏠 DASHBOARD - Sign out initiated')
    try {
      // Use Supabase auth directly for sign out
      const supabase = getSupabaseClient()
      const { error } = await getSupabaseClient().auth.signOut()
      if (error) throw error
      console.log('🏠 DASHBOARD - Sign out completed')
      // Redirect to login page after successful sign out
      router.push('/login')
    } catch (error) {
      console.error('🏠 DASHBOARD - Error signing out:', error)
      // Still redirect even on error to ensure user is logged out
      router.push('/login')
    }
  }, [router])


  if (!ready) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <Skeleton className="h-12 w-96 mb-4" />
          <Skeleton className="h-6 w-80" />
        </div>
        {/* Add more skeleton loaders as needed */}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 py-8">
        {/* Header with User Info */}
        <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                Welcome back, {userName}! 🎬
              </h1>
              <p className="text-lg text-muted-foreground">Signed in as {user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              asChild
              variant="outline" 
              className="flex items-center gap-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors"
            >
              <Link href="/">
                <Film className="h-4 w-4" />
                Homepage
              </Link>
            </Button>
            <Button 
              onClick={handleSignOut}
              variant="outline" 
              className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
        <p className="text-xl text-muted-foreground">Here's what's happening with your projects today</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="cinema-card hover:neon-glow transition-all duration-300 group cursor-pointer">
          <Link href="/movies">
            <CardHeader className="pb-4">
              <div className="p-3 rounded-lg bg-blue-500/10 w-fit group-hover:bg-blue-500/20 transition-colors">
                <Film className="h-6 w-6 text-blue-500" />
              </div>
              <CardTitle className="text-lg group-hover:text-blue-500 transition-colors">Movies</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">Manage your film projects</CardDescription>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-blue-500">3</span>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cinema-card hover:neon-glow transition-all duration-300 group cursor-pointer">
          <Link href="/treatments">
            <CardHeader className="pb-4">
              <div className="p-3 rounded-lg bg-purple-500/10 w-fit group-hover:bg-purple-500/20 transition-colors">
                <FileText className="h-6 w-6 text-purple-500" />
              </div>
              <CardTitle className="text-lg group-hover:text-purple-500 transition-colors">Treatments</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">Manage story concepts</CardDescription>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-purple-500">{treatmentsCount}</span>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-500 transition-colors" />
              </div>
            </CardContent>
          </Link>
        </Card>



        <Card className="cinema-card hover:neon-glow transition-all duration-300 group cursor-pointer">
          <Link href="/ai-studio">
            <CardHeader className="pb-4">
              <div className="p-3 rounded-lg bg-blue-600/10 w-fit group-hover:bg-blue-600/20 transition-colors">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">AI Studio</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">Generate content with AI</CardDescription>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-blue-600">8</span>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cinema-card hover:neon-glow transition-all duration-300 group cursor-pointer">
          <Link href="/ideas">
            <CardHeader className="pb-4">
              <div className="p-3 rounded-lg bg-yellow-500/10 w-fit group-hover:bg-yellow-500/20 transition-colors">
                <Lightbulb className="h-6 w-6 text-yellow-500" />
              </div>
              <CardTitle className="text-lg group-hover:text-yellow-500 transition-colors">Ideas</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">Capture creative sparks</CardDescription>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-yellow-500">{ideasCount}</span>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-yellow-500 transition-colors" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cinema-card hover:neon-glow transition-all duration-300 group cursor-pointer">
          <Link href="/visdev">
            <CardHeader className="pb-4">
              <div className="p-3 rounded-lg bg-green-500/10 w-fit group-hover:bg-green-500/20 transition-colors">
                <Palette className="h-6 w-6 text-green-500" />
              </div>
              <CardTitle className="text-lg group-hover:text-green-500 transition-colors">Visual Development</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">Design characters, environments & style guides</CardDescription>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-green-500">New</span>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-green-500 transition-colors" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cinema-card hover:neon-glow transition-all duration-300 group cursor-pointer">
          <Link href="/videos">
            <CardHeader className="pb-4">
              <div className="p-3 rounded-lg bg-cyan-500/10 w-fit group-hover:bg-cyan-500/20 transition-colors">
                <Film className="h-6 w-6 text-cyan-500" />
              </div>
              <CardTitle className="text-lg group-hover:text-cyan-500 transition-colors">Videos</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">Manage videos and reels</CardDescription>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-cyan-500">12</span>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-cyan-500 transition-colors" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Recent Projects */}
      <div className="mb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Recent Projects</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoadingProjects ? (
            // Loading skeletons
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="cinema-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="w-full h-2 rounded-full" />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : recentProjects.length > 0 ? (
            recentProjects.map((project) => (
              <Link key={project.id} href={`/timeline?movie=${project.id}`}>
                <Card className="cinema-card hover:neon-glow transition-all duration-300 cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{project.title}</CardTitle>
                      <Badge
                        variant="secondary"
                        className={
                          project.status === "Completed" || project.status === "Distribution"
                            ? "bg-green-500/20 text-green-500 border-green-500/30"
                            : project.status === "In Progress" || project.status === "Production" || project.status === "Post-Production"
                            ? "bg-blue-500/20 text-blue-500 border-blue-500/30"
                            : "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                        }
                      >
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progress</span>
                        <span className="text-blue-500">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${project.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{project.team} members</span>
                      </div>
                      <span>{project.lastUpdated}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            // Empty state
            <div className="col-span-full text-center py-12">
              <div className="text-muted-foreground mb-4">
                <Film className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                <p className="text-sm">Get started by creating your first project</p>
              </div>
              <Button className="gradient-button neon-glow text-white">
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          )}}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="cinema-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Film className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-2xl font-bold text-blue-500">{totalProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cinema-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Clock className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scenes Created</p>
                <p className="text-2xl font-bold text-cyan-500">{totalScenes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cinema-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-4 rounded-lg bg-blue-600/10">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-2xl font-bold text-blue-600">8</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cinema-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-600/10">
                <TrendingUp className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI Generations</p>
                <p className="text-2xl font-bold text-cyan-600">156</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
