"use client"

import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Users, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ProjectSelector } from "@/components/project-selector"

export default function CastingIndexPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No project selected</h3>
          <p className="text-muted-foreground mb-4">
            Choose a project to view and manage its casting
          </p>

          <div className="max-w-md mx-auto mb-6">
            <ProjectSelector
              onProjectChange={(newProjectId) => {
                if (newProjectId) {
                  router.push(`/casting/${newProjectId}`)
                }
              }}
              placeholder="Select a project..."
              showCreateNew={true}
            />
          </div>

          <Link href="/movies">
            <Button className="gradient-button text-white">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Movies
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
