"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Film, Plus, ArrowRight, Clock, Users, TrendingUp, User } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
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

  if (!user) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please sign in to access your dashboard</h1>
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8">
      {/* Header with User Info */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Welcome back, {user.name}! 🎬
            </h1>
            <p className="text-lg text-muted-foreground">Signed in as {user.email}</p>
          </div>
        </div>
        <p className="text-xl text-muted-foreground">Here's what's happening with your projects today</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Recent Projects</h2>
          <Button className="gradient-button neon-glow text-white px-8 py-3 text-lg">
            <Plus className="mr-2 h-5 w-5" />
            New Project
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "Quantum Heist",
              status: "In Progress",
              progress: 75,
              team: 4,
              lastUpdated: "2 hours ago",
            },
            {
              title: "Digital Horror",
              status: "Planning",
              progress: 25,
              team: 2,
              lastUpdated: "1 day ago",
            },
            {
              title: "Classical Music",
              status: "Completed",
              progress: 100,
              team: 6,
              lastUpdated: "1 week ago",
            },
          ].map((project, index) => (
            <Card key={index} className="cinema-card hover:neon-glow transition-all duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{project.title}</CardTitle>
                  <Badge
                    variant="secondary"
                    className={
                      project.status === "Completed"
                        ? "bg-green-500/20 text-green-500 border-green-500/30"
                        : project.status === "In Progress"
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
          ))}
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
                <p className="text-2xl font-bold text-blue-500">12</p>
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
                <p className="text-2xl font-bold text-cyan-500">48</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cinema-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-600/10">
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
  )
}
