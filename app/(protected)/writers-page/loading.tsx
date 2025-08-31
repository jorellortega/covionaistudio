import { Loader2 } from "lucide-react"

export default function WritersPageLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-lg">Loading writers workspace...</span>
          <div className="text-sm text-muted-foreground text-center">
            <p>Setting up your writing environment...</p>
          </div>
        </div>
      </div>
    </div>
  )
}
