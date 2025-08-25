import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function IdeasLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* AI Prompt Studio Loading State */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>

        {/* Right Column - Status */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
