import { Card, CardContent, CardHeader } from '@/components/ui/card'
import Header from '@/components/header'

export default function PreferencesLoading() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-8 bg-muted rounded w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-96 animate-pulse"></div>
          </div>

          {/* Cards Skeleton */}
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-32 mb-2 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-64 animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded animate-pulse"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
