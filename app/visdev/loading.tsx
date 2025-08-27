import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function VisualDevelopmentLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="mb-8">
          <Skeleton className="h-12 w-96 mb-4 mx-auto sm:mx-0" />
          <Skeleton className="h-6 w-2/3 mx-auto sm:mx-0" />
        </div>

        <Tabs defaultValue="characters" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 max-w-6xl mx-auto">
            <TabsTrigger value="characters" disabled>Characters</TabsTrigger>
            <TabsTrigger value="environments" disabled>Environments</TabsTrigger>
            <TabsTrigger value="props" disabled>Props</TabsTrigger>
            <TabsTrigger value="colors" disabled>Color Scripts</TabsTrigger>
            <TabsTrigger value="lighting" disabled>Lighting</TabsTrigger>
            <TabsTrigger value="style" disabled>Style Guides</TabsTrigger>
            <TabsTrigger value="prompts" disabled>Prompts</TabsTrigger>
          </TabsList>

          <TabsContent value="characters" className="space-y-6">
            <div className="mb-6">
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-5 w-full" />
            </div>
            
            <div className="grid gap-4">
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-square w-full" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
