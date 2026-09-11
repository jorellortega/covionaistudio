"use client"

import Link from "next/link"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Film, Lock } from "lucide-react"

export function CinemaProductionUpgradeRequired() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <Card className="cinema-card">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Upgrade required</CardTitle>
            <CardDescription>
              Upgrade required to use the video production page. Cinema Production is included with
              Studio and Production House plans, not Creator.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/subscriptions">
                <Film className="h-4 w-4 mr-2" />
                View plans
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/settings/plans-credits">Plans & credits</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
