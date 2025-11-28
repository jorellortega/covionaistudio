"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/AuthProvider"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Filter, Image as ImageIcon, FileText, Sparkles, Edit, Trash2, Eye, Download, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { StoryboardsService, Storyboard, CreateStoryboardData } from "@/lib/storyboards-service"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import Link from "next/link"
import { useRouter } from "next/navigation"


export default function StoryboardsPage() {
  const { session } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (session?.user) {
      // Redirect to movies page since storyboards now belong to scenes
      router.push('/movies')
    }
  }, [session?.user, router])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              <FileText className="h-12 w-12 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">Storyboards Moved to Scene Context</h1>
            <p className="text-lg mb-6">
              Storyboards are now organized within the movie-scene hierarchy for better organization.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>🎬 <strong>Movies</strong> → 📽️ <strong>Timelines</strong> → 🎭 <strong>Scenes</strong> → 📋 <strong>Storyboards</strong></p>
            </div>
            <div className="mt-8 space-x-4">
              <Button onClick={() => router.push('/movies')} className="gradient-button neon-glow text-white">
                Go to Movies
              </Button>
              <Button variant="outline" onClick={() => router.push('/timeline')}>
                View Timelines
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
