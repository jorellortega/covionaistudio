import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import Header from "@/components/header"

export default function TreatmentPageLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-6 w-48 max-w-[40vw]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-5">
          <Card className="cinema-card flex min-h-0 flex-1 flex-col border-2 shadow-lg">
            <CardHeader className="pb-3">
              <Skeleton className="h-6 w-28" />
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
              <Skeleton className="min-h-0 flex-1 w-full rounded-md border border-border" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
