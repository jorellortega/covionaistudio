"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Header from "@/components/header"
import { useAuthReady } from "@/components/auth-hooks"
import { TreatmentsService, type Treatment } from "@/lib/treatments-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Film, Loader2, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function TreatmentDocumentPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { ready } = useAuthReady()
  const id = params.id as string

  const [treatment, setTreatment] = useState<Treatment | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prompt, setPrompt] = useState("")

  const load = useCallback(async () => {
    if (!ready || !id) return
    setLoading(true)
    try {
      const data = await TreatmentsService.getTreatment(id)
      if (!data) {
        setTreatment(null)
        return
      }
      setTreatment(data)
      setPrompt(data.prompt || "")
    } catch (e) {
      console.error(e)
      toast({
        title: "Error",
        description: "Could not load treatment.",
        variant: "destructive",
      })
      setTreatment(null)
    } finally {
      setLoading(false)
    }
  }, [ready, id, toast])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    if (!treatment) return
    setSaving(true)
    try {
      const updated = await TreatmentsService.updateTreatment(treatment.id, {
        prompt: prompt.trim() || undefined,
      })
      setTreatment(updated)
      toast({ title: "Saved", description: "Treatment document updated." })
    } catch (e) {
      console.error(e)
      toast({
        title: "Save failed",
        description: "Could not save. You may not have edit access.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <Header />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!treatment) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-semibold">Treatment not available</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            This ID may be invalid, or your account may not have permission to read this treatment in the database.
          </p>
          <Button variant="outline" onClick={() => router.push("/treatments")}>
            Back to treatments
          </Button>
        </div>
      </div>
    )
  }

  const title = treatment.title?.trim() || "Treatment"

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-3 py-2.5 sm:px-5">
          <div className="flex min-w-0 max-w-full flex-1 items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 px-2"
              onClick={() => router.push("/treatments")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Treatments</span>
            </Button>
            <h1 className="min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/viewmovie/${treatment.id}`} className="inline-flex items-center gap-1.5">
                <Film className="h-4 w-4" />
                <span className="hidden sm:inline">View movie</span>
                <span className="sm:hidden">Movie</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/treatments")}>
              Close
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-5">
          <Card className="cinema-card flex min-h-0 flex-1 flex-col border-2 shadow-lg">
            <CardHeader className="shrink-0 space-y-1 pb-3">
              <CardTitle className="text-lg">Treatment</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
              <Label htmlFor="treatment-prompt" className="sr-only">
                Treatment document
              </Label>
              <Textarea
                id="treatment-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                spellCheck
                className="min-h-0 flex-1 resize-y font-mono text-sm leading-relaxed sm:text-[15px] md:text-base"
                placeholder="Write or paste your treatment here…"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
